import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { QuizPlayerView } from "#/components/quiz/QuizPlayerView";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

export const Route = createFileRoute("/quiz/$sessionId/play")({
	validateSearch: (search) => ({
		participantId:
			typeof search.participantId === "string" ? search.participantId : "",
	}),
	component: QuizPlayerPage,
});

function QuizPlayerPage() {
	const { sessionId } = Route.useParams();
	const { participantId } = Route.useSearch();
	const bundle = useQuery(api.quiz.getBundle, {
		sessionId: sessionId as Id<"gameSessions">,
	});

	if (bundle === undefined) {
		return (
			<main className="club-wrap py-10 text-slate-300">Loading quiz...</main>
		);
	}
	if (bundle === null) {
		return (
			<main className="club-wrap py-10 text-orange-200">Quiz not found.</main>
		);
	}
	return (
		<main className="club-wrap flex min-h-[70vh] items-center justify-center py-10">
			<QuizPlayerView bundle={bundle} participantId={participantId} />
		</main>
	);
}
