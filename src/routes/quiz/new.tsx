import { createFileRoute } from "@tanstack/react-router";
import { FullscreenGamePage } from "#/components/games/FullscreenGamePage";
import { QuizSetupForm } from "#/components/quiz/QuizSetupForm";

export const Route = createFileRoute("/quiz/new")({
	component: QuizNewPage,
	staticData: { fullscreen: true },
});

function QuizNewPage() {
	return (
		<FullscreenGamePage title="Live Quiz">
			<p className="club-kicker mb-2">Live Quiz</p>
			<h1 className="club-title mb-4 text-4xl font-bold text-white">
				Host a quiz room
			</h1>
			<p className="mb-6 max-w-2xl text-slate-300">
				Create a room, show the join code, and let players answer from their own
				devices.
			</p>
			<QuizSetupForm />
		</FullscreenGamePage>
	);
}
