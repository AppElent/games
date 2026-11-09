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
		<FullscreenGamePage
			title={messages.catalog.sudoku.title}
			kicker={messages.catalog.sudoku.title}
			heading={messages.games.sudoku.scan.pageHeading}
		>
			<SudokuScanFlow />
		</FullscreenGamePage>
	);
}
