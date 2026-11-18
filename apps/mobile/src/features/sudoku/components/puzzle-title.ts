import type { PuzzleDifficulty } from "@arcadeclub/core/puzzle";
import type { SudokuVariant } from "@arcadeclub/core/sudoku";
import type { Messages } from "../../../i18n";

/**
 * "Killer · Hard": how the phone names a puzzle it started. A puzzle read
 * from a photo is a "Scanned puzzle"; one with no difficulty (a scan from the
 * web) is named by its variant alone.
 */
export function puzzleTitle(
	copy: Messages["games"]["sudoku"],
	puzzle: {
		variant: SudokuVariant;
		difficulty?: PuzzleDifficulty;
		source?: "scan";
	},
) {
	if (puzzle.source === "scan") return copy.scan.scannedTitle;
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
		source?: "scan";
		cloud?: { title?: string };
	},
) {
	return save.cloud?.title || puzzleTitle(copy, save);
}
