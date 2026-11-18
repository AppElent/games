import { Redirect } from "expo-router";
import { sudokuScanner } from "../../modules/sudoku-scanner";
import { SudokuScanScreen } from "../../src/features/sudoku/scan/sudoku-scan-screen";

export default function SudokuScanRoute() {
	// A build without the scanner (Android, or one from before it shipped)
	// has no scan entry; a link here goes to the Sudoku home instead.
	if (!sudokuScanner) return <Redirect href="/sudoku" />;
	return <SudokuScanScreen />;
}
