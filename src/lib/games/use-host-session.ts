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

/** This tab takes the seat and reloads into where the host plays. */
function reloadIntoSession(gameType: GameType, created: CreatedSession) {
	rememberSeat(created.sessionId, created.participantId);
	const path = getHostPath(gameType, created.sessionId, created.participantId);
	if (path) {
		window.location.href = path;
	}
}

/**
 * Hosting one game: `create` runs its mutation with the names the game wants,
 * then `open` takes this tab into the session (by default it takes the seat
 * and reloads). `busy` stays set through that, and clears only on failure.
 */
export function useHostSession(
	gameType: GameType,
	{ open }: { open?: (created: CreatedSession) => Promise<unknown> } = {},
) {
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
				const created = await create({
					hostName,
					guestId: guest.id,
					guestName: guest.displayName,
				});
				if (open) {
					await open(created);
				} else {
					reloadIntoSession(gameType, created);
				}
			}, fallback);
			if (!succeeded) {
				setBusy(false);
			}
		},
		[gameType, hostName, open, run],
	);

	return { busy, error, setError, host };
}
