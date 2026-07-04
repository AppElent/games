import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { ConnectFourMatch } from "#/components/connect-four/ConnectFourMatch";
import { buildShareUrl } from "#/lib/games/sessions";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export const Route = createFileRoute("/connect-four/$sessionId")({
	component: ConnectFourSessionPage,
});

function ConnectFourSessionPage() {
	const { sessionId } = Route.useParams();
	const bundle = useQuery(api.connectFour.getBundle, {
		sessionId: sessionId as Id<"gameSessions">,
	});

	if (bundle === undefined) {
		return (
			<main className="club-wrap py-10 text-slate-300">Loading game...</main>
		);
	}
	if (bundle === null) {
		return (
			<main className="club-wrap py-10 text-orange-200">Game not found.</main>
		);
	}

	const shareUrl = bundle.session.shareToken
		? buildShareUrl(window.location.origin, bundle.session.shareToken)
		: window.location.href;

	return (
		<main className="club-wrap py-6">
			<ConnectFourMatch bundle={bundle} shareUrl={shareUrl} />
		</main>
	);
}
