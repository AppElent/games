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
