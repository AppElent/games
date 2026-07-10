import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { FullscreenGamePage } from "#/components/games/FullscreenGamePage";
import { HostGate } from "#/components/games/HostGate";
import { QuizSetEditor } from "#/components/quiz/QuizSetEditor";
import { useMessages } from "#/lib/i18n";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

export const Route = createFileRoute("/quiz/sets/$quizSetId")({
	component: QuizSetEditPage,
	staticData: { fullscreen: true },
});

function QuizSetEditPage() {
	const messages = useMessages();
	const { quizSetId } = Route.useParams();
	return (
		<FullscreenGamePage
			title={messages.games.quiz.sets.editSetTitle}
			maxWidthClassName="max-w-3xl"
		>
			<p className="club-kicker mb-2">{messages.catalog["live-quiz"].title}</p>
			<h1 className="club-title mb-6 text-4xl font-bold text-white">
				{messages.games.quiz.sets.editSetTitle}
			</h1>
			<HostGate>
				<QuizSetLoader quizSetId={quizSetId as Id<"quizSets">} />
			</HostGate>
		</FullscreenGamePage>
	);
}

function QuizSetLoader({ quizSetId }: { quizSetId: Id<"quizSets"> }) {
	const messages = useMessages();
	const quizSet = useQuery(api.quiz.getSet, { quizSetId });
	if (quizSet === undefined) {
		return (
			<p className="text-slate-300">{messages.games.quiz.sets.loadingSet}</p>
		);
	}
	if (quizSet === null) {
		return (
			<p className="text-orange-200">{messages.games.quiz.sets.setNotFound}</p>
		);
	}
	return (
		<QuizSetEditor
			quizSetId={quizSetId}
			initialTitle={quizSet.title}
			initialDescription={quizSet.description ?? ""}
			initialQuestions={quizSet.questions}
		/>
	);
}
