import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { ConnectFourMatch } from "#/components/connect-four/ConnectFourMatch";
import {
	boardShell,
	SessionBundleRoute,
} from "#/components/games/SessionBundleRoute";
import { sessionInviteUrl } from "#/lib/games/invite";
import { useMessages } from "#/lib/i18n";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export const Route = createFileRoute("/connect-four/$sessionId")({
	component: ConnectFourSessionPage,
	staticData: { fullscreen: true },
});

function ConnectFourSessionPage() {
	const messages = useMessages();
	const { sessionId } = Route.useParams();
	const bundle = useQuery(api.connectFour.getBundle, {
		sessionId: sessionId as Id<"gameSessions">,
	});
	return (
		<SessionBundleRoute
			bundle={bundle}
			shell={boardShell(messages.catalog["connect-four"].title)}
			loading={messages.games.connectFour.session.loadingGame}
			notFound={messages.games.connectFour.session.gameNotFound}
		>
			{(loaded) => (
				<ConnectFourMatch
					bundle={loaded}
					shareUrl={sessionInviteUrl(loaded.session)}
				/>
			)}
		</SessionBundleRoute>
	);
}
