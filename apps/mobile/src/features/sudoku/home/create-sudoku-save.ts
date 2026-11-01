/**
 * A fresh puzzle from the shared generators. Generation is synchronous and
 * can take a noticeable moment for Killer and large binary grids, so callers
 * yield a frame first to let the busy state paint.
 */
import {
	binaryGridToString,
	generateBinaryPuzzle,
} from "@arcadeclub/core/binary-puzzle";
import {
	generatePuzzle,
	gridToString,
	type SudokuDifficulty,
} from "@arcadeclub/core/sudoku";
import {
	createBoardState,
	serializeBoard,
} from "@arcadeclub/core/sudoku-board";
import { generateKillerPuzzle } from "@arcadeclub/core/sudoku-killer";
import {
	newSaveId,
	type SudokuSave,
	type SudokuVariant,
} from "../saves/sudoku-save-store";

export function createSudokuSave(
	variant: SudokuVariant,
	difficulty: SudokuDifficulty,
	now = Date.now(),
): SudokuSave {
	const base = {
		id: newSaveId(now),
		difficulty,
		createdAt: now,
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
			givens: binaryGridToString(puzzle.givens),
			entries: "0".repeat(puzzle.size * puzzle.size),
			solution: binaryGridToString(puzzle.solution),
		};
	}
	const killer = variant === "killer" ? generateKillerPuzzle(difficulty) : null;
	const puzzle = killer ?? generatePuzzle(difficulty);
	return {
		...base,
		variant,
		board: serializeBoard(createBoardState(puzzle.givens)),
		solution: gridToString(puzzle.solution),
		cages: killer?.cages,
		autoCleanup: true,
	};
}
