/**
 * What "Download my data" exports from every table: everything the account
 * owns or took part in, and nothing of anyone else. Rows the account owns
 * leave out only the owner's auth subject. In a session it played, it gets
 * its own seats, the session's non-personal context (game, status, dates, whether it hosted or won) and, from each game table, what belongs to
 * its seats: its own answers, moves, claims, colour, team, timeline. Other
 * players appear as a count, never by name or id. Game secrets stay out too
 * (join codes, share tokens, seat secrets, decks, hands, solutions), so an
 * export taken mid-game reveals nothing the game would not.
 *
 * Rows keep their `_id` and `_creationTime` so a seat links to its session,
 * answers and moves.
 */
import type { AccountExportCursor } from "@arcadeclub/core/account-export";
import type { PaginationResult } from "convex/server";
import type { Doc, Id, TableNames } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { type Db, type Rows, seatsOf } from "./accountDeletion";

type SessionId = Id<"gameSessions">;
type ParticipantId = Id<"sessionParticipants">;
type Exported = Record<string, unknown>;

/** The account's seats in one session: what its rows are checked against. */
export type Mine = {
	userId: string;
	seats: ReadonlySet<ParticipantId | string>;
};

/**
 * How a table's rows are read, and `view`, what of a row the export keeps
 * (null leaves it out). Method syntax keeps `view` assignable across tables
 * (bivariant parameters), so the registry can be iterated as one list.
 */
type ExportTreatment<T extends TableNames> =
	/** Rows the account owns, read by owner. */
	| { owned(db: Db, userId: string): Rows<T>; view: View<T> }
	/** The account's seats; every session it took part in hangs off them. */
	| { seats(db: Db, userId: string): Rows<T>; view: View<T> }
	/** The parent of the account's seats, exported once per session. */
	| { session: true; view: View<T> }
	/** Rows of a session the account took part in. */
	| { inSession(db: Db, sessionId: SessionId): Rows<T>; view: View<T> }
	/** Rows of one of the account's seats, read by seat. */
	| { ofSeat(db: Db, participantId: ParticipantId): Rows<T>; view: View<T> }
	/** Not exported; the reason says why. */
	| { excluded: string };

type View<T extends TableNames> = {
	bivarianceHack(row: Doc<T>, mine: Mine): Exported | null;
}["bivarianceHack"];

const isMine = (mine: Mine, participantId: string | undefined) =>
	participantId !== undefined && mine.seats.has(participantId);

/** Which of two colours the account played, if either. */
function colourOf<C extends string>(
	mine: Mine,
	seats: Partial<Record<C, string | undefined>>,
) {
	const colours = Object.keys(seats) as C[];
	return colours.find((colour) => isMine(mine, seats[colour]));
}

const timestamps = (row: {
	_id: string;
	_creationTime: number;
	sessionId: SessionId;
	createdAt?: number;
	updatedAt?: number;
}) => ({
	_id: row._id,
	_creationTime: row._creationTime,
	sessionId: row.sessionId,
	createdAt: row.createdAt,
	updatedAt: row.updatedAt,
});

/**
 * Every table states its treatment, so a new table fails typecheck until it
 * does (the deletion registry in `accountDeletion.ts` does the same).
 */
export const EXPORT: { [T in TableNames]: ExportTreatment<T> } = {
	gameSessions: {
		session: true,
		view: (session, mine) => {
			const hosted = session.hostUserId === mine.userId;
			return {
				_id: session._id,
				_creationTime: session._creationTime,
				gameType: session.gameType,
				status: session.status,
				joinMode: session.joinMode,
				// The host names the game, so only the account's own titles.
				title: hosted ? session.title : undefined,
				hosted,
				// `settings` is an open record and no game writes it yet, so none
				// of its keys are exported. Name a key here once a game writes one
				// that holds nothing personal.
				startedAt: session.startedAt,
				endedAt: session.endedAt,
				completedReason: session.completedReason,
				participantCount: session.participantCount,
				won: session.winnerParticipantIds?.some((id) => isMine(mine, id)),
			};
		},
	},
	sessionParticipants: {
		seats: seatsOf,
		view: (seat) => ({
			_id: seat._id,
			_creationTime: seat._creationTime,
			sessionId: seat.sessionId,
			displayName: seat.displayName,
			role: seat.role,
			seat: seat.seat,
			lastSeen: seat.lastSeen,
			kickedAt: seat.kickedAt,
		}),
	},
	contentDrafts: {
		owned: (db, userId) =>
			db
				.query("contentDrafts")
				.withIndex("by_owner", (q) => q.eq("ownerUserId", userId)),
		view: ({ ownerUserId: _owner, ...draft }) => draft,
	},
	quizSets: {
		// Sample sets have no owner, so the shared catalog is never matched.
		owned: (db, userId) =>
			db
				.query("quizSets")
				.withIndex("by_owner", (q) => q.eq("ownerUserId", userId)),
		view: ({ ownerUserId: _owner, ...set }) => set,
	},
	liveQuizStates: {
		// The quiz set may be someone else's, so not even its id.
		inSession: (db, sessionId) =>
			db
				.query("liveQuizStates")
				.withIndex("by_session", (q) => q.eq("sessionId", sessionId)),
		view: (state) => ({
			_id: state._id,
			_creationTime: state._creationTime,
			sessionId: state.sessionId,
			phase: state.phase,
			currentQuestionIndex: state.currentQuestionIndex,
		}),
	},
	liveQuizAnswers: {
		// By seat, so a big room's other answers are never read.
		ofSeat: (db, participantId) =>
			db
				.query("liveQuizAnswers")
				.withIndex("by_participant", (q) =>
					q.eq("participantId", participantId),
				),
		view: (answer, mine) =>
			isMine(mine, answer.participantId) ? { ...answer } : null,
	},
	backgammonGameStates: {
		inSession: (db, sessionId) =>
			db
				.query("backgammonGameStates")
				.withIndex("by_session", (q) => q.eq("sessionId", sessionId)),
		view: (state, mine) => ({
			...timestamps(state),
			phase: state.phase,
			colour: colourOf(mine, {
				white: state.whiteParticipantId,
				black: state.blackParticipantId,
			}),
			won: isMine(mine, state.winnerParticipantId),
		}),
	},
	backgammonMoves: {
		inSession: (db, sessionId) =>
			db
				.query("backgammonMoves")
				.withIndex("by_session", (q) => q.eq("sessionId", sessionId)),
		view: (move, mine) =>
			isMine(mine, move.participantId) ? { ...move } : null,
	},
	sudokuStates: {
		// A solo puzzle: the account's own board, without the solution.
		inSession: (db, sessionId) =>
			db
				.query("sudokuStates")
				.withIndex("by_session", (q) => q.eq("sessionId", sessionId)),
		view: ({ solution: _solution, ...state }) => state,
	},
	hitsterGameStates: {
		inSession: (db, sessionId) =>
			db
				.query("hitsterGameStates")
				.withIndex("by_session", (q) => q.eq("sessionId", sessionId)),
		view: (state, mine) => {
			// Co-op games share one timeline, which has no participant.
			const timeline = state.timelines.find(
				(line) =>
					isMine(mine, line.participantId) ||
					(state.mode === "coop" && line.participantId === undefined),
			);
			return {
				...timestamps(state),
				mode: state.mode,
				packId: state.packId,
				phase: state.phase,
				roundNumber: state.roundNumber,
				targetCards: state.targetCards,
				timeline: timeline?.cardIds,
				tokens: state.tokens.find((entry) => isMine(mine, entry.participantId))
					?.tokens,
				coopResult: state.coopResult,
				won: isMine(mine, state.winnerParticipantId),
			};
		},
	},
	chessGameStates: {
		inSession: (db, sessionId) =>
			db
				.query("chessGameStates")
				.withIndex("by_session", (q) => q.eq("sessionId", sessionId)),
		view: (state, mine) => ({
			...timestamps(state),
			phase: state.phase,
			colour: colourOf(mine, {
				white: state.whiteParticipantId,
				black: state.blackParticipantId,
			}),
			timeControl: state.timeControl,
			// Both sides' moves: the game record, not the opponent's personal data.
			moves: state.sanHistory,
			resultOutcome: state.resultOutcome,
			resultWinner: state.resultWinner,
			won: isMine(mine, state.winnerParticipantId),
		}),
	},
	connectFourStates: {
		inSession: (db, sessionId) =>
			db
				.query("connectFourStates")
				.withIndex("by_session", (q) => q.eq("sessionId", sessionId)),
		view: (state, mine) => ({
			...timestamps(state),
			phase: state.phase,
			colour: colourOf(mine, {
				red: state.redParticipantId,
				yellow: state.yellowParticipantId,
			}),
			board: state.board,
			resultOutcome: state.resultOutcome,
			resultWinner: state.resultWinner,
			won: isMine(mine, state.winnerParticipantId),
		}),
	},
	beatTheClockStates: {
		inSession: (db, sessionId) =>
			db
				.query("beatTheClockStates")
				.withIndex("by_session", (q) => q.eq("sessionId", sessionId)),
		view: (state, mine) => {
			const team = state.members.find((member) =>
				isMine(mine, member.participantId),
			)?.team;
			return {
				...timestamps(state),
				packId: state.packId,
				locale: state.locale,
				phase: state.phase,
				team,
				scores: state.scores,
				won: team !== undefined && state.winners.includes(team),
				wordsDescribed: state.described
					.filter((entry) => isMine(mine, entry.participantId))
					.reduce((sum, entry) => sum + entry.words, 0),
			};
		},
	},
	signalWordsStates: {
		// The account's team is its seat; the hidden key stays out.
		inSession: (db, sessionId) =>
			db
				.query("signalWordsStates")
				.withIndex("by_session", (q) => q.eq("sessionId", sessionId)),
		view: (state) => ({
			...timestamps(state),
			phase: state.phase,
			winnerTeam: state.winnerTeam,
		}),
	},
	cardGameStates: {
		// Engine state holds every hand and seat secret, so only the table.
		inSession: (db, sessionId) =>
			db
				.query("cardGameStates")
				.withIndex("by_session", (q) => q.eq("sessionId", sessionId)),
		view: (state, mine) => {
			const seat = state.seats.findIndex((entry) =>
				isMine(mine, entry.participantId),
			);
			return {
				...timestamps(state),
				gameId: state.gameId,
				options: state.options,
				status: state.status,
				seat: seat >= 0 ? seat : undefined,
			};
		},
	},
	bluffDiceStates: {
		// Hands stay out: other players' dice, and the account's own mid-round.
		inSession: (db, sessionId) =>
			db
				.query("bluffDiceStates")
				.withIndex("by_session", (q) => q.eq("sessionId", sessionId)),
		view: (state, mine) => ({
			...timestamps(state),
			phase: state.phase,
			roundNumber: state.roundNumber,
			claims: state.claimHistory
				.filter((claim) => isMine(mine, claim.byParticipantId))
				.map(({ quantity, face }) => ({ quantity, face })),
			won: isMine(mine, state.winnerParticipantId),
		}),
	},
};

type AnyTreatment = ExportTreatment<TableNames>;
type Entry<K> = [TableNames, Extract<AnyTreatment, K>];

const ENTRIES = Object.entries(EXPORT) as [TableNames, AnyTreatment][];
const pick = <K extends string>(key: K) =>
	ENTRIES.filter(
		(entry): entry is Entry<Record<K, unknown>> => key in entry[1],
	);

const OWNED = pick("owned");
const [SEATS] = pick("seats");
const [SESSION] = pick("session");
const IN_SESSION = pick("inSession");
const OF_SEAT = pick("ofSeat");

/**
 * What a page reads: each owned table in turn, then the seats. A query may
 * paginate only once, so a page reads one of them.
 */
const SOURCES = [...OWNED.map(([table]) => table), SEATS[0]];

/** Owned rows per page; quiz sets with their questions are the largest. */
const OWNED_PAGE = 50;
/**
 * Seats per page. Each brings its session, that session's seats and game
 * rows, and its own answers, so a page of a busy host's rooms stays far
 * inside Convex's read limits (`accountExport.test.ts` measures it).
 */
const SEATS_PAGE = 10;

export type ExportPage = {
	tables: Partial<Record<TableNames, Exported[]>>;
	next: AccountExportCursor | null;
};

/**
 * One page of the account's export, starting at `cursor` (null for the
 * first). Clients repeat it with `next` until it is null.
 */
export async function exportPage(
	ctx: QueryCtx,
	userId: string,
	cursor: AccountExportCursor | null,
): Promise<ExportPage> {
	const at = cursor ?? { source: 0, page: null };
	const table = SOURCES[at.source];
	if (table === undefined) return { tables: {}, next: null };
	const tables: ExportPage["tables"] = {};
	const add = (name: TableNames, row: Exported | null) => {
		if (!row) return;
		const rows = tables[name] ?? [];
		rows.push(row);
		tables[name] = rows;
	};
	const page = { cursor: at.page, numItems: OWNED_PAGE };
	let result: PaginationResult<unknown>;
	const owned = OWNED.find(([name]) => name === table);
	if (owned) {
		const [name, treatment] = owned;
		const rows = await treatment.owned(ctx.db, userId).paginate(page);
		const mine: Mine = { userId, seats: new Set() };
		for (const row of rows.page) add(name, treatment.view(row, mine));
		result = rows;
	} else {
		const seats = await SEATS[1]
			.seats(ctx.db, userId)
			.paginate({ ...page, numItems: SEATS_PAGE });
		result = seats;
		for (const seat of seats.page as Doc<"sessionParticipants">[]) {
			add(
				SEATS[0],
				SEATS[1].view(seat, { userId, seats: new Set([seat._id]) }),
			);
			await addSession(ctx.db, userId, seat, add);
		}
	}
	const next: AccountExportCursor | null = !result.isDone
		? { source: at.source, page: result.continueCursor }
		: at.source + 1 < SOURCES.length
			? { source: at.source + 1, page: null }
			: null;
	return { tables, next };
}

/**
 * The session behind a seat and its game rows, exported with the account's
 * first seat in it so a session it holds several seats in appears once.
 */
async function addSession(
	db: Db,
	userId: string,
	seat: Doc<"sessionParticipants">,
	add: (table: TableNames, row: Exported | null) => void,
) {
	const session = await db.get(seat.sessionId);
	if (!session) return;
	const own = (
		await db
			.query("sessionParticipants")
			.withIndex("by_session", (q) => q.eq("sessionId", session._id))
			.collect()
	).filter((participant) => participant.userId === userId);
	if (own[0]?._id !== seat._id) return;
	const mine: Mine = { userId, seats: new Set(own.map(({ _id }) => _id)) };
	add(SESSION[0], SESSION[1].view(session, mine));
	for (const [table, treatment] of IN_SESSION) {
		for (const row of await treatment.inSession(db, session._id).collect()) {
			add(table, treatment.view(row, mine));
		}
	}
	for (const [table, treatment] of OF_SEAT) {
		for (const { _id } of own) {
			for (const row of await treatment.ofSeat(db, _id).collect()) {
				add(table, treatment.view(row, mine));
			}
		}
	}
}
