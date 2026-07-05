import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { FullscreenGamePage } from "#/components/games/FullscreenGamePage";
import { QuizHostView } from "#/components/quiz/QuizHostView";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

export const Route = createFileRoute("/quiz/$sessionId/host")({
	component: QuizHostPage,
	staticData: { fullscreen: true },
});

function QuizHostPage() {
	const { sessionId } = Route.useParams();
	const bundle = useQuery(api.quiz.getBundle, {
		sessionId: sessionId as Id<"gameSessions">,
	});

	if (bundle === undefined) {
		return (
			<FullscreenGamePage title="Live Quiz" className="text-slate-300">
				Loading quiz...
			</FullscreenGamePage>
		);
	}
	if (bundle === null) {
		return (
			<FullscreenGamePage title="Live Quiz" className="text-orange-200">
				Quiz not found.
			</FullscreenGamePage>
		);
	}
	return (
		<FullscreenGamePage title="Live Quiz" maxWidthClassName="max-w-5xl">
			<QuizHostView bundle={bundle} />
		</FullscreenGamePage>
	);
}
