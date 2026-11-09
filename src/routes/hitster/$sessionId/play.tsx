import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { FullscreenGamePage } from "#/components/games/FullscreenGamePage";
import {
	pageShell,
	SessionBundleRoute,
} from "#/components/games/SessionBundleRoute";
import { HitsterStage } from "#/components/hitster/HitsterStage";
import { parseSeatSearch, useSeat } from "#/lib/games/seat";
import { useGuestId } from "#/lib/games/sessions";
import { useMessages } from "#/lib/i18n";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

export const Route = createFileRoute("/hitster/$sessionId/play")({
	validateSearch: parseSeatSearch,
	component: HitsterPlayerPage,
	staticData: { fullscreen: true },
});

function HitsterPlayerPage() {
	const messages = useMessages();
	const hitster = messages.games.hitster;
	const { sessionId } = Route.useParams();
	const linked = Route.useSearch().participantId;
	const stored = useSeat(sessionId);
	// A join link names the seat; otherwise this tab's remembered one.
	const participantId = linked || stored;
	const guestId = useGuestId();
	const bundle = useQuery(api.hitster.getBundle, {
		sessionId: sessionId as Id<"gameSessions">,
		participantId,
		guestId,
	});
	const shell = pageShell(messages.catalog.hitster.title, {
		loading: "text-[var(--club-muted)]",
		notFound: "text-orange-500",
	});
	return (
		<SessionBundleRoute
			bundle={bundle}
			shell={shell}
			loading={hitster.session.loadingGame}
			notFound={hitster.session.gameNotFound}
		>
			{(loaded) =>
				participantId ? (
					<FullscreenGamePage
						title={messages.catalog.hitster.title}
						kicker={hitster.musicTimelineKicker}
						maxWidthClassName="max-w-5xl"
					>
						<HitsterStage bundle={loaded} participantId={participantId} />
					</FullscreenGamePage>
				) : (
					shell(hitster.session.joinFirst, "notFound")
				)
			}
		</SessionBundleRoute>
	);
}
