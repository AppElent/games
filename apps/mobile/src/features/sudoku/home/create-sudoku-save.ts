/**
 * A fresh puzzle from the shared generators. Generation is synchronous and
 * can take a noticeable moment for Killer and large binary grids, so
 * `createSudokuSaveAfterPaint` yields a frame first to let the busy state
 * paint.
 */
import { generateBinaryPuzzle } from "@arcadeclub/core/binary-puzzle";
import { digitsToString } from "@arcadeclub/core/puzzle";
import {
	generatePuzzle,
	type SudokuDifficulty,
	type SudokuVariant,
} from "@arcadeclub/core/sudoku";
import {
	createBoardState,
	serializeBoard,
} from "@arcadeclub/core/sudoku-board";
import { generateKillerPuzzle } from "@arcadeclub/core/sudoku-killer";
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
	if (variant === "binary") {
		const puzzle = generateBinaryPuzzle(difficulty);
		return {
			...base,
			variant,
			size: puzzle.size,
			givens: digitsToString(puzzle.givens),
			entries: "0".repeat(puzzle.size * puzzle.size),
		};
	}
	const killer = variant === "killer" ? generateKillerPuzzle(difficulty) : null;
	const puzzle = killer ?? generatePuzzle(difficulty);
	return {
		...base,
		variant,
		board: serializeBoard(createBoardState(puzzle.givens)),
		solution: digitsToString(puzzle.solution),
		cages: killer?.cages,
		autoCleanup: true,
	};
}
