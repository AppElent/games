import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { ChessMatch } from "#/components/chess/ChessMatch";
import { buildShareUrl } from "#/lib/games/sessions";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export const Route = createFileRoute("/chess/$sessionId")({
	component: ChessSessionPage,
});

function ChessSessionPage() {
	const { sessionId } = Route.useParams();
	const bundle = useQuery(api.chess.getBundle, {
		sessionId: sessionId as Id<"gameSessions">,
	});

	if (bundle === undefined) {
		return (
			<main className="club-wrap py-10 text-slate-300">Loading match...</main>
		);
	}
	if (bundle === null) {
		return (
			<main className="club-wrap py-10 text-orange-200">Match not found.</main>
		);
	}

	const shareUrl = bundle.session.shareToken
		? buildShareUrl(window.location.origin, bundle.session.shareToken)
		: window.location.href;

	return (
		<main className="club-wrap py-6">
			<ChessMatch bundle={bundle} shareUrl={shareUrl} />
		</main>
	);
}
