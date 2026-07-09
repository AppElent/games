import { createFileRoute, Link } from "@tanstack/react-router";
import { FullscreenGamePage } from "#/components/games/FullscreenGamePage";
import { WordLinksGame } from "#/components/word-links/WordLinksGame";
import { getWordLinkPuzzleById } from "#/lib/games/word-links-puzzles";
import { useMessages } from "#/lib/i18n";

export const Route = createFileRoute("/word-links/$puzzleId")({
	component: WordLinksPracticePage,
	staticData: { fullscreen: true },
	ssr: false,
});

function WordLinksPracticePage() {
	const messages = useMessages();
	const wordLinks = messages.games.wordLinks;
	const { puzzleId } = Route.useParams();
	const puzzle = getWordLinkPuzzleById(puzzleId);

	if (!puzzle) {
		return (
			<FullscreenGamePage title={messages.catalog["word-links"].title}>
				<p className="text-orange-200">
					{wordLinks.page.puzzleNotFound}{" "}
					<Link to="/word-links" className="underline">
						{wordLinks.page.backToDaily}
					</Link>
				</p>
			</FullscreenGamePage>
		);
	}

	return (
		<FullscreenGamePage
			title={messages.catalog["word-links"].title}
			maxWidthClassName="max-w-xl"
		>
			<p className="club-kicker mb-2">{messages.catalog["word-links"].title}</p>
			<div className="mb-6 flex flex-wrap items-end justify-between gap-3">
				<h1 className="club-title text-4xl font-bold text-white">
					{puzzle.title ?? wordLinks.page.practicePuzzleFallback}
				</h1>
				<Link
					to="/word-links"
					className="rounded-md border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold text-white"
				>
					{wordLinks.page.dailyLink}
				</Link>
			</div>
			<WordLinksGame key={puzzle.id} puzzle={puzzle} mode="practice" />
		</FullscreenGamePage>
	);
}
