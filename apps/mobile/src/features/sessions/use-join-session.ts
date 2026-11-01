/**
 * Joining an online session by room code or invite token, then remembering
 * the seat on this phone so the game screen (and a later relaunch) knows
 * which participant row is ours.
 *
 * Waits for Convex to hold the Clerk token when someone is signed in, so a
 * signed-in player is joined as their account rather than as a guest.
 */
import { useAuth } from "@clerk/expo";
import { useConvexAuth, useMutation } from "convex/react";
import { useCallback, useState } from "react";
import { api } from "../../convex/api";
import { usePlayerIdentity } from "../players/use-player-identity";
import { type GameType, rememberSeat } from "./session-seats";

export type JoinResult = {
	sessionId: string;
	participantId: string;
	gameType: GameType;
};

export function useJoinSession() {
	const identity = usePlayerIdentity();
	const { isSignedIn } = useAuth();
	const convexAuth = useConvexAuth();
	const joinByCode = useMutation(api.sessions.joinByCode);
	const joinByToken = useMutation(api.sessions.joinByToken);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<unknown>(null);
	const authPending = Boolean(isSignedIn) && !convexAuth.isAuthenticated;

	const join = useCallback(
		async (
			invite: { code: string } | { token: string },
			displayName: string,
		): Promise<JoinResult | null> => {
			setBusy(true);
			setError(null);
			try {
				const base = {
					displayName: displayName.trim() || identity.defaultName,
					guestId: identity.guestId,
				};
				const result =
					"token" in invite
						? await joinByToken({ ...base, shareToken: invite.token })
						: await joinByCode({ ...base, joinCode: invite.code });
				rememberSeat({
					sessionId: result.sessionId,
					participantId: result.participantId,
					gameType: result.gameType,
				});
				return result;
			} catch (caught) {
				setError(caught);
				return null;
			} finally {
				setBusy(false);
			}
		},
		[identity.defaultName, identity.guestId, joinByCode, joinByToken],
	);

	return { join, busy: busy || authPending, error };
}
