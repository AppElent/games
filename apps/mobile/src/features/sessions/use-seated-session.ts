/**
 * An online session from this phone's seat: the route's id as a typed id, the
 * seat `session-seats` remembers (the only source of `participantId`), and
 * `run` for the game's mutations. Without a seat `run` does nothing, so a game
 * only has to ask for actions a seated player can take.
 */
import { useCallback, useMemo, useState } from "react";
import type { Id } from "../../convex/api";
import { findSeat } from "./session-seats";
import { useSessionAction } from "./use-session-action";

type Seat = {
	sessionId: Id<"gameSessions">;
	participantId: Id<"sessionParticipants">;
};

export function useSeatedSession(sessionId: string) {
	const id = sessionId as Id<"gameSessions">;
	const [participantId] = useState(() => findSeat(sessionId)?.participantId);
	const seat = useMemo<Seat | null>(
		() => (participantId ? { sessionId: id, participantId } : null),
		[id, participantId],
	);
	const { run: runAction, busy, error } = useSessionAction();

	const run = useCallback(
		async (action: (seat: Seat) => Promise<unknown>) => {
			if (seat) await runAction(() => action(seat));
		},
		[seat, runAction],
	);

	return { id, seat, run, busy, error };
}

export type SeatedSession = ReturnType<typeof useSeatedSession>;
