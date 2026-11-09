import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { FullscreenGamePage } from "#/components/games/FullscreenGamePage";
import {
	pageShell,
	SessionBundleRoute,
} from "#/components/games/SessionBundleRoute";
import { HitsterHostView } from "#/components/hitster/HitsterHostView";
import { useSeat } from "#/lib/games/seat";
import { useMessages } from "#/lib/i18n";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

export const Route = createFileRoute("/hitster/$sessionId/host")({
	component: HitsterHostPage,
	staticData: { fullscreen: true },
});

function HitsterHostPage() {
	const messages = useMessages();
	const session = messages.games.hitster.session;
	const { sessionId } = Route.useParams();
	const participantId = useSeat(sessionId);
	const bundle = useQuery(api.hitster.getBundle, {
		sessionId: sessionId as Id<"gameSessions">,
		participantId,
	});
	const shell = pageShell(messages.catalog.hitster.title, {
		loading: "text-[var(--club-muted)]",
		notFound: "text-orange-500",
	});
	return (
		<SessionBundleRoute
			bundle={bundle}
			shell={shell}
			loading={session.loadingRoom}
			notFound={session.roomNotFound}
		>
			{(loaded) =>
				participantId ? (
					<FullscreenGamePage
						title={messages.catalog.hitster.title}
						maxWidthClassName="max-w-5xl"
					>
						<HitsterHostView bundle={loaded} participantId={participantId} />
					</FullscreenGamePage>
				) : (
					shell(session.hostSessionExpired, "notFound")
				)
			}
		</SessionBundleRoute>
	);
}
