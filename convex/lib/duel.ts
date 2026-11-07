import type { BackgammonColor } from "@arcadeclub/core/backgammon";
import type { ConnectFourColor } from "@arcadeclub/core/connect-four";
import type { GameErrorCode } from "@arcadeclub/core/errors";
import type { ChessColor } from "@arcadeclub/chess/enums";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { gameError } from "./errors";
import { findGameState } from "./gameSession";

type ParticipantId = Id<"sessionParticipants">;
type DuelGame = "backgammon" | "chess" | "connect-four";

/** What differs between the two-seat games. Everything else here is shared. */
export type Duel<Seat extends string> = {
	gameType: DuelGame;
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

/** A client reads backgammon's `ready`, through `phase === "waiting"`. */
export const BACKGAMMON_DUEL: Duel<BackgammonColor> = {
	gameType: "backgammon",
	seats: ["white", "black"],
	errors: {
		notSeated: "notYourTurn",
		rematchNotSeated: "playersOnlyRematch",
		waitingForSecondPlayer: "waitingForBothPlayers",
	},
	onFull: { phase: "ready" },
};

export const CHESS_DUEL: Duel<ChessColor> = {
	gameType: "chess",
	seats: ["white", "black"],
	errors: {
		notSeated: "notSeated",
		rematchNotSeated: "notSeated",
		waitingForSecondPlayer: "waitingForOpponent",
	},
};

export const CONNECT_FOUR_DUEL: Duel<ConnectFourColor> = {
	gameType: "connect-four",
	seats: ["red", "yellow"],
	errors: {
		notSeated: "notSeated",
		rematchNotSeated: "notSeated",
		waitingForSecondPlayer: "waitingForOpponent",
	},
};

type SeatField<Seat extends string> = `${Seat}ParticipantId`;

/** The seat columns of a state row, as `seat` names them: `whiteParticipantId`. */
type SeatColumns<Seat extends string> = {
	[Field in SeatField<Seat>]?: ParticipantId;
};

type TurnState<Seat extends string> = SeatColumns<Seat> & {
	phase: string;
	activeColor: Seat;
};

export function occupant<Seat extends string>(
	state: SeatColumns<Seat>,
	seat: Seat,
) {
	const field = `${seat}ParticipantId` as SeatField<Seat>;
	return state[field] as ParticipantId | undefined;
}

export function seatOf<Seat extends string>(
	duel: Duel<Seat>,
	state: SeatColumns<NoInfer<Seat>>,
	participantId: ParticipantId,
) {
	return duel.seats.find((seat) => occupant(state, seat) === participantId);
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
	if (state.phase === "finished") {
		throw gameError("gameAlreadyFinished");
	}
	if (duel.seats.some((seat) => !occupant(state, seat))) {
		throw gameError(duel.errors.waitingForSecondPlayer);
	}
	const seat = requireSeat(duel, state, participantId);
	if (state.activeColor !== seat) {
		throw gameError("notYourTurn");
	}
	return seat;
}

export function requireRematch<Seat extends string>(
	duel: Duel<Seat>,
	state: SeatColumns<NoInfer<Seat>> & { phase: string },
	participantId: ParticipantId,
) {
	if (state.phase !== "finished") {
		throw gameError("currentGameNotFinished");
	}
	requireSeat(duel, state, participantId, duel.errors.rematchNotSeated);
}

export function winnerOf<Seat extends string>(
	state: SeatColumns<Seat>,
	winner: Seat | undefined,
) {
	return winner ? occupant(state, winner) : undefined;
}

/** Swaps both players' stored seats; returns the state columns to write with it. */
export async function swapSeats<Seat extends string>(
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
