import { seatsCarrySecret } from "@arcadeclub/core/games";
import { normalizeJoinCode } from "@arcadeclub/core/sessions";
import { useMutation } from "convex/react";
import { newCardSeatSecret, rememberCardSeat } from "#/lib/games/card-seat";
import { getSessionPath } from "#/lib/games/catalog";
import { rememberSeat } from "#/lib/games/seat";
import { getOrCreateGuestIdentity } from "#/lib/games/sessions";
import { api } from "../../../convex/_generated/api";

type JoinRequest = {
	/** The room code typed in; ignored when joining by `token`. */
	code: string;
	/** A share link's token. */
	token?: string;
	/** The name typed in; blank joins under this device's guest name. */
	name: string;
	asSpectator: boolean;
};

/**
 * Joining a session by room code or share link: this tab takes the seat, and
 * the result is where the player plays (`null` for a game with no sessions).
 */
export function useJoinSession() {
	const joinByCode = useMutation(api.sessions.joinByCode);
	const joinByToken = useMutation(api.sessions.joinByToken);

	return async ({ code, token, name, asSpectator }: JoinRequest) => {
		const guest = getOrCreateGuestIdentity();
		const displayName = name.trim() || guest.displayName;
		// A room code may open a card table, whose seat needs a secret; the
		// server ignores it for every other game.
		const seatSecret = token ? undefined : newCardSeatSecret();
		const result = token
			? await joinByToken({
					shareToken: token,
					displayName,
					guestId: guest.id,
					asSpectator,
				})
			: await joinByCode({
					joinCode: normalizeJoinCode(code),
					displayName,
					guestId: guest.id,
					asSpectator,
					seatSecret,
				});
		const { sessionId, participantId, gameType } = result;
		if (seatsCarrySecret(gameType) && seatSecret) {
			rememberCardSeat(
				sessionId,
				participantId,
				seatSecret,
				result.seatClaimed,
			);
		}
		rememberSeat(sessionId, participantId);
		return getSessionPath(gameType, sessionId, participantId);
	};
}
