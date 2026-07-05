import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { FullscreenGamePage } from "#/components/games/FullscreenGamePage";
import { QuizPlayerView } from "#/components/quiz/QuizPlayerView";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

export const Route = createFileRoute("/quiz/$sessionId/play")({
	validateSearch: (search) => ({
		participantId:
			typeof search.participantId === "string" ? search.participantId : "",
	}),
	component: QuizPlayerPage,
	staticData: { fullscreen: true },
});

function QuizPlayerPage() {
	const { sessionId } = Route.useParams();
	const { participantId } = Route.useSearch();
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
		<FullscreenGamePage
			title="Live Quiz"
			className="flex min-h-[70vh] items-center justify-center"
		>
			<QuizPlayerView bundle={bundle} participantId={participantId} />
		</FullscreenGamePage>
	);
}
