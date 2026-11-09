import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { BluffDiceRoom } from "#/components/bluff-dice/BluffDiceRoom";
import { FullscreenGamePage } from "#/components/games/FullscreenGamePage";
import {
	pageShell,
	SessionBundleRoute,
} from "#/components/games/SessionBundleRoute";
import { sessionInviteUrl } from "#/lib/games/invite";
import { useMessages } from "#/lib/i18n";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export const Route = createFileRoute("/bluff-dice/$sessionId")({
	component: BluffDiceSessionPage,
	staticData: { fullscreen: true },
});

function BluffDiceSessionPage() {
	const messages = useMessages();
	const title = messages.catalog["bluff-dice"].title;
	const { sessionId } = Route.useParams();
	const bundle = useQuery(api.bluffDice.getBundle, {
		sessionId: sessionId as Id<"gameSessions">,
	});
	return (
		<SessionBundleRoute
			bundle={bundle}
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
