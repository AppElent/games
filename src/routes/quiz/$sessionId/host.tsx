import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { FullscreenGamePage } from "#/components/games/FullscreenGamePage";
import {
	pageShell,
	SessionBundleRoute,
} from "#/components/games/SessionBundleRoute";
import { QuizHostView } from "#/components/quiz/QuizHostView";
import { useMessages } from "#/lib/i18n";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

export const Route = createFileRoute("/quiz/$sessionId/host")({
	component: QuizHostPage,
	staticData: { fullscreen: true },
});

function QuizHostPage() {
	const messages = useMessages();
	const title = messages.catalog["live-quiz"].title;
	const { sessionId } = Route.useParams();
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
				<FullscreenGamePage title={title} maxWidthClassName="max-w-5xl">
					<QuizHostView bundle={loaded} />
				</FullscreenGamePage>
			)}
		</SessionBundleRoute>
	);
}
