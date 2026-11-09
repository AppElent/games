/**
 * Creating an online session this phone hosts. The backend requires an
 * account to host anything but solo play, so callers gate on `canHost`
 * (signed in and the Clerk token already on the Convex client).
 *
 * Each game passes its own atomic `create` mutation, which opens the session
 * and its game state together and decides the join mode and auth policy.
 */
import type { GameType } from "@arcadeclub/core/games";
import { useCallback } from "react";
import type { Id } from "../../../convex/api";
import { usePlayerIdentity } from "../../players/identity/use-player-identity";
import { rememberSeat } from "../session-seats";
import { useBackendAuthReady } from "../use-backend-auth-ready";
import { useSessionAction } from "../use-session-action";

type HostedSession = {
	sessionId: Id<"gameSessions">;
	participantId: Id<"sessionParticipants">;
};

export function useHostSession() {
	const backendAuth = useBackendAuthReady();
	const { displayName, guestId } = usePlayerIdentity();
	const { run, busy, error } = useSessionAction();

	const host = useCallback(
		(
			gameType: GameType,
			create: (host: {
				displayName: string;
				guestId: string;
			}) => Promise<HostedSession>,
		) =>
			run(async () => {
				const session = await create({ displayName, guestId });
				rememberSeat({
					sessionId: session.sessionId,
					participantId: session.participantId,
					gameType,
				});
				return session;
			}),
		[displayName, guestId, run],
	);

	return {
		host,
		busy: busy || backendAuth.loading,
		error,
		isSignedIn: backendAuth.isSignedIn,
		canHost: backendAuth.ready,
	};
}
