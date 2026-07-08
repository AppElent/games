import { createFileRoute } from "@tanstack/react-router";
import { FullscreenGamePage } from "#/components/games/FullscreenGamePage";
import { QuizSetupForm } from "#/components/quiz/QuizSetupForm";
import { useMessages } from "#/lib/i18n";

export const Route = createFileRoute("/quiz/new")({
	component: QuizNewPage,
	staticData: { fullscreen: true },
});

function QuizNewPage() {
	const messages = useMessages();
	return (
		<FullscreenGamePage title={messages.catalog["live-quiz"].title}>
			<p className="club-kicker mb-2">{messages.catalog["live-quiz"].title}</p>
			<h1 className="club-title mb-4 text-4xl font-bold text-white">
				{messages.games.quiz.newPage.heading}
			</h1>
			<p className="mb-6 max-w-2xl text-slate-300">
				{messages.games.quiz.newPage.intro}
			</p>
			<QuizSetupForm />
		</FullscreenGamePage>
	);
}
