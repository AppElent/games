import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { ChessMatch } from "#/components/chess/ChessMatch";
import { FullscreenGameShell } from "#/components/games/FullscreenGameShell";
import { buildShareUrl } from "#/lib/games/sessions";
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

	if (bundle === undefined || bundle === null) {
		return (
			<FullscreenGameShell title={messages.catalog.chess.title}>
				<div className="flex h-full items-center justify-center">
					<p className={bundle === null ? "text-orange-200" : "text-slate-300"}>
						{bundle === null
							? messages.games.chess.session.matchNotFound
							: messages.games.chess.session.loadingMatch}
					</p>
				</div>
			</FullscreenGameShell>
		);
	}

	const shareUrl = bundle.session.shareToken
		? buildShareUrl(window.location.origin, bundle.session.shareToken)
		: window.location.href;

	return <ChessMatch bundle={bundle} shareUrl={shareUrl} />;
}
