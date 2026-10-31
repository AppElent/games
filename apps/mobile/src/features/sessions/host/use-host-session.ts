/**
 * Creating an online session this phone hosts. The backend requires an
 * account to host anything but solo play, so callers gate on `canHost`
 * (signed in and the Clerk token already on the Convex client).
 */
import { useAuth } from "@clerk/expo";
import { useConvexAuth, useMutation } from "convex/react";
import { useCallback, useState } from "react";
import { api, type Id } from "../../../convex/api";
import { usePlayerIdentity } from "../../players/use-player-identity";
import { type GameType, rememberSeat } from "../session-seats";

export type HostedSession = {
	sessionId: Id<"gameSessions">;
	participantId: Id<"sessionParticipants">;
	joinCode?: string;
};

export function useHostSession() {
	const { isSignedIn } = useAuth();
	const convexAuth = useConvexAuth();
	const identity = usePlayerIdentity();
	const create = useMutation(api.sessions.create);
	const [busy, setBusy] = useState(false);
	const [failed, setFailed] = useState(false);

	const host = useCallback(
		async (
			args: {
				gameType: GameType;
				joinMode: "room" | "challenge";
				title: string;
			},
			/** Game-specific setup that must succeed for the session to count. */
			setup?: (session: HostedSession) => Promise<unknown>,
		): Promise<HostedSession | null> => {
			setBusy(true);
			setFailed(false);
			try {
				const session = await create({
					...args,
					authPolicy: "guestAllowed",
					displayName: identity.displayName,
					guestId: identity.guestId,
				});
				await setup?.(session);
				rememberSeat({
					sessionId: session.sessionId,
					participantId: session.participantId,
					gameType: args.gameType,
				});
				return session;
			} catch {
				setFailed(true);
				return null;
			} finally {
				setBusy(false);
			}
		},
		[create, identity.displayName, identity.guestId],
	);

	return {
		host,
		busy: busy || (Boolean(isSignedIn) && convexAuth.isLoading),
		failed,
		isSignedIn: Boolean(isSignedIn),
		canHost: Boolean(isSignedIn) && convexAuth.isAuthenticated,
	};
}
