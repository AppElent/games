import { useSeat } from "#/lib/games/seat";
import { useGameAction } from "#/lib/games/use-game-action";
import type { Id } from "../../../convex/_generated/dataModel";

/** The arguments every seated player's mutation starts with. */
export type SeatArgs = {
	sessionId: Id<"gameSessions">;
	participantId: Id<"sessionParticipants">;
};

/**
 * This tab's seat in a session and the error slot its actions share.
 * `seatAction` sends a mutation as that seat, and is undefined while the tab
 * holds none, so a screen can hide or skip the action.
 */
export function useSeatAction(sessionId: Id<"gameSessions">) {
	const participantId = useSeat(sessionId);
	const { error, run } = useGameAction();

	function seatAction(
		send: (seat: SeatArgs) => Promise<unknown>,
		fallback: string,
	) {
		if (!participantId) {
			return undefined;
		}
		return () => run(() => send({ sessionId, participantId }), fallback);
	}

	return { participantId, seatAction, error, run };
}
