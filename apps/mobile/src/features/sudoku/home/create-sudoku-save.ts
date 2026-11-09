/**
 * A fresh puzzle from the shared generators. Generation is synchronous and
 * can take a noticeable moment for Killer and large binary grids, so
 * `createSudokuSaveAfterPaint` yields a frame first to let the busy state
 * paint.
 */
import { digitsToString } from "@arcadeclub/core/puzzle";
import type { SudokuDifficulty, SudokuVariant } from "@arcadeclub/core/sudoku";
import {
	createBoardState,
	serializeBoard,
} from "@arcadeclub/core/sudoku-board";
import { generateVariantPuzzle } from "@arcadeclub/core/sudoku-variants";
import { newSaveId, type SudokuSave } from "../saves/sudoku-save-store";

/** Long enough for the frame that shows the busy state to be drawn. */
const PAINT_DELAY_MS = 32;

/** The new puzzle, generated once the busy state has painted. */
export function createSudokuSaveAfterPaint(
	variant: SudokuVariant,
	difficulty: SudokuDifficulty,
): Promise<SudokuSave> {
	return new Promise((resolve, reject) => {
		setTimeout(() => {
			try {
				resolve(createSudokuSave(variant, difficulty));
			} catch (error) {
				reject(error);
			}
		}, PAINT_DELAY_MS);
	});
}

function createSudokuSave(
	variant: SudokuVariant,
	difficulty: SudokuDifficulty,
	now = Date.now(),
): SudokuSave {
	const base = {
		id: newSaveId(now),
		difficulty,
		updatedAt: now,
		elapsedSeconds: 0,
		status: "active" as const,
	};
	const puzzle = generateVariantPuzzle(variant, difficulty);
	if (puzzle.variant === "binary") {
		return {
			...base,
			variant: puzzle.variant,
			size: puzzle.size,
			givens: digitsToString(puzzle.givens),
			entries: "0".repeat(puzzle.size * puzzle.size),
		};
	}
	return {
		...base,
		variant: puzzle.variant,
		board: serializeBoard(createBoardState(puzzle.givens)),
		solution: digitsToString(puzzle.solution),
		cages: puzzle.variant === "killer" ? puzzle.cages : undefined,
		autoCleanup: true,
	};
}
