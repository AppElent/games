import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { FullscreenGamePage } from "#/components/games/FullscreenGamePage";
import { WordLinksGame } from "#/components/word-links/WordLinksGame";
import { getDailyPuzzleId } from "#/lib/games/word-links";
import { loadWordLinkStreak } from "#/lib/games/word-links-local";
import {
	getWordLinkPuzzleById,
	WORD_LINK_PUZZLES,
} from "#/lib/games/word-links-puzzles";

export const Route = createFileRoute("/word-links/")({
	component: WordLinksDailyPage,
	staticData: { fullscreen: true },
	ssr: false,
});

function WordLinksDailyPage() {
	const dailyId = getDailyPuzzleId(WORD_LINK_PUZZLES);
	const puzzle = getWordLinkPuzzleById(dailyId);
	const streak = useMemo(() => loadWordLinkStreak(), []);
	const practiceId = useMemo(() => {
		const others = WORD_LINK_PUZZLES.filter(
			(candidate) => candidate.id !== dailyId,
		);
		return others[Math.floor(Math.random() * others.length)]?.id;
	}, [dailyId]);

	if (!puzzle) {
		return (
			<FullscreenGamePage title="Word Links">
				<p className="text-orange-200">No puzzle.</p>
			</FullscreenGamePage>
		);
	}

	return (
		<FullscreenGamePage title="Word Links" maxWidthClassName="max-w-xl">
			<p className="club-kicker mb-2">Word Links</p>
			<div className="mb-6 flex flex-wrap items-end justify-between gap-3">
				<h1 className="club-title text-4xl font-bold text-white">
					Daily puzzle
				</h1>
				<div className="flex items-center gap-4 text-sm text-slate-300">
					{streak.current > 0 ? <span>🔥 Streak: {streak.current}</span> : null}
					{practiceId ? (
						<Link
							to="/word-links/$puzzleId"
							params={{ puzzleId: practiceId }}
							className="rounded-md border border-white/20 bg-white/10 px-4 py-2 font-bold text-white"
						>
							Practice
						</Link>
					) : null}
				</div>
			</div>
			<WordLinksGame key={puzzle.id} puzzle={puzzle} mode="daily" />
		</FullscreenGamePage>
	);
}
