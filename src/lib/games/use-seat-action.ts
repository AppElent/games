import { useSeat } from "#/lib/games/seat";
import { useGuestId } from "#/lib/games/sessions";
import { useGameAction } from "#/lib/games/use-game-action";
import type { Id } from "../../../convex/_generated/dataModel";

/**
 * The arguments every seated player's call starts with: the seat, and the
 * guest id that proves a guest's seat is theirs.
 */
export type SeatArgs = {
	sessionId: Id<"gameSessions">;
	participantId: Id<"sessionParticipants">;
	guestId: string;
};

/**
 * This tab's seat in a session and the error slot its actions share. `seat`
 * is what a call acting for it sends; `seatAction` sends a mutation as that
 * seat. Both are undefined while the tab holds none, so a screen can hide or
 * skip the action.
 */
export function useSeatAction(sessionId: Id<"gameSessions">) {
	const participantId = useSeat(sessionId);
	const guestId = useGuestId();
	const { error, run } = useGameAction();
	const seat: SeatArgs | undefined =
		participantId && guestId
			? { sessionId, participantId, guestId }
			: undefined;

	function seatAction(
		send: (seat: SeatArgs) => Promise<unknown>,
		fallback: string,
	) {
		if (!seat) {
			return undefined;
		}
		return () => run(() => send(seat), fallback);
	}

	return { participantId, seat, seatAction, error, run };
}
