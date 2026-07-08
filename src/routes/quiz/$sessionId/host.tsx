import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { FullscreenGamePage } from "#/components/games/FullscreenGamePage";
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
	const { sessionId } = Route.useParams();
	const bundle = useQuery(api.quiz.getBundle, {
		sessionId: sessionId as Id<"gameSessions">,
	});

	if (bundle === undefined) {
		return (
			<FullscreenGamePage
				title={messages.catalog["live-quiz"].title}
				className="text-slate-300"
			>
				{messages.games.quiz.status.loading}
			</FullscreenGamePage>
		);
	}
	if (bundle === null) {
		return (
			<FullscreenGamePage
				title={messages.catalog["live-quiz"].title}
				className="text-orange-200"
			>
				{messages.games.quiz.status.notFound}
			</FullscreenGamePage>
		);
	}
	return (
		<FullscreenGamePage
			title={messages.catalog["live-quiz"].title}
			maxWidthClassName="max-w-5xl"
		>
			<QuizHostView bundle={bundle} />
		</FullscreenGamePage>
	);
}
