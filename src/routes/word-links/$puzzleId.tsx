import { createFileRoute, Link } from "@tanstack/react-router";
import { FullscreenGamePage } from "#/components/games/FullscreenGamePage";
import { WordLinksGame } from "#/components/word-links/WordLinksGame";
import { getWordLinkPuzzleById } from "#/lib/games/word-links-puzzles";

export const Route = createFileRoute("/word-links/$puzzleId")({
	component: WordLinksPracticePage,
	staticData: { fullscreen: true },
	ssr: false,
});

function WordLinksPracticePage() {
	const { puzzleId } = Route.useParams();
	const puzzle = getWordLinkPuzzleById(puzzleId);

	if (!puzzle) {
		return (
			<FullscreenGamePage title="Word Links">
				<p className="text-orange-200">
					Puzzle not found.{" "}
					<Link to="/word-links" className="underline">
						Back to the daily puzzle
					</Link>
				</p>
			</FullscreenGamePage>
		);
	}

	return (
		<FullscreenGamePage title="Word Links" maxWidthClassName="max-w-xl">
			<p className="club-kicker mb-2">Word Links</p>
			<div className="mb-6 flex flex-wrap items-end justify-between gap-3">
				<h1 className="club-title text-4xl font-bold text-white">
					{puzzle.title ?? "Practice puzzle"}
				</h1>
				<Link
					to="/word-links"
					className="rounded-md border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold text-white"
				>
					Daily puzzle
				</Link>
			</div>
			<WordLinksGame key={puzzle.id} puzzle={puzzle} mode="practice" />
		</FullscreenGamePage>
	);
}
