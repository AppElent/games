import { createFileRoute } from "@tanstack/react-router";
import { FullscreenGamePage } from "#/components/games/FullscreenGamePage";
import { HostGate } from "#/components/games/HostGate";
import { QuizSetupForm } from "#/components/quiz/QuizSetupForm";
import { useMessages } from "#/lib/i18n";

export const Route = createFileRoute("/quiz/new")({
	component: QuizNewPage,
	staticData: { fullscreen: true },
});

function QuizNewPage() {
	const messages = useMessages();
	return (
		<FullscreenGamePage
			title={messages.catalog["live-quiz"].title}
			kicker={messages.catalog["live-quiz"].title}
			heading={messages.games.quiz.newPage.heading}
		>
			<p className="mb-6 max-w-2xl text-slate-300">
				{messages.games.quiz.newPage.intro}
			</p>
			<HostGate>
				<QuizSetupForm />
			</HostGate>
		</FullscreenGamePage>
	);
}
