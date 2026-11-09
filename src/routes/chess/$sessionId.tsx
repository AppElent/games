import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { ChessMatch } from "#/components/chess/ChessMatch";
import {
	boardShell,
	SessionBundleRoute,
} from "#/components/games/SessionBundleRoute";
import { sessionInviteUrl } from "#/lib/games/invite";
import { useMessages } from "#/lib/i18n";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export const Route = createFileRoute("/chess/$sessionId")({
	component: ChessSessionPage,
	staticData: { fullscreen: true },
});

function ChessSessionPage() {
	const messages = useMessages();
	const { sessionId } = Route.useParams();
	const bundle = useQuery(api.chess.getBundle, {
		sessionId: sessionId as Id<"gameSessions">,
	});
	return (
		<SessionBundleRoute
			bundle={bundle}
			shell={boardShell(messages.catalog.chess.title)}
			loading={messages.games.chess.session.loadingMatch}
			notFound={messages.games.chess.session.matchNotFound}
		>
			{(loaded) => (
				<ChessMatch
					bundle={loaded}
					shareUrl={sessionInviteUrl(loaded.session)}
				/>
			)}
		</SessionBundleRoute>
	);
}
