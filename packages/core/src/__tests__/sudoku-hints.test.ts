import { describe, expect, it } from "vitest";
import {
	cellAt,
	emptyGrid,
	generatePuzzle,
	mulberry32,
	parseGrid,
} from "../sudoku";
import { findHint, hintTextForLevel, SUDOKU_TECHNIQUES } from "../sudoku-hints";

function detectorsById(id: string) {
	const detector = SUDOKU_TECHNIQUES.find((technique) => technique.id === id);
	if (!detector) {
		throw new Error(`Unknown technique ${id}`);
	}
	return [detector];
}

const KNOWN_PUZZLE =
	"530070000600195000098000060800060003400803001700020006060000280000419005000080079";

describe("sudoku hints", () => {
	it("finds a naked single on an almost-solved grid", () => {
		const puzzle = generatePuzzle("easy", mulberry32(3));
		const grid = [...puzzle.solution];
		const cell = 40;
		grid[cell] = 0;
		const hint = findHint(grid);
		expect(hint?.technique).toBe("naked-single");
		expect(hint?.placements).toEqual([{ cell, digit: puzzle.solution[cell] }]);
		expect(hint?.cells).toEqual([cell]);
	});

	it("finds a hidden single via cross-hatching a box", () => {
		const grid = emptyGrid();
		grid[cellAt(0, 4)] = 1; // blocks row 0
		grid[cellAt(1, 7)] = 1; // blocks row 1
		grid[cellAt(5, 0)] = 1; // blocks column 0
		grid[cellAt(7, 1)] = 1; // blocks column 1
		const hint = findHint(grid, detectorsById("hidden-single"));
		expect(hint?.technique).toBe("hidden-single");
		expect(hint?.placements).toEqual([{ cell: cellAt(2, 2), digit: 1 }]);
		expect(hint?.explanation).toContain("Cross-hatching");
	});

	it("finds a pointing triple with eliminations outside the box", () => {
		const grid = emptyGrid();
		// Fill rows 1-2 of box 0 so digit 1 in box 0 is confined to row 0.
		grid[cellAt(1, 0)] = 2;
		grid[cellAt(1, 1)] = 3;
		grid[cellAt(1, 2)] = 4;
		grid[cellAt(2, 0)] = 5;
		grid[cellAt(2, 1)] = 6;
		grid[cellAt(2, 2)] = 7;
		const hint = findHint(grid, detectorsById("pointing"));
		expect(hint?.technique).toBe("pointing");
		expect(hint?.candidateDigits).toEqual([1]);
		expect(hint?.cells).toEqual([cellAt(0, 0), cellAt(0, 1), cellAt(0, 2)]);
		const eliminatedCells = hint?.eliminations.map((entry) => entry.cell) ?? [];
		expect(eliminatedCells).toContain(cellAt(0, 4));
		for (const entry of hint?.eliminations ?? []) {
			expect(entry.digits).toEqual([1]);
		}
	});

	it("finds a box-line reduction", () => {
		const grid = emptyGrid();
		// Row 0: digits 2-7 fill columns 3-8, so 1 is confined to box 0.
		grid[cellAt(0, 3)] = 2;
		grid[cellAt(0, 4)] = 3;
		grid[cellAt(0, 5)] = 4;
		grid[cellAt(0, 6)] = 5;
		grid[cellAt(0, 7)] = 6;
		grid[cellAt(0, 8)] = 7;
		const hint = findHint(grid, detectorsById("box-line-reduction"));
		expect(hint?.technique).toBe("box-line-reduction");
		expect(hint?.candidateDigits).toEqual([1]);
		const eliminatedCells = hint?.eliminations.map((entry) => entry.cell) ?? [];
		expect(eliminatedCells).toContain(cellAt(1, 0));
		expect(eliminatedCells).not.toContain(cellAt(0, 0));
	});

	it("finds a naked pair", () => {
		const grid = emptyGrid();
		// Row 0 columns 2-8 hold 1-7, leaving {8,9} in R1C1 and R1C2.
		for (let col = 2; col <= 8; col += 1) {
			grid[cellAt(0, col)] = col - 1;
		}
		const hint = findHint(grid, detectorsById("naked-pair"));
		expect(hint?.technique).toBe("naked-pair");
		expect(hint?.candidateDigits).toEqual([8, 9]);
		expect(hint?.cells.sort()).toEqual([cellAt(0, 0), cellAt(0, 1)]);
		expect(hint?.eliminations.length).toBeGreaterThan(0);
	});

	it("finds a hidden pair", () => {
		const grid = emptyGrid();
		// Row 0: columns 4-8 filled with 1-5; 8 and 9 blocked from
		// columns 2 and 3 — so in row 0 they fit only in columns 0-1.
		grid[cellAt(0, 4)] = 1;
		grid[cellAt(0, 5)] = 2;
		grid[cellAt(0, 6)] = 3;
		grid[cellAt(0, 7)] = 4;
		grid[cellAt(0, 8)] = 5;
		grid[cellAt(3, 2)] = 8;
		grid[cellAt(4, 2)] = 9;
		grid[cellAt(5, 3)] = 8;
		grid[cellAt(6, 3)] = 9;
		const hint = findHint(grid, detectorsById("hidden-pair"));
		expect(hint?.technique).toBe("hidden-pair");
		expect(hint?.candidateDigits).toEqual([8, 9]);
		expect(hint?.cells.sort()).toEqual([cellAt(0, 0), cellAt(0, 1)]);
		expect(hint?.eliminations.length).toBeGreaterThan(0);
	});

	it("suggests Snyder notation when a box digit is down to two cells", () => {
		const grid = emptyGrid();
		grid[cellAt(1, 0)] = 2;
		grid[cellAt(1, 1)] = 3;
		grid[cellAt(1, 2)] = 4;
		grid[cellAt(2, 0)] = 5;
		grid[cellAt(2, 1)] = 6;
		grid[cellAt(2, 2)] = 7;
		grid[cellAt(0, 2)] = 8;
		const hint = findHint(grid, detectorsById("snyder-pair"));
		expect(hint?.technique).toBe("snyder-pair");
		expect(hint?.cells).toHaveLength(2);
		expect(hint?.placements).toEqual([]);
	});

	it("returns structured hints with three explanation levels", () => {
		const grid = parseGrid(KNOWN_PUZZLE);
		const hint = findHint(grid);
		expect(hint).not.toBeNull();
		if (!hint) {
			return;
		}
		expect(hint.title.length).toBeGreaterThan(0);
		expect(hint.cells.length).toBeGreaterThan(0);
		expect(hint.candidateDigits.length).toBeGreaterThan(0);
		expect(hintTextForLevel(hint, 1)).toBe(hint.nudge);
		expect(hintTextForLevel(hint, 2)).toBe(hint.direction);
		expect(hintTextForLevel(hint, 3)).toBe(hint.explanation);
		// Level 1 stays a nudge: it never names the exact digit placement.
		expect(hint.nudge).not.toBe(hint.explanation);
	});

	it("hints on a real puzzle agree with the actual solution", () => {
		const puzzle = generatePuzzle("medium", mulberry32(21));
		const hint = findHint(puzzle.givens);
		expect(hint).not.toBeNull();
		for (const placement of hint?.placements ?? []) {
			expect(puzzle.solution[placement.cell]).toBe(placement.digit);
		}
		for (const elimination of hint?.eliminations ?? []) {
			expect(elimination.digits).not.toContain(
				puzzle.solution[elimination.cell],
			);
		}
	});
});
