import { createFileRoute } from "@tanstack/react-router";
import { FullscreenGamePage } from "#/components/games/FullscreenGamePage";
import { SudokuScanFlow } from "#/components/sudoku/SudokuScanFlow";
import { useMessages } from "#/lib/i18n";

export const Route = createFileRoute("/sudoku/scan")({
	component: SudokuScanPage,
	staticData: { fullscreen: true },
});

function SudokuScanPage() {
	const messages = useMessages();
	return (
		<FullscreenGamePage title={messages.catalog.sudoku.title}>
			<p className="club-kicker mb-2">{messages.catalog.sudoku.title}</p>
			<h1 className="club-title mb-4 text-4xl font-bold text-white">
				{messages.games.sudoku.scan.pageHeading}
			</h1>
			<SudokuScanFlow />
		</FullscreenGamePage>
	);
}
