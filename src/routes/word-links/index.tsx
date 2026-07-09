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
import { fmt, useMessages } from "#/lib/i18n";

export const Route = createFileRoute("/word-links/")({
	component: WordLinksDailyPage,
	staticData: { fullscreen: true },
	ssr: false,
});

function WordLinksDailyPage() {
	const messages = useMessages();
	const wordLinks = messages.games.wordLinks;
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
			<FullscreenGamePage title={messages.catalog["word-links"].title}>
				<p className="text-orange-200">{wordLinks.page.noPuzzle}</p>
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
					{wordLinks.page.dailyHeading}
				</h1>
				<div className="flex items-center gap-4 text-sm text-slate-300">
					{streak.current > 0 ? (
						<span>
							{fmt(wordLinks.page.streakLabel, { count: streak.current })}
						</span>
					) : null}
					{practiceId ? (
						<Link
							to="/word-links/$puzzleId"
							params={{ puzzleId: practiceId }}
							className="rounded-md border border-white/20 bg-white/10 px-4 py-2 font-bold text-white"
						>
							{wordLinks.page.practiceLink}
						</Link>
					) : null}
				</div>
			</div>
			<WordLinksGame key={puzzle.id} puzzle={puzzle} mode="daily" />
		</FullscreenGamePage>
	);
}
