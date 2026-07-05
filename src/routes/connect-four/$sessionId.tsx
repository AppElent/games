import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { ConnectFourMatch } from "#/components/connect-four/ConnectFourMatch";
import { FullscreenGameShell } from "#/components/games/FullscreenGameShell";
import { buildShareUrl } from "#/lib/games/sessions";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export const Route = createFileRoute("/connect-four/$sessionId")({
	component: ConnectFourSessionPage,
	staticData: { fullscreen: true },
});

function ConnectFourSessionPage() {
	const { sessionId } = Route.useParams();
	const bundle = useQuery(api.connectFour.getBundle, {
		sessionId: sessionId as Id<"gameSessions">,
	});

	if (bundle === undefined || bundle === null) {
		return (
			<FullscreenGameShell title="Connect Four">
				<div className="flex h-full items-center justify-center">
					<p className={bundle === null ? "text-orange-200" : "text-slate-300"}>
						{bundle === null ? "Game not found." : "Loading game..."}
					</p>
				</div>
			</FullscreenGameShell>
		);
	}

	const shareUrl = bundle.session.shareToken
		? buildShareUrl(window.location.origin, bundle.session.shareToken)
		: window.location.href;

	return <ConnectFourMatch bundle={bundle} shareUrl={shareUrl} />;
}
