import type { SudokuGrid } from "./sudoku";
import {
	countSolutions,
	digitMask,
	emptyGrid,
	findConflicts,
	SUDOKU_CELL_COUNT,
} from "./sudoku";
import type { SudokuBoardState } from "./sudoku-board";
import { createBoardState } from "./sudoku-board";

export type ScanCellType =
	| "given"
	| "userDigit"
	| "cornerNotes"
	| "centerNotes"
	| "empty";

/** Recognition result for one of the 81 cells. */
export type ScanCell = {
	type: ScanCellType;
	/** Digit for `given` / `userDigit`. */
	digit: number;
	/** Note bitmasks for `cornerNotes` / `centerNotes`. */
	cornerMask: number;
	centerMask: number;
	/** 0..1 recognition confidence; low values get flagged in the verifier. */
	confidence: number;
};

export const LOW_CONFIDENCE_THRESHOLD = 0.7;

export function emptyScanCell(confidence = 1): ScanCell {
	return { type: "empty", digit: 0, cornerMask: 0, centerMask: 0, confidence };
}

export function emptyScanResult(): ScanCell[] {
	return Array.from({ length: SUDOKU_CELL_COUNT }, () => emptyScanCell());
}

export function isLowConfidence(cell: ScanCell) {
	return cell.type !== "empty" && cell.confidence < LOW_CONFIDENCE_THRESHOLD;
}

// --- verifier correction helpers (all return new arrays) ---

function withCell(cells: ScanCell[], index: number, cell: ScanCell) {
	const next = [...cells];
	next[index] = cell;
	return next;
}

/** Change the classification of a cell, keeping content where it makes sense. */
export function setScanCellType(
	cells: ScanCell[],
	index: number,
	type: ScanCellType,
): ScanCell[] {
	const current = cells[index];
	const next: ScanCell = { ...current, type, confidence: 1 };
	if (type === "empty") {
		return withCell(cells, index, emptyScanCell());
	}
	if (type === "given" || type === "userDigit") {
		next.cornerMask = 0;
		next.centerMask = 0;
		if (next.digit === 0) {
			// Adopt a single recognized note digit if there is exactly one.
			const mask = current.cornerMask | current.centerMask;
			const digits: number[] = [];
			for (let digit = 1; digit <= 9; digit += 1) {
				if (mask & digitMask(digit)) {
					digits.push(digit);
				}
			}
			next.digit = digits.length === 1 ? digits[0] : 0;
		}
	} else {
		// note types
		if (current.digit !== 0) {
			const mask = digitMask(current.digit);
			if (type === "cornerNotes") {
				next.cornerMask |= mask;
			} else {
				next.centerMask |= mask;
			}
		}
		next.digit = 0;
	}
	return withCell(cells, index, next);
}

export function setScanCellDigit(
	cells: ScanCell[],
	index: number,
	digit: number,
): ScanCell[] {
	const current = cells[index];
	const type =
		current.type === "given" || current.type === "userDigit"
			? current.type
			: "given";
	return withCell(cells, index, {
		type: digit === 0 ? "empty" : type,
		digit,
		cornerMask: 0,
		centerMask: 0,
		confidence: 1,
	});
}

export function toggleScanCellNote(
	cells: ScanCell[],
	index: number,
	kind: "corner" | "center",
	digit: number,
): ScanCell[] {
	const current = cells[index];
	const key = kind === "corner" ? "cornerMask" : "centerMask";
	const mask = current[key] ^ digitMask(digit);
	const other = kind === "corner" ? current.centerMask : current.cornerMask;
	const type: ScanCellType =
		mask === 0 && other === 0
			? "empty"
			: kind === "corner" && mask !== 0
				? "cornerNotes"
				: mask === 0
					? current.type
					: "centerNotes";
	return withCell(cells, index, {
		type,
		digit: 0,
		cornerMask: kind === "corner" ? mask : current.cornerMask,
		centerMask: kind === "center" ? mask : current.centerMask,
		confidence: 1,
	});
}

export function clearScanCell(cells: ScanCell[], index: number): ScanCell[] {
	return withCell(cells, index, emptyScanCell());
}

// --- validation before session creation ---

export type ScanValidation = {
	ok: boolean;
	/** Cells whose given/user digits break Sudoku rules. */
	conflictCells: number[];
	/** Givens alone admit at least one solution. */
	givensSolvable: boolean;
	/** Givens alone admit exactly one solution. */
	givensUnique: boolean;
	/** Givens plus user digits still admit a solution. */
	userDigitsCompatible: boolean;
	/** At least a minimal amount of content was recognized. */
	hasGivens: boolean;
	errors: string[];
};

export function scanGivensGrid(cells: ScanCell[]): SudokuGrid {
	const grid = emptyGrid();
	cells.forEach((cell, index) => {
		if (cell.type === "given" && cell.digit !== 0) {
			grid[index] = cell.digit;
		}
	});
	return grid;
}

export function scanMergedGrid(cells: ScanCell[]): SudokuGrid {
	const grid = scanGivensGrid(cells);
	cells.forEach((cell, index) => {
		if (cell.type === "userDigit" && cell.digit !== 0) {
			grid[index] = cell.digit;
		}
	});
	return grid;
}

export function validateScanResult(cells: ScanCell[]): ScanValidation {
	const errors: string[] = [];
	const givens = scanGivensGrid(cells);
	const merged = scanMergedGrid(cells);

	const conflictCells = [...findConflicts(merged)];
	if (conflictCells.length > 0) {
		errors.push("Some digits conflict in a row, column, or box.");
	}

	const givenCount = givens.filter((value) => value !== 0).length;
	const hasGivens = givenCount >= 17; // minimum clues for a unique Sudoku
	if (!hasGivens) {
		errors.push(
			`Only ${givenCount} givens recognized — a valid Sudoku needs at least 17.`,
		);
	}

	let givensSolvable = false;
	let givensUnique = false;
	let userDigitsCompatible = false;
	if (conflictCells.length === 0 && hasGivens) {
		const solutionCount = countSolutions(givens, 2);
		givensSolvable = solutionCount >= 1;
		givensUnique = solutionCount === 1;
		if (!givensSolvable) {
			errors.push("The recognized givens have no solution.");
		}
		userDigitsCompatible = givensSolvable && countSolutions(merged, 1) >= 1;
		if (givensSolvable && !userDigitsCompatible) {
			errors.push(
				"The handwritten digits are not compatible with any solution of the givens.",
			);
		}
	}

	return {
		ok: errors.length === 0,
		conflictCells,
		givensSolvable,
		givensUnique,
		userDigitsCompatible,
		hasGivens,
		errors,
	};
}

/** Convert a confirmed scan into an initial board state. */
export function scanResultToBoardState(cells: ScanCell[]): SudokuBoardState {
	const givens = scanGivensGrid(cells);
	const digits = emptyGrid();
	const corner = new Array<number>(SUDOKU_CELL_COUNT).fill(0);
	const center = new Array<number>(SUDOKU_CELL_COUNT).fill(0);
	cells.forEach((cell, index) => {
		if (cell.type === "userDigit" && cell.digit !== 0) {
			digits[index] = cell.digit;
		}
		corner[index] = cell.cornerMask;
		center[index] = cell.centerMask;
	});
	return createBoardState(givens, { digits, corner, center });
}
