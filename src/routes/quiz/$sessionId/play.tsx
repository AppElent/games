import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { FullscreenGamePage } from "#/components/games/FullscreenGamePage";
import {
	pageShell,
	SessionBundleRoute,
} from "#/components/games/SessionBundleRoute";
import { QuizPlayerView } from "#/components/quiz/QuizPlayerView";
import { parseSeatSearch } from "#/lib/games/seat";
import { useMessages } from "#/lib/i18n";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

export const Route = createFileRoute("/quiz/$sessionId/play")({
	validateSearch: parseSeatSearch,
	component: QuizPlayerPage,
	staticData: { fullscreen: true },
});

/** The seat comes from the join link only: without one the page asks to join. */
function QuizPlayerPage() {
	const messages = useMessages();
	const title = messages.catalog["live-quiz"].title;
	const { sessionId } = Route.useParams();
	const { participantId } = Route.useSearch();
	const bundle = useQuery(api.quiz.getBundle, {
		sessionId: sessionId as Id<"gameSessions">,
	});
	return (
		<SessionBundleRoute
			bundle={bundle}
			shell={pageShell(title)}
			loading={messages.games.quiz.status.loading}
			notFound={messages.games.quiz.status.notFound}
		>
			{(loaded) => (
				<FullscreenGamePage
					title={title}
					className="flex min-h-[70vh] items-center justify-center"
				>
					<QuizPlayerView bundle={loaded} participantId={participantId} />
				</FullscreenGamePage>
			)}
		</SessionBundleRoute>
	);
}
