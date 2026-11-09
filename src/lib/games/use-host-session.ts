import type { GameType } from "@arcadeclub/core/games";
import { useUser } from "@clerk/react";
import { useCallback, useState } from "react";
import { getHostPath } from "#/lib/games/catalog";
import { rememberSeat } from "#/lib/games/seat";
import { getOrCreateGuestIdentity } from "#/lib/games/sessions";
import { useGameAction } from "#/lib/games/use-game-action";
import { useMessages } from "#/lib/i18n";
import type { Id } from "../../../convex/_generated/dataModel";

/** Default host name: the signed-in account's first name. */
export function useHostDisplayName(): string {
	const { user } = useUser();
	const messages = useMessages();
	return user?.firstName || user?.username || messages.common.session.host;
}

type HostNames = {
	/** The account's name, which most games host under. */
	hostName: string;
	guestId: string;
	guestName: string;
};

type CreatedSession = {
	sessionId: Id<"gameSessions">;
	participantId: Id<"sessionParticipants">;
};

/**
 * Hosting one game: `create` runs its mutation with the names the game wants,
 * then this tab takes the seat and reloads into the session. `busy` stays set
 * through that reload, and clears only on failure.
 */
export function useHostSession(gameType: GameType) {
	const hostName = useHostDisplayName();
	const { error, setError, run } = useGameAction();
	const [busy, setBusy] = useState(false);

	const host = useCallback(
		async (
			create: (names: HostNames) => Promise<CreatedSession>,
			fallback: string,
		) => {
			setBusy(true);
			const succeeded = await run(async () => {
				const guest = getOrCreateGuestIdentity();
				const { sessionId, participantId } = await create({
					hostName,
					guestId: guest.id,
					guestName: guest.displayName,
				});
				rememberSeat(sessionId, participantId);
				const path = getHostPath(gameType, sessionId, participantId);
				if (path) {
					window.location.href = path;
				}
			}, fallback);
			if (!succeeded) {
				setBusy(false);
			}
		},
		[gameType, hostName, run],
	);

	return { busy, error, setError, host };
}
