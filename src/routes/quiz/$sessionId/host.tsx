import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { QuizHostView } from "#/components/quiz/QuizHostView";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

export const Route = createFileRoute("/quiz/$sessionId/host")({
	component: QuizHostPage,
});

function QuizHostPage() {
	const { sessionId } = Route.useParams();
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
		<main className="club-wrap py-6">
			<QuizHostView bundle={bundle} />
		</main>
	);
}
