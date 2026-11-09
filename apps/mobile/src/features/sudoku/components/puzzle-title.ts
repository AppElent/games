import type { PuzzleDifficulty } from "@arcadeclub/core/puzzle";
import type { SudokuVariant } from "@arcadeclub/core/sudoku";
import type { Messages } from "../../../i18n";

/** "Killer · Hard": how a puzzle is named in its header and in the saved list. */
export function puzzleTitle(
	copy: Messages["games"]["sudoku"],
	puzzle: { variant: SudokuVariant; difficulty: PuzzleDifficulty },
) {
	return `${copy.variant[puzzle.variant]} · ${copy.difficulty[puzzle.difficulty]}`;
}
