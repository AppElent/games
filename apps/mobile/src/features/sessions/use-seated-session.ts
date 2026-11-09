/**
 * An online session from this phone's seat: the route's id as a typed id, the
 * seat `session-seats` remembers (the only source of `participantId`) with the
 * guest id that proves it is this phone's, and `run` for the game's mutations.
 * Without a seat `run` does nothing, so a game only has to ask for actions a
 * seated player can take.
 */
import { useCallback, useMemo, useState } from "react";
import type { Id } from "../../convex/api";
import { readGuestIdentity } from "../players/identity/use-player-identity";
import { findSeat, type Seat } from "./session-seats";
import { useSessionAction } from "./use-session-action";

/** What every call acting for this phone's seat sends. */
export type SeatArgs = Seat & { guestId: string };

export function useSeatedSession(sessionId: string) {
	const id = sessionId as Id<"gameSessions">;
	const [participantId] = useState(() => findSeat(sessionId)?.participantId);
	const [guestId] = useState(() => readGuestIdentity().id);
	const seat = useMemo<SeatArgs | null>(
		() => (participantId ? { sessionId: id, participantId, guestId } : null),
		[id, participantId, guestId],
	);
	const { run: runAction, busy, error } = useSessionAction();

	const run = useCallback(
		async (action: (seat: SeatArgs) => Promise<unknown>) => {
			if (seat) await runAction(() => action(seat));
		},
		[seat, runAction],
	);

	return { id, seat, run, busy, error };
}
