import { CHESS_COLORS, type ChessColor } from "@arcadeclub/chess/enums";
import {
	BACKGAMMON_COLORS,
	type BackgammonColor,
} from "@arcadeclub/core/backgammon";
import {
	CONNECT_FOUR_COLORS,
	type ConnectFourColor,
} from "@arcadeclub/core/connect-four";
import {
	type SeatColumns as CoreSeatColumns,
	seatOf as coreSeatOf,
	type DuelTurnBlock,
	duelTurn,
	occupant,
	opponent,
} from "@arcadeclub/core/duel";
import type { GameErrorCode } from "@arcadeclub/core/errors";
import type { SessionGameType } from "@arcadeclub/core/games";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { gameError } from "./errors";
import {
	findGameState,
	finishSession,
	reopenSession,
	type StateTable,
} from "./gameSession";

type ParticipantId = Id<"sessionParticipants">;

/** What differs between the two-seat games. Everything else here is shared. */
export type Duel<Seat extends string> = {
	gameType: SessionGameType;
	/** In the order a joiner fills them. */
	seats: readonly [Seat, Seat];
	errors: {
		notSeated: GameErrorCode;
		rematchNotSeated: GameErrorCode;
		waitingForSecondPlayer: GameErrorCode;
	};
	/** Written when the second player takes a seat. */
	onFull?: { phase: "ready" };
};

/** Installed mobile builds show the invite while `phase === "waiting"`, so a full table must leave it. */
export const BACKGAMMON_DUEL = {
	gameType: "backgammon",
	seats: BACKGAMMON_COLORS,
	errors: {
		notSeated: "notYourTurn",
		rematchNotSeated: "playersOnlyRematch",
		waitingForSecondPlayer: "waitingForBothPlayers",
	},
	onFull: { phase: "ready" },
} satisfies Duel<BackgammonColor>;

export const CHESS_DUEL = {
	gameType: "chess",
	seats: CHESS_COLORS,
	errors: {
		notSeated: "notSeated",
		rematchNotSeated: "notSeated",
		waitingForSecondPlayer: "waitingForOpponent",
	},
} satisfies Duel<ChessColor>;

export const CONNECT_FOUR_DUEL = {
	gameType: "connect-four",
	seats: CONNECT_FOUR_COLORS,
	errors: {
		notSeated: "notSeated",
		rematchNotSeated: "notSeated",
		waitingForSecondPlayer: "waitingForOpponent",
	},
} satisfies Duel<ConnectFourColor>;

/** Every two-seat game. */
export const DUELS = [BACKGAMMON_DUEL, CHESS_DUEL, CONNECT_FOUR_DUEL] as const;
export type DuelGame = (typeof DUELS)[number]["gameType"];

type SeatColumns<Seat extends string> = CoreSeatColumns<Seat, ParticipantId>;

type TurnState<Seat extends string> = SeatColumns<Seat> & {
	phase: string;
	activeColor: Seat;
};

function seatOf<Seat extends string>(
	duel: Duel<Seat>,
	state: SeatColumns<NoInfer<Seat>>,
	participantId: ParticipantId,
) {
	return coreSeatOf(duel.seats, state, participantId);
}

/**
 * Seats the host as the game is created: in the first seat unless they chose
 * another. Returns the state column to insert with it.
 */
export async function seatHost<Seat extends string>(
	ctx: MutationCtx,
	duel: Duel<Seat>,
	participantId: ParticipantId,
	seat: NoInfer<Seat> = duel.seats[0],
) {
	await ctx.db.patch(participantId, { seat });
	return { [`${seat}ParticipantId`]: participantId } as SeatColumns<Seat>;
}

export function requireSeat<Seat extends string>(
	duel: Duel<Seat>,
	state: SeatColumns<NoInfer<Seat>>,
	participantId: ParticipantId,
	notSeated: GameErrorCode = duel.errors.notSeated,
): Seat {
	const seat = seatOf(duel, state, participantId);
	if (!seat) {
		throw gameError(notSeated);
	}
	return seat;
}

/** The seat of the player allowed to act now. */
export function requireTurn<Seat extends string>(
	duel: Duel<Seat>,
	state: TurnState<NoInfer<Seat>>,
	participantId: ParticipantId,
): Seat {
	const turn = duelTurn(duel.seats, state, participantId);
	if (!turn.ok) {
		const errors: Record<DuelTurnBlock, GameErrorCode> = {
			finished: "gameAlreadyFinished",
			waitingForOpponent: duel.errors.waitingForSecondPlayer,
			notSeated: duel.errors.notSeated,
			notYourTurn: "notYourTurn",
		};
		throw gameError(errors[turn.blocked]);
	}
	return turn.seat;
}

function requireRematch<Seat extends string>(
	duel: Duel<Seat>,
	state: SeatColumns<NoInfer<Seat>> & { phase: string },
	participantId: ParticipantId,
) {
	if (state.phase !== "finished") {
		throw gameError("currentGameNotFinished");
	}
	requireSeat(duel, state, participantId, duel.errors.rematchNotSeated);
}

/** The seat a resignation hands the game to. */
export function requireResign<Seat extends string>(
	duel: Duel<Seat>,
	state: SeatColumns<NoInfer<Seat>> & { phase: string },
	participantId: ParticipantId,
) {
	if (state.phase === "finished") {
		throw gameError("gameAlreadyFinished");
	}
	return opponent(duel.seats, requireSeat(duel, state, participantId));
}

type DuelStateRow<Seat extends string> = SeatColumns<Seat> & {
	_id: Id<StateTable>;
	sessionId: Id<"gameSessions">;
	phase: string;
};

/**
 * Ends a two-seat game: writes `terminal` with the finished phase and the
 * winning seat's participant (none for a draw), and completes the session.
 */
export async function finishDuel<
	Seat extends string,
	State extends DuelStateRow<Seat>,
>(
	ctx: MutationCtx,
	state: State,
	winner: Seat | undefined,
	terminal: Partial<NoInfer<State>>,
	now: number,
) {
	const winnerParticipantId = winner
		? occupant<Seat, ParticipantId>(state, winner)
		: undefined;
	await finishSession(
		ctx,
		state,
		{
			...terminal,
			phase: "finished",
			winnerParticipantId,
			updatedAt: now,
		},
		{ now, winners: [winnerParticipantId] },
	);
}

/**
 * Starts the next game at a finished table: the players swap seats, the state
 * takes `fresh(now)` with no winner, and the session is open again.
 */
export async function rematchDuel<
	Seat extends string,
	State extends DuelStateRow<Seat>,
>(
	ctx: MutationCtx,
	duel: Duel<Seat>,
	state: State,
	participantId: ParticipantId,
	fresh: (now: number) => Partial<NoInfer<State>>,
) {
	requireRematch(duel, state, participantId);
	const now = Date.now();
	const seats = await swapSeats(ctx, duel, state);
	await ctx.db.patch(state._id, {
		...fresh(now),
		...seats,
		winnerParticipantId: undefined,
		updatedAt: now,
	} as never);
	await reopenSession(ctx, state.sessionId);
}

/** Swaps both players' stored seats; returns the state columns to write with it. */
async function swapSeats<Seat extends string>(
	ctx: MutationCtx,
	duel: Duel<Seat>,
	state: SeatColumns<NoInfer<Seat>>,
) {
	const [first, second] = duel.seats;
	const nowFirst = occupant(state, second);
	const nowSecond = occupant(state, first);
	if (nowFirst) {
		await ctx.db.patch(nowFirst, { seat: first });
	}
	if (nowSecond) {
		await ctx.db.patch(nowSecond, { seat: second });
	}
	return {
		[`${first}ParticipantId`]: nowFirst,
		[`${second}ParticipantId`]: nowSecond,
	} as SeatColumns<Seat>;
}

/**
 * Puts a share-link joiner in the first free seat, or among the watchers when
 * both are taken. A player coming back keeps their seat. A session whose state
 * does not exist yet seats nobody.
 */
export async function seatChallenger<Seat extends string>(
	ctx: MutationCtx,
	duel: Duel<Seat>,
	session: Doc<"gameSessions">,
	participantId: ParticipantId,
) {
	const row = await findGameState(ctx, duel.gameType, session._id);
	if (!row) {
		return;
	}
	const state = row as unknown as SeatColumns<Seat>;
	if (seatOf(duel, state, participantId)) {
		return;
	}
	const seat = duel.seats.find((candidate) => !occupant(state, candidate));
	if (!seat) {
		await ctx.db.patch(participantId, { role: "watcher", seat: undefined });
		return;
	}
	await ctx.db.patch(participantId, { seat });
	const filled = duel.seats.every(
		(candidate) => candidate === seat || occupant(state, candidate),
	);
	await ctx.db.patch(row._id, {
		[`${seat}ParticipantId`]: participantId,
		...(filled ? duel.onFull : {}),
		updatedAt: Date.now(),
	} as never);
}
