import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { useEffect } from "react";
import { BluffDiceRoom } from "#/components/bluff-dice/BluffDiceRoom";
import { FullscreenGamePage } from "#/components/games/FullscreenGamePage";
import {
	pageShell,
	SessionBundleRoute,
} from "#/components/games/SessionBundleRoute";
import { sessionInviteUrl } from "#/lib/games/invite";
import { useSeat } from "#/lib/games/seat";
import { useGuestId } from "#/lib/games/sessions";
import { adoptTableSeat } from "#/lib/games/table-seat";
import { useMessages } from "#/lib/i18n";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export const Route = createFileRoute("/bluff-dice/$sessionId")({
	component: BluffDiceSessionPage,
	staticData: { fullscreen: true },
});

/**
 * Bluff Dice now plays as liar's dice on the dice tables. A session the
 * migration has moved there opens at its table, with this tab's seat.
 */
function useMovedToDiceTable(sessionId: Id<"gameSessions">, moved: boolean) {
	const navigate = useNavigate();
	const participantId = useSeat(sessionId);
	const guestId = useGuestId();
	useEffect(() => {
		if (!moved || !guestId) {
			return;
		}
		if (participantId) {
			adoptTableSeat(sessionId, participantId, guestId);
		}
		void navigate({
			to: "/dice/table/$sessionId",
			params: { sessionId },
			replace: true,
		});
	}, [moved, guestId, participantId, sessionId, navigate]);
}

function BluffDiceSessionPage() {
	const messages = useMessages();
	const title = messages.catalog["bluff-dice"].title;
	const sessionId = Route.useParams().sessionId as Id<"gameSessions">;
	const bundle = useQuery(api.bluffDice.getBundle, { sessionId });
	const moved = bundle?.session.gameType === "dice-games";
	useMovedToDiceTable(sessionId, moved);
	return (
		<SessionBundleRoute
			bundle={moved ? undefined : bundle}
			shell={pageShell(title)}
			loading={messages.games.bluffDice.session.loadingTable}
			notFound={messages.games.bluffDice.session.tableNotFound}
		>
			{(loaded) => (
				<FullscreenGamePage title={title} maxWidthClassName="max-w-5xl">
					<BluffDiceRoom
						bundle={loaded}
						joinUrl={sessionInviteUrl(loaded.session)}
					/>
				</FullscreenGamePage>
			)}
		</SessionBundleRoute>
	);
}
