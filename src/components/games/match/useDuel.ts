import { occupant, type SeatColumns, seatOf } from "@arcadeclub/core/duel";
import { useSeat } from "#/lib/games/seat";
import { useGameAction } from "#/lib/games/use-game-action";
import type { Id } from "../../../../convex/_generated/dataModel";

type ParticipantId = Id<"sessionParticipants">;

type DuelState<Seat extends string> = SeatColumns<Seat, ParticipantId> & {
	phase: string;
	activeColor: Seat;
};

/** A mutation a seated player sends with no arguments of its own. */
type SeatMutation = (args: {
	sessionId: Id<"gameSessions">;
	participantId: ParticipantId;
}) => Promise<unknown>;

/**
 * This tab's place in a two-seat match (backgammon, chess, connect four): its
 * seat, whether both seats are taken, whether it is to move, and the error
 * slot its actions share.
 */
export function useDuel<Seat extends string>(
	sessionId: Id<"gameSessions">,
	seats: readonly [Seat, Seat],
	state: DuelState<Seat> | null | undefined,
) {
	const participantId = useSeat(sessionId);
	const action = useGameAction();
	const localColor = state ? seatOf(seats, state, participantId) : undefined;
	const opponentJoined = Boolean(
		state && seats.every((seat) => occupant(state, seat)),
	);
	const finished = state?.phase === "finished";
	const myTurn =
		Boolean(localColor) &&
		state?.activeColor === localColor &&
		opponentJoined &&
		!finished;

	/** `mutation` as this seat, or undefined when this tab holds no seat. */
	function seatAction(mutation: SeatMutation, fallback: string) {
		if (!participantId || !localColor) {
			return undefined;
		}
		return () =>
			action.run(() => mutation({ sessionId, participantId }), fallback);
	}

	return {
		participantId,
		localColor,
		opponentJoined,
		finished,
		myTurn,
		seatAction,
		...action,
	};
}
