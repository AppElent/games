import type { PuzzleDifficulty } from "@arcadeclub/core/puzzle";
import type { SudokuVariant } from "@arcadeclub/core/sudoku";
import type { Messages } from "../../../i18n";

/**
 * "Killer · Hard": how the phone names a puzzle it started. A puzzle with no
 * difficulty (a scan from the web) is named by its variant alone.
 */
export function puzzleTitle(
	copy: Messages["games"]["sudoku"],
	puzzle: { variant: SudokuVariant; difficulty?: PuzzleDifficulty },
) {
	const variant = copy.variant[puzzle.variant];
	return puzzle.difficulty
		? `${variant} · ${copy.difficulty[puzzle.difficulty]}`
		: variant;
}

/** A save's name in its header and in the list: the account's title first. */
export function saveTitle(
	copy: Messages["games"]["sudoku"],
	save: {
		variant: SudokuVariant;
		difficulty?: PuzzleDifficulty;
		cloud?: { title?: string };
	},
) {
	return save.cloud?.title || puzzleTitle(copy, save);
}
