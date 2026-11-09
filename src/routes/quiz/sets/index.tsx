import { createFileRoute } from "@tanstack/react-router";
import { FullscreenGamePage } from "#/components/games/FullscreenGamePage";
import { HostGate } from "#/components/games/HostGate";
import { QuizSetsList } from "#/components/quiz/QuizSetsList";
import { useI18n } from "#/lib/i18n";

export const Route = createFileRoute("/quiz/sets/")({
	component: QuizSetsPage,
	staticData: { fullscreen: true },
});

function QuizSetsPage() {
	const messages = useI18n().messages;
	return (
		<FullscreenGamePage
			title={messages.common.dashboard.quizSets}
			kicker={messages.catalog["live-quiz"].title}
			heading={messages.games.quiz.sets.heading}
		>
			<p className="mb-6 max-w-2xl text-slate-300">
				{messages.games.quiz.sets.intro}
			</p>
			<HostGate>
				<QuizSetsList />
			</HostGate>
		</FullscreenGamePage>
	);
}
