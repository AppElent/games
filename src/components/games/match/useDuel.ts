import {
	duelTurn,
	occupant,
	type SeatColumns,
	seatOf,
} from "@arcadeclub/core/duel";
import { type SeatArgs, useSeatAction } from "#/lib/games/use-seat-action";
import type { Id } from "../../../../convex/_generated/dataModel";

type ParticipantId = Id<"sessionParticipants">;

type DuelState<Seat extends string> = SeatColumns<Seat, ParticipantId> & {
	phase: string;
	activeColor: Seat;
};

/** What a two-seat match's bundle carries that the seats depend on. */
type DuelBundle<Seat extends string, Participant> = {
	session: { _id: Id<"gameSessions"> };
	state: DuelState<Seat> | null | undefined;
	participants: Participant[];
};

/**
 * This tab's place in a two-seat match (backgammon, chess, connect four): its
 * seat, whether both seats are taken, whether it is to move (the server's
 * `duelTurn` rule), who sits where, and the error slot its actions share.
 */
export function useDuel<
	Seat extends string,
	Participant extends { _id: ParticipantId },
>(bundle: DuelBundle<Seat, Participant>, seats: readonly [Seat, Seat]) {
	const { state, participants } = bundle;
	const { participantId, seat, seatAction, error, run } = useSeatAction(
		bundle.session._id,
	);
	const localColor = state ? seatOf(seats, state, participantId) : undefined;
	const opponentJoined = Boolean(
		state && seats.every((seat) => occupant(state, seat)),
	);
	const finished = state?.phase === "finished";
	const myTurn = state ? duelTurn(seats, state, participantId).ok : false;

	return {
		participantId,
		/** What a call acting for this tab's seat sends. */
		seat,
		localColor,
		opponentJoined,
		finished,
		myTurn,
		/** The participant sitting in `seat`, if anyone. */
		occupant(seat: Seat) {
			const id = state ? occupant(state, seat) : undefined;
			return participants.find((participant) => participant._id === id);
		},
		/** Whether `seat` is to move in a running match with both seats taken. */
		isActive(seat: Seat) {
			return !finished && opponentJoined && state?.activeColor === seat;
		},
		/** `mutation` as this seat, or undefined when this tab holds no seat. */
		seatAction(
			mutation: (seat: SeatArgs) => Promise<unknown>,
			fallback: string,
		) {
			return localColor ? seatAction(mutation, fallback) : undefined;
		},
		error,
		run,
	};
}
