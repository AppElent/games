import type { GameType } from "@arcadeclub/core/games";
import { useUser } from "@clerk/react";
import { useCallback, useState } from "react";
import { getHostPath } from "#/lib/games/catalog";
import { rememberSeat } from "#/lib/games/seat";
import { getOrCreateGuestIdentity } from "#/lib/games/sessions";
import { useGameAction } from "#/lib/games/use-game-action";
import { useMessages } from "#/lib/i18n";
import type { Id } from "../../../convex/_generated/dataModel";

/** Who hosts: this device's guest id, and the name the host plays under. */
type HostIdentity = {
	/** The account's first name when signed in, else this device's guest name. */
	displayName: string;
	guestId: string;
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
 * Hosting one game: `create` runs its mutation as this host, then `open` takes this tab into the session (by default it takes the seat
 * and reloads). `busy` stays set through that, and clears only on failure.
 */
export function useHostSession(
	gameType: GameType,
	{ open }: { open?: (created: CreatedSession) => Promise<unknown> } = {},
) {
	const { user } = useUser();
	const messages = useMessages();
	const accountName = user
		? user.firstName || user.username || messages.common.session.host
		: undefined;
	const { error, run } = useGameAction();
	const [busy, setBusy] = useState(false);

	const host = useCallback(
		async (
			create: (host: HostIdentity) => Promise<CreatedSession>,
			fallback: string,
		) => {
			setBusy(true);
			const succeeded = await run(async () => {
				const guest = getOrCreateGuestIdentity();
				const created = await create({
					displayName: accountName ?? guest.displayName,
					guestId: guest.id,
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
		[accountName, gameType, open, run],
	);

	return { busy, error, host };
}
