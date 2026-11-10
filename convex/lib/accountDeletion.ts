/**
 * What deleting an account does to every table. Players in finished games keep
 * their history: in a session someone else played, the account's seat is
 * anonymised rather than deleted, because other players' game state, moves and
 * results point at it. A session nobody else ever joined is the account's
 * alone and goes entirely. Shared catalogs (sample quiz sets) are untouched.
 */
import {
	GAME_SESSION_POLICY,
	type SessionGameType,
} from "@arcadeclub/core/games";
import type { NamedTableInfo, Query } from "convex/server";
import type { DataModel, Doc, Id, TableNames } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { findGameState, listParticipants } from "./gameSession";

type Db = QueryCtx["db"];
type SessionId = Id<"gameSessions">;
type Rows<T extends TableNames> = Query<NamedTableInfo<DataModel, T>>;

type Treatment<T extends TableNames> =
	/** Rows only this account owns and nobody else reads: deleted. */
	| { owned: (db: Db, userId: string) => Rows<T> }
	/** The account's seats: see `eraseSeat`. */
	| { seats: (db: Db, userId: string) => Rows<T> }
	/**
	 * Rows of one session, holding participant ids but nothing personal of
	 * their own: deleted with a session only this account played, kept in
	 * anyone else's under the anonymised seat.
	 */
	| { inSession: (db: Db, sessionId: SessionId) => Rows<T> }
	/** Not read through an owner; the reason says how it is still covered. */
	| { excluded: string };

function seatsOf(db: Db, userId: string) {
	return db
		.query("sessionParticipants")
		.withIndex("by_user", (q) => q.eq("userId", userId));
}

/**
 * Every table states its treatment, so a new table fails typecheck until it
 * does.
 */
const DELETION: { [T in TableNames]: Treatment<T> } = {
	gameSessions: {
		excluded:
			"The parent of every seat: `hostUserId` is cleared with the host's seat, and a session only this account played is deleted with it.",
	},
	sessionParticipants: { seats: seatsOf },
	contentDrafts: {
		owned: (db, userId) =>
			db
				.query("contentDrafts")
				.withIndex("by_owner", (q) => q.eq("ownerUserId", userId)),
	},
	quizSets: {
		// Sample sets have no owner, so the shared catalog is never matched.
		owned: (db, userId) =>
			db
				.query("quizSets")
				.withIndex("by_owner", (q) => q.eq("ownerUserId", userId)),
	},
	liveQuizStates: {
		inSession: (db, sessionId) =>
			db
				.query("liveQuizStates")
				.withIndex("by_session", (q) => q.eq("sessionId", sessionId)),
	},
	liveQuizAnswers: {
		inSession: (db, sessionId) =>
			db
				.query("liveQuizAnswers")
				.withIndex("by_session", (q) => q.eq("sessionId", sessionId)),
	},
	backgammonGameStates: {
		inSession: (db, sessionId) =>
			db
				.query("backgammonGameStates")
				.withIndex("by_session", (q) => q.eq("sessionId", sessionId)),
	},
	backgammonMoves: {
		inSession: (db, sessionId) =>
			db
				.query("backgammonMoves")
				.withIndex("by_session", (q) => q.eq("sessionId", sessionId)),
	},
	sudokuStates: {
		inSession: (db, sessionId) =>
			db
				.query("sudokuStates")
				.withIndex("by_session", (q) => q.eq("sessionId", sessionId)),
	},
	hitsterGameStates: {
		inSession: (db, sessionId) =>
			db
				.query("hitsterGameStates")
				.withIndex("by_session", (q) => q.eq("sessionId", sessionId)),
	},
	chessGameStates: {
		inSession: (db, sessionId) =>
			db
				.query("chessGameStates")
				.withIndex("by_session", (q) => q.eq("sessionId", sessionId)),
	},
	connectFourStates: {
		inSession: (db, sessionId) =>
			db
				.query("connectFourStates")
				.withIndex("by_session", (q) => q.eq("sessionId", sessionId)),
	},
	signalWordsStates: {
		inSession: (db, sessionId) =>
			db
				.query("signalWordsStates")
				.withIndex("by_session", (q) => q.eq("sessionId", sessionId)),
	},
	cardGameStates: {
		// A seat's secret is a random token, not personal data; once the seat
		// is anonymised the table's silent-seat takeover lets others go on.
		inSession: (db, sessionId) =>
			db
				.query("cardGameStates")
				.withIndex("by_session", (q) => q.eq("sessionId", sessionId)),
	},
	bluffDiceStates: {
		inSession: (db, sessionId) =>
			db
				.query("bluffDiceStates")
				.withIndex("by_session", (q) => q.eq("sessionId", sessionId)),
	},
};

const TREATMENTS: Treatment<TableNames>[] = Object.values(DELETION);
const OWNED = TREATMENTS.flatMap((t) => ("owned" in t ? [t.owned] : []));
const IN_SESSION = TREATMENTS.flatMap((t) =>
	"inSession" in t ? [t.inSession] : [],
);

/**
 * The name an anonymised seat shows other players. A symbol rather than a
 * word, because the backend stores no display text (clients render names as
 * they are).
 */
export const DELETED_PLAYER_NAME = "—";

/** How long after its last sign of play a game with others blocks deletion. */
export const ACTIVE_GAME_WINDOW_MINUTES = 30;
const ACTIVE_GAME_WINDOW_MS = ACTIVE_GAME_WINDOW_MINUTES * 60_000;

function isSessionGame(
	gameType: Doc<"gameSessions">["gameType"],
): gameType is SessionGameType {
	return gameType in GAME_SESSION_POLICY;
}

/**
 * Whether the account holds a seat in a game other players are in right now:
 * open, and played, joined or started within the window. Deleting then would
 * pull the seat out from under them. An older open game counts as abandoned,
 * since games have no way to leave, and must not block deletion forever.
 */
export async function inActiveGame(
	ctx: QueryCtx | MutationCtx,
	userId: string,
	now: number,
) {
	const seats = await seatsOf(ctx.db, userId).collect();
	for (const seat of seats) {
		if (seat.kickedAt || seat.role === "watcher") continue;
		const session = await ctx.db.get(seat.sessionId);
		if (!session || (session.status !== "lobby" && session.status !== "active"))
			continue;
		const others = (await listParticipants(ctx, session._id)).filter(
			(participant) =>
				participant.userId !== userId &&
				!participant.kickedAt &&
				participant.role !== "watcher",
		);
		if (others.length === 0) continue;
		const state = isSessionGame(session.gameType)
			? await findGameState(ctx, session.gameType, session._id)
			: null;
		const lastActivity = Math.max(
			session._creationTime,
			session.startedAt ?? 0,
			state && "updatedAt" in state ? state.updatedAt : 0,
			...others.map((participant) => participant.lastSeen),
		);
		if (now - lastActivity < ACTIVE_GAME_WINDOW_MS) return true;
	}
	return false;
}

/**
 * Deletes or anonymises at most about `budget` rows of the account's data.
 * Returns whether nothing is left; callers repeat until it is. Each step
 * leaves the data consistent, so an interrupted run resumes where it stopped.
 */
export async function deleteAccountData(
	ctx: MutationCtx,
	userId: string,
	budget: number,
) {
	let remaining = budget;
	for (const rows of OWNED) {
		const batch = await rows(ctx.db, userId).take(remaining + 1);
		for (const row of batch.slice(0, remaining)) await ctx.db.delete(row._id);
		if (batch.length > remaining) return false;
		remaining -= batch.length;
	}
	while (remaining > 0) {
		const seat = await seatsOf(ctx.db, userId).first();
		if (!seat) return true;
		const used = await eraseSeat(ctx, userId, seat, remaining);
		if (used === null) return false;
		remaining -= used;
	}
	return (await seatsOf(ctx.db, userId).first()) === null;
}

/**
 * One seat of the account. A session where every seat is the account's is
 * deleted with all its rows. Anywhere else the account's seats keep their ids
 * (and with them every move, answer and result) but lose the account and the
 * name, and a session it hosted forgets the host's account. Returns the rows
 * written, or null when the budget ran out part way.
 */
async function eraseSeat(
	ctx: MutationCtx,
	userId: string,
	seat: Doc<"sessionParticipants">,
	budget: number,
): Promise<number | null> {
	const session = await ctx.db.get(seat.sessionId);
	if (!session) {
		await ctx.db.delete(seat._id);
		return 1;
	}
	const participants = await listParticipants(ctx, session._id);
	if (participants.some((participant) => participant.userId !== userId)) {
		const own = participants.filter(
			(participant) => participant.userId === userId,
		);
		for (const participant of own) {
			await ctx.db.patch(participant._id, {
				userId: undefined,
				guestId: undefined,
				displayName: DELETED_PLAYER_NAME,
				connected: false,
			});
		}
		if (session.hostUserId === userId) {
			await ctx.db.patch(session._id, { hostUserId: undefined });
		}
		return own.length + 1;
	}
	let remaining = budget;
	for (const rows of IN_SESSION) {
		const batch = await rows(ctx.db, session._id).take(remaining + 1);
		for (const row of batch.slice(0, remaining)) await ctx.db.delete(row._id);
		if (batch.length > remaining) return null;
		remaining -= batch.length;
	}
	for (const participant of participants) await ctx.db.delete(participant._id);
	await ctx.db.delete(session._id);
	return budget - remaining + participants.length + 1;
}
