import { createFileRoute } from "@tanstack/react-router";
import { SudokuScanFlow } from "#/components/sudoku/SudokuScanFlow";

export const Route = createFileRoute("/sudoku/scan")({
	component: SudokuScanPage,
});

function SudokuScanPage() {
	return (
		<main className="club-wrap py-10">
			<p className="club-kicker mb-2">Sudoku</p>
			<h1 className="club-title mb-4 text-4xl font-bold text-white">
				Scan a paper puzzle
			</h1>
			<SudokuScanFlow />
		</main>
	);
}
