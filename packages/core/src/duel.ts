/**
 * The two-seat games (backgammon, chess, connect four) store each seat's
 * participant in a column named after the seat: `whiteParticipantId`.
 */

type SeatField<Seat extends string> = `${Seat}ParticipantId`;

/** The seat columns of a state row. */
export type SeatColumns<Seat extends string, Id extends string = string> = {
	[Field in SeatField<Seat>]?: Id;
};

/** Who sits in `seat`, if anyone. */
export function occupant<Seat extends string, Id extends string>(
	state: SeatColumns<Seat, Id>,
	seat: Seat,
): Id | undefined {
	return state[`${seat}ParticipantId` as SeatField<Seat>];
}

/** The seat this participant holds, if any. */
export function seatOf<Seat extends string, Id extends string>(
	seats: readonly Seat[],
	state: SeatColumns<NoInfer<Seat>, Id>,
	participantId: NoInfer<Id> | null | undefined,
): Seat | undefined {
	if (!participantId) {
		return undefined;
	}
	return seats.find((seat) => occupant(state, seat) === participantId);
}

/** The other seat. */
export function opponent<Seat extends string>(
	seats: readonly [Seat, Seat],
	seat: Seat,
): Seat {
	return seat === seats[0] ? seats[1] : seats[0];
}

/** Why a participant may not move now, in the order the server checks. */
export type DuelTurnBlock =
	| "finished"
	| "waitingForOpponent"
	| "notSeated"
	| "notYourTurn";

type DuelTurnState<Seat extends string, Id extends string> = SeatColumns<
	Seat,
	Id
> & {
	phase: string;
	activeColor: Seat;
};

/**
 * Whether this participant may move now: the game is not over, both seats are
 * taken, they hold one and it is that seat's turn. The server enforces the
 * same rule, so clients use it to decide when to offer a move.
 */
export function duelTurn<Seat extends string, Id extends string>(
	seats: readonly [Seat, Seat],
	state: DuelTurnState<NoInfer<Seat>, Id>,
	participantId: NoInfer<Id> | null | undefined,
): { ok: true; seat: Seat } | { ok: false; blocked: DuelTurnBlock } {
	if (state.phase === "finished") {
		return { ok: false, blocked: "finished" };
	}
	if (seats.some((seat) => !occupant(state, seat))) {
		return { ok: false, blocked: "waitingForOpponent" };
	}
	const seat = seatOf(seats, state, participantId);
	if (!seat) {
		return { ok: false, blocked: "notSeated" };
	}
	if (state.activeColor !== seat) {
		return { ok: false, blocked: "notYourTurn" };
	}
	return { ok: true, seat };
}
