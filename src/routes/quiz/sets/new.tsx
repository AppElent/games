import { createFileRoute } from "@tanstack/react-router";
import { FullscreenGamePage } from "#/components/games/FullscreenGamePage";
import { HostGate } from "#/components/games/HostGate";
import { QuizSetEditor } from "#/components/quiz/QuizSetEditor";
import { useMessages } from "#/lib/i18n";

export const Route = createFileRoute("/quiz/sets/new")({
	component: QuizSetNewPage,
	staticData: { fullscreen: true },
});

function QuizSetNewPage() {
	const messages = useMessages();
	return (
		<FullscreenGamePage
			title={messages.games.quiz.sets.newSetTitle}
			maxWidthClassName="max-w-3xl"
		>
			<p className="club-kicker mb-2">{messages.catalog["live-quiz"].title}</p>
			<h1 className="club-title mb-6 text-4xl font-bold text-white">
				{messages.games.quiz.sets.newSetTitle}
			</h1>
			<HostGate>
				<QuizSetEditor />
			</HostGate>
		</FullscreenGamePage>
	);
}
