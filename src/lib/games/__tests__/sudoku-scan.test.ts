import { describe, expect, it } from "vitest";
import {
	digitsInMask,
	generatePuzzle,
	mulberry32,
} from "../sudoku";
import {
	clearScanCell,
	emptyScanResult,
	isLowConfidence,
	scanResultToBoardState,
	setScanCellDigit,
	setScanCellType,
	toggleScanCellNote,
	validateScanResult,
} from "../sudoku-scan";
import type { ScanCell } from "../sudoku-scan";

function scanFromPuzzle(seed = 5) {
	const puzzle = generatePuzzle("easy", mulberry32(seed));
	const cells = emptyScanResult();
	puzzle.givens.forEach((value, index) => {
		if (value !== 0) {
			cells[index] = {
				type: "given",
				digit: value,
				cornerMask: 0,
				centerMask: 0,
				confidence: 0.95,
			};
		}
	});
	return { puzzle, cells };
}

describe("scan validation", () => {
	it("accepts a clean scan of a valid puzzle", () => {
		const { cells } = scanFromPuzzle();
		const result = validateScanResult(cells);
		expect(result.ok).toBe(true);
		expect(result.conflictCells).toEqual([]);
		expect(result.givensSolvable).toBe(true);
		expect(result.givensUnique).toBe(true);
		expect(result.userDigitsCompatible).toBe(true);
	});

	it("flags rule conflicts between recognized digits", () => {
		const { puzzle, cells } = scanFromPuzzle();
		const givenCell = puzzle.givens.findIndex((value) => value !== 0);
		const row = Math.floor(givenCell / 9);
		const emptyInRow = puzzle.givens.findIndex(
			(value, index) => value === 0 && Math.floor(index / 9) === row,
		);
		const conflicted = setScanCellDigit(
			cells,
			emptyInRow,
			puzzle.givens[givenCell],
		);
		const result = validateScanResult(conflicted);
		expect(result.ok).toBe(false);
		expect(result.conflictCells).toContain(givenCell);
		expect(result.conflictCells).toContain(emptyInRow);
	});

	it("rejects scans with too few givens", () => {
		const cells = emptyScanResult();
		const result = validateScanResult(setScanCellDigit(cells, 0, 5));
		expect(result.ok).toBe(false);
		expect(result.hasGivens).toBe(false);
	});

	it("rejects handwritten user digits incompatible with the solution", () => {
		const { puzzle, cells } = scanFromPuzzle();
		const emptyCell = puzzle.givens.findIndex((value) => value === 0);
		// A digit that differs from the unique solution but does not conflict
		// directly may still make the puzzle unsolvable.
		const wrong = (puzzle.solution[emptyCell] % 9) + 1;
		let scanned = setScanCellDigit(cells, emptyCell, wrong);
		scanned = setScanCellType(scanned, emptyCell, "userDigit");
		const result = validateScanResult(scanned);
		// The wrong digit either conflicts outright or breaks solvability.
		expect(result.ok).toBe(false);
	});

	it("accepts partially solved scans with correct user digits", () => {
		const { puzzle, cells } = scanFromPuzzle();
		let scanned = cells;
		let placed = 0;
		puzzle.givens.forEach((value, index) => {
			if (value === 0 && placed < 5) {
				scanned = setScanCellDigit(scanned, index, puzzle.solution[index]);
				scanned = setScanCellType(scanned, index, "userDigit");
				placed += 1;
			}
		});
		const result = validateScanResult(scanned);
		expect(result.ok).toBe(true);
		expect(result.userDigitsCompatible).toBe(true);
	});

	it("ignores notes when checking conflicts", () => {
		const { puzzle, cells } = scanFromPuzzle();
		const givenCell = puzzle.givens.findIndex((value) => value !== 0);
		const row = Math.floor(givenCell / 9);
		const emptyInRow = puzzle.givens.findIndex(
			(value, index) => value === 0 && Math.floor(index / 9) === row,
		);
		// A corner note with the same digit as a given in the row is fine.
		const noted = toggleScanCellNote(
			cells,
			emptyInRow,
			"corner",
			puzzle.givens[givenCell],
		);
		expect(validateScanResult(noted).ok).toBe(true);
	});
});

describe("verifier corrections", () => {
	const base: ScanCell = {
		type: "given",
		digit: 4,
		cornerMask: 0,
		centerMask: 0,
		confidence: 0.5,
	};

	it("flags low-confidence recognitions", () => {
		expect(isLowConfidence(base)).toBe(true);
		expect(isLowConfidence({ ...base, confidence: 0.95 })).toBe(false);
		expect(isLowConfidence({ ...base, type: "empty", digit: 0 })).toBe(false);
	});

	it("changes given to userDigit and back, keeping the digit", () => {
		let cells = emptyScanResult();
		cells[10] = base;
		cells = setScanCellType(cells, 10, "userDigit");
		expect(cells[10].type).toBe("userDigit");
		expect(cells[10].digit).toBe(4);
		cells = setScanCellType(cells, 10, "given");
		expect(cells[10].type).toBe("given");
		expect(cells[10].digit).toBe(4);
		expect(cells[10].confidence).toBe(1); // user-confirmed
	});

	it("converts a digit into a note and a single note back into a digit", () => {
		let cells = emptyScanResult();
		cells[10] = base;
		cells = setScanCellType(cells, 10, "cornerNotes");
		expect(cells[10].digit).toBe(0);
		expect(digitsInMask(cells[10].cornerMask)).toEqual([4]);
		cells = setScanCellType(cells, 10, "given");
		expect(cells[10].digit).toBe(4);
		expect(cells[10].cornerMask).toBe(0);
	});

	it("edits corner and center notes", () => {
		let cells = emptyScanResult();
		cells = toggleScanCellNote(cells, 0, "corner", 1);
		cells = toggleScanCellNote(cells, 0, "corner", 2);
		cells = toggleScanCellNote(cells, 0, "center", 3);
		expect(digitsInMask(cells[0].cornerMask)).toEqual([1, 2]);
		expect(digitsInMask(cells[0].centerMask)).toEqual([3]);
		cells = toggleScanCellNote(cells, 0, "corner", 1);
		cells = toggleScanCellNote(cells, 0, "corner", 2);
		cells = toggleScanCellNote(cells, 0, "center", 3);
		expect(cells[0].type).toBe("empty");
	});

	it("clears a cell entirely", () => {
		let cells = emptyScanResult();
		cells[7] = base;
		cells = clearScanCell(cells, 7);
		expect(cells[7].type).toBe("empty");
		expect(cells[7].digit).toBe(0);
	});

	it("changing the digit of an empty cell classifies it as a given", () => {
		let cells = emptyScanResult();
		cells = setScanCellDigit(cells, 3, 9);
		expect(cells[3].type).toBe("given");
		expect(cells[3].digit).toBe(9);
		cells = setScanCellDigit(cells, 3, 0);
		expect(cells[3].type).toBe("empty");
	});
});

describe("scan to board state", () => {
	it("maps givens, user digits, and notes into a playable board", () => {
		const { puzzle, cells } = scanFromPuzzle();
		const emptyCell = puzzle.givens.findIndex((value) => value === 0);
		let scanned = setScanCellDigit(cells, emptyCell, puzzle.solution[emptyCell]);
		scanned = setScanCellType(scanned, emptyCell, "userDigit");
		const noteCell = puzzle.givens.findIndex(
			(value, index) => value === 0 && index !== emptyCell,
		);
		scanned = toggleScanCellNote(scanned, noteCell, "center", 5);

		const state = scanResultToBoardState(scanned);
		expect(state.givens).toEqual(puzzle.givens);
		expect(state.digits[emptyCell]).toBe(puzzle.solution[emptyCell]);
		expect(digitsInMask(state.center[noteCell])).toEqual([5]);
		// user digits stay editable: they are not part of givens
		expect(state.givens[emptyCell]).toBe(0);
	});
});
