/**
 * Joining an online session by room code or invite token, then remembering
 * the seat on this phone so the game screen (and a later relaunch) knows
 * which participant row is ours, and the name the player joined under.
 *
 * Waits for Convex to hold the Clerk token when someone is signed in, so a
 * signed-in player is joined as their account rather than as a guest.
 */
import { seatsCarrySecret } from "@arcadeclub/core/games";
import { type Invite, seatSecretAfterJoin } from "@arcadeclub/core/sessions";
import { useMutation } from "convex/react";
import { useCallback } from "react";
import { api } from "../../convex/api";
import { usePlayerIdentity } from "../players/identity/use-player-identity";
import { newSeatSecret } from "./seat-secret";
import { findSeat, rememberSeat } from "./session-seats";
import { useBackendAuthReady } from "./use-backend-auth-ready";
import { useSessionAction } from "./use-session-action";

export function useJoinSession() {
	const identity = usePlayerIdentity();
	const backendAuth = useBackendAuthReady();
	const joinByCode = useMutation(api.sessions.joinByCode);
	const joinByToken = useMutation(api.sessions.joinByToken);
	const { run, busy, error } = useSessionAction();
	const authPending = backendAuth.isSignedIn && !backendAuth.ready;

	const { defaultName, displayName, guestId, setDisplayName } = identity;
	const join = useCallback(
		(invite: Invite, name: string) =>
			run(async () => {
				const trimmed = name.trim();
				const base = { displayName: trimmed || defaultName, guestId };
				// Only a card table claims a seat with this; other games ignore it.
				const seatSecret = newSeatSecret();
				const result =
					"token" in invite
						? await joinByToken({ ...base, shareToken: invite.token })
						: await joinByCode({
								...base,
								joinCode: invite.code,
								seatSecret,
							});
				rememberSeat({
					sessionId: result.sessionId,
					participantId: result.participantId,
					gameType: result.gameType,
					seatSecret: seatsCarrySecret(result.gameType)
						? seatSecretAfterJoin(
								findSeat(result.sessionId),
								result,
								seatSecret,
							)
						: undefined,
				});
				if (trimmed && trimmed !== displayName) setDisplayName(trimmed);
				return result;
			}),
		[
			defaultName,
			displayName,
			guestId,
			setDisplayName,
			joinByCode,
			joinByToken,
			run,
		],
	);

	return { join, busy: busy || authPending, error };
}
