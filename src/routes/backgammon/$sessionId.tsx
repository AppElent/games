import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { BackgammonMatch } from "#/components/backgammon/BackgammonMatch";
import {
	boardShell,
	SessionBundleRoute,
} from "#/components/games/SessionBundleRoute";
import { sessionInviteUrl } from "#/lib/games/invite";
import { useMessages } from "#/lib/i18n";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export const Route = createFileRoute("/backgammon/$sessionId")({
	component: BackgammonSessionPage,
	staticData: { fullscreen: true },
});

function BackgammonSessionPage() {
	const messages = useMessages();
	const { sessionId } = Route.useParams();
	const bundle = useQuery(api.backgammon.getBundle, {
		sessionId: sessionId as Id<"gameSessions">,
	});
	return (
		<SessionBundleRoute
			bundle={bundle}
			shell={boardShell(messages.catalog.backgammon.title)}
			loading={messages.games.backgammon.session.loadingMatch}
			notFound={messages.games.backgammon.session.matchNotFound}
		>
			{(loaded) => (
				<BackgammonMatch
					bundle={loaded}
					shareUrl={sessionInviteUrl(loaded.session)}
				/>
			)}
		</SessionBundleRoute>
	);
}
