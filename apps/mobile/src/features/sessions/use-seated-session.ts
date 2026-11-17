/**
 * An online session from this phone's seat: the route's id as a typed id, the
 * seat with the guest id that proves it is this phone's, and `run` for the
 * game's mutations. The seat is the one `session-seats` remembers while it is
 * the caller's, else the signed-in account's own (`sessions.ownSeat`), so a
 * player who signs out and back in, or another account that joined on this
 * phone, does not cost them their seat. Without a seat `run` does nothing, so
 * a game only has to ask for actions a seated player can take.
 */
import { useCallback, useMemo, useState } from "react";
import { api, type Id } from "../../convex/api";
import { useQuery } from "../../convex/query-cache";
import { readGuestIdentity } from "../players/identity/use-player-identity";
import { findSeat, type Seat } from "./session-seats";
import { useSessionAction } from "./use-session-action";

/** What every call acting for this phone's seat sends. */
export type SeatArgs = Seat & { guestId: string };

export function useSeatedSession(sessionId: string) {
	const id = sessionId as Id<"gameSessions">;
	const [held] = useState(() => findSeat(sessionId)?.participantId);
	const [guestId] = useState(() => readGuestIdentity().id);
	const own = useQuery(api.sessions.ownSeat, {
		sessionId: id,
		participantId: held,
		guestId,
	});
	const participantId = own ?? held;
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
