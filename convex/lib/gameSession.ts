import type { GameErrorCode } from "@arcadeclub/core/errors";
import type { GameType, SessionGameType } from "@arcadeclub/core/games";
import { type ObjectType, v } from "convex/values";
import type { Doc, Id, TableNames } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { getOptionalUserId } from "./auth";
import { gameError } from "./errors";

type ReadCtx = QueryCtx | MutationCtx;
type SessionId = Id<"gameSessions">;
type ParticipantId = Id<"sessionParticipants">;

/**
 * The only map from a game to its state table. Word Links and Squad Surge play
 * locally, so they have none.
 */
const STATE_TABLES = {
	backgammon: "backgammonGameStates",
	"bluff-dice": "bluffDiceStates",
	"card-games": "cardGameStates",
	chess: "chessGameStates",
	"connect-four": "connectFourStates",
	hitster: "hitsterGameStates",
	"live-quiz": "liveQuizStates",
	"signal-words": "signalWordsStates",
	sudoku: "sudokuStates",
} as const satisfies Record<SessionGameType, TableNames>;

export type StateTable = (typeof STATE_TABLES)[SessionGameType];

/** A game's state row, or null. Reads no session, so a query can use it too. */
export async function findGameState<G extends SessionGameType>(
	ctx: ReadCtx,
	gameType: G,
	sessionId: SessionId,
): Promise<Doc<(typeof STATE_TABLES)[G]> | null> {
	// The query builder cannot follow a table name that is still a type
	// parameter. Every state table has this same index.
	const state = await ctx.db
		.query(STATE_TABLES[gameType] as "sudokuStates")
		.withIndex("by_session", (q) => q.eq("sessionId", sessionId))
		.unique();
	return state as Doc<(typeof STATE_TABLES)[G]> | null;
}

/**
 * A participant row as anyone in the session may see it. The guest id stays
 * out: it is a guest's proof of their seats (see `requireOwnParticipant`).
 */
export function publicParticipants(participants: Doc<"sessionParticipants">[]) {
	return participants.map(
		({ guestId: _guestId, ...participant }) => participant,
	);
}

/**
 * What every `getBundle` starts from: the session, everyone in it and the
 * game's state. Null when the session does not exist.
 */
export async function loadBundle<G extends SessionGameType>(
	ctx: ReadCtx,
	gameType: G,
	sessionId: SessionId,
) {
	const session = await ctx.db.get(sessionId);
	if (!session) {
		return null;
	}
	const participants = publicParticipants(
		await listParticipants(ctx, sessionId),
	);
	const state = await findGameState(ctx, gameType, sessionId);
	return { session, participants, state };
}

/** The session if it exists and plays this game; `notFound` otherwise. */
export async function loadSession(
	ctx: ReadCtx,
	gameType: GameType,
	sessionId: SessionId,
	notFound: GameErrorCode = "gameNotFound",
) {
	const session = await ctx.db.get(sessionId);
	if (!session || session.gameType !== gameType) {
		throw gameError(notFound);
	}
	return session;
}

/** Session and state, both required: what nearly every game mutation starts with. */
export async function loadGame<G extends SessionGameType>(
	ctx: ReadCtx,
	gameType: G,
	sessionId: SessionId,
) {
	const session = await loadSession(ctx, gameType, sessionId);
	const state = await findGameState(ctx, gameType, sessionId);
	if (!state) {
		throw gameError("gameNotFound");
	}
	return { session, state };
}

/** Every row of a session: watchers and kicked players included. */
export async function listParticipants(ctx: ReadCtx, sessionId: SessionId) {
	return await ctx.db
		.query("sessionParticipants")
		.withIndex("by_session", (q) => q.eq("sessionId", sessionId))
		.collect();
}

/** Everyone not kicked, watchers included. */
async function listActivePlayers(ctx: ReadCtx, sessionId: SessionId) {
	const participants = await listParticipants(ctx, sessionId);
	return participants.filter((participant) => !participant.kickedAt);
}

/**
 * Everyone but watchers, oldest first. A kicked player is still listed: bluff
 * dice and hitster deal them in, and their tests pin that.
 */
export async function listPlayersIncludingKicked(
	ctx: ReadCtx,
	sessionId: SessionId,
) {
	const participants = await listParticipants(ctx, sessionId);
	return participants.filter((participant) => participant.role !== "watcher");
}

/**
 * A participant of this session who has not been kicked. Proves nothing about
 * the caller, since participant ids are public: a mutation acting for a seat
 * uses `requireOwnParticipant`.
 */
export async function requireParticipant(
	ctx: ReadCtx,
	sessionId: SessionId,
	participantId: ParticipantId,
	notInSession: GameErrorCode = "notInGame",
) {
	const participant = await ctx.db.get(participantId);
	if (
		!participant ||
		participant.sessionId !== sessionId ||
		participant.kickedAt
	) {
		throw gameError(notInSession);
	}
	return participant;
}

/**
 * What every call acting for a seat takes: the seat, and the guest id that
 * proves a guest's seat. A signed-in player's account is their proof.
 */
export const seatArgs = {
	sessionId: v.id("gameSessions"),
	participantId: v.id("sessionParticipants"),
	guestId: v.optional(v.string()),
};

export type SeatArgs = ObjectType<typeof seatArgs>;

/**
 * Whether the caller is this participant: signed in as its account, or for a
 * guest's row, holding its guest id. A row with neither belongs to nobody.
 */
export async function isCaller(
	ctx: ReadCtx,
	participant: Doc<"sessionParticipants">,
	guestId: string | undefined,
) {
	if (participant.userId) {
		return participant.userId === (await getOptionalUserId(ctx));
	}
	return participant.guestId !== undefined && participant.guestId === guestId;
}

/** The caller's own participant row in this session, not kicked; null otherwise. */
export async function findOwnParticipant(ctx: ReadCtx, seat: SeatArgs) {
	const participant = await ctx.db.get(seat.participantId);
	if (
		!participant ||
		participant.sessionId !== seat.sessionId ||
		participant.kickedAt ||
		!(await isCaller(ctx, participant, seat.guestId))
	) {
		return null;
	}
	return participant;
}

/**
 * The caller's own participant row in this session. Someone else's seat looks
 * exactly like one that is not in the game.
 */
export async function requireOwnParticipant(
	ctx: ReadCtx,
	seat: SeatArgs,
	notInSession: GameErrorCode = "notInGame",
) {
	const participant = await findOwnParticipant(ctx, seat);
	if (!participant) {
		throw gameError(notInSession);
	}
	return participant;
}

/** Moves a session into play. Keeps the first start time; an active one stays as it is. */
export async function startSession(
	ctx: MutationCtx,
	session: Doc<"gameSessions">,
	now: number,
) {
	if (session.status === "active") {
		return;
	}
	await ctx.db.patch(session._id, {
		status: "active",
		startedAt: session.startedAt ?? now,
		endedAt: undefined,
	});
}

/**
 * Writes a game's terminal state and completes its session together, so neither
 * can happen without the other. Winners may include an empty seat.
 */
export async function finishSession<T extends StateTable>(
	ctx: MutationCtx,
	state: { _id: Id<T>; sessionId: SessionId },
	terminalPatch: Partial<Doc<T>>,
	outcome: { now: number; winners: (ParticipantId | undefined)[] },
) {
	await ctx.db.patch(state._id, terminalPatch as never);
	const active = await listActivePlayers(ctx, state.sessionId);
	await ctx.db.patch(state.sessionId, {
		status: "completed",
		endedAt: outcome.now,
		completedReason: "finished",
		participantCount: active.length,
		winnerParticipantIds: outcome.winners.filter((id) => id !== undefined),
	});
}

/** Reverts a completed session back to active play (in-place rematch). */
export async function reopenSession(ctx: MutationCtx, sessionId: SessionId) {
	await ctx.db.patch(sessionId, {
		status: "active",
		endedAt: undefined,
		completedReason: undefined,
		winnerParticipantIds: undefined,
	});
}

/** The one shape of a new participant row. A signed-in caller stores no guest id. */
export async function insertParticipant(
	ctx: MutationCtx,
	row: {
		sessionId: SessionId;
		userId: string | undefined;
		guestId: string | undefined;
		displayName: string;
		role: Doc<"sessionParticipants">["role"];
		seat?: string;
	},
) {
	return await ctx.db.insert("sessionParticipants", {
		...row,
		guestId: row.userId ? undefined : row.guestId,
		connected: true,
		lastSeen: Date.now(),
	});
}

/** A participant is back, or still here. */
export async function markConnected(
	ctx: MutationCtx,
	participantId: ParticipantId,
) {
	await ctx.db.patch(participantId, { connected: true, lastSeen: Date.now() });
}

/** Every kick looks the same on the row, whatever else the game does about it. */
export async function kickParticipant(
	ctx: MutationCtx,
	participantId: ParticipantId,
) {
	await ctx.db.patch(participantId, { kickedAt: Date.now(), connected: false });
}

/**
 * Whether this seat is the host's. The seat must already be proven the
 * caller's own (`requireOwnParticipant`), or held with a card seat secret.
 */
export function requireHostByParticipantId(
	session: Doc<"gameSessions">,
	participantId: ParticipantId,
	notHost: GameErrorCode = "hostOnly",
) {
	if (session.hostParticipantId !== participantId) {
		throw gameError(notHost);
	}
}

/** The session, when the caller holds its host's seat. */
export async function requireHost(ctx: ReadCtx, seat: SeatArgs) {
	const session = await ctx.db.get(seat.sessionId);
	if (!session) {
		throw gameError("gameNotFound");
	}
	await requireParticipant(ctx, seat.sessionId, seat.participantId);
	requireHostByParticipantId(session, seat.participantId);
	await requireOwnParticipant(ctx, seat, "hostOnly");
	return session;
}
