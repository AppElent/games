import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { BackgammonWaitingRoom } from "#/components/backgammon/BackgammonWaitingRoom";
import { FullscreenGameShell } from "#/components/games/FullscreenGameShell";
import { buildShareUrl } from "#/lib/games/sessions";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export const Route = createFileRoute("/backgammon/$sessionId")({
	component: BackgammonSessionPage,
	staticData: { fullscreen: true },
});

function BackgammonSessionPage() {
	const { sessionId } = Route.useParams();
	const bundle = useQuery(api.backgammon.getBundle, {
		sessionId: sessionId as Id<"gameSessions">,
	});

	if (bundle === undefined || bundle === null) {
		return (
			<FullscreenGameShell title="Backgammon">
				<div className="flex h-full items-center justify-center">
					<p className={bundle === null ? "text-orange-200" : "text-slate-300"}>
						{bundle === null ? "Match not found." : "Loading match..."}
					</p>
				</div>
			</FullscreenGameShell>
		);
	}

	const shareUrl = bundle.session.shareToken
		? buildShareUrl(window.location.origin, bundle.session.shareToken)
		: window.location.href;

	return <BackgammonWaitingRoom bundle={bundle} shareUrl={shareUrl} />;
}
