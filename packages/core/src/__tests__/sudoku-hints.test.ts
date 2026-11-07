import { describe, expect, it } from "vitest";
import { sudoku as en } from "../i18n/en/games/sudoku";
import { sudoku as nl } from "../i18n/nl/games/sudoku";
import { mulberry32 } from "../random";
import {
	computeCandidates,
	emptyGrid,
	generatePuzzle,
	parseGrid,
} from "../sudoku";
import { describeHint, findHint, SUDOKU_TECHNIQUES } from "../sudoku-hints";

const cellAt = (row: number, col: number) => row * 9 + col;

/** Runs one technique alone, so earlier techniques in the order can't win. */
function hintFrom(id: string, grid: number[]) {
	const detector = SUDOKU_TECHNIQUES.find((technique) => technique.id === id);
	if (!detector) {
		throw new Error(`Unknown technique ${id}`);
	}
	return detector.detect(grid, computeCandidates(grid));
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
		const hint = hintFrom("hidden-single", grid);
		expect(hint?.technique).toBe("hidden-single");
		expect(hint?.placements).toEqual([{ cell: cellAt(2, 2), digit: 1 }]);
		expect(hint && describeHint(hint, 3, en.hints).text).toContain(
			"Cross-hatching the box",
		);
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
		const hint = hintFrom("pointing", grid);
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
		const hint = hintFrom("box-line-reduction", grid);
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
		const hint = hintFrom("naked-pair", grid);
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
		const hint = hintFrom("hidden-pair", grid);
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
		const hint = hintFrom("snyder-pair", grid);
		expect(hint?.technique).toBe("snyder-pair");
		expect(hint?.cells).toHaveLength(2);
		expect(hint?.placements).toEqual([]);
	});

	it("describes a hint at three levels in each language", () => {
		const hint = findHint(parseGrid(KNOWN_PUZZLE));
		expect(hint).not.toBeNull();
		if (!hint) {
			return;
		}
		for (const copy of [en.hints, nl.hints]) {
			const levels = ([1, 2, 3] as const).map(
				(level) => describeHint(hint, level, copy).text,
			);
			expect(new Set(levels).size).toBe(3);
			for (const text of levels) {
				expect(text).not.toMatch(/\{\w+\}/);
			}
		}
		expect(describeHint(hint, 3, nl.hints).text).toMatch(/R\dK\d/);
	});

	it("points out a wrong digit before any technique", () => {
		const puzzle = generatePuzzle("easy", mulberry32(5));
		const grid = [...puzzle.givens];
		const cell = grid.indexOf(0);
		grid[cell] = (puzzle.solution[cell] % 9) + 1;
		const hint = findHint(grid, {
			solution: puzzle.solution,
			givens: puzzle.givens,
		});
		expect(hint?.technique).toBe("mistake");
		expect(hint?.cells).toEqual([cell]);
	});

	it("without the solution, blames a placed digit that clashes, not a given", () => {
		const grid = emptyGrid();
		const givens = emptyGrid();
		givens[cellAt(0, 0)] = 1;
		grid[cellAt(0, 0)] = 1;
		grid[cellAt(0, 5)] = 1;
		const hint = findHint(grid, { givens });
		expect(hint?.technique).toBe("mistake");
		expect(hint?.cells).toEqual([cellAt(0, 5)]);
		expect(hint && describeHint(hint, 2, en.hints).text).toContain("R1C6");
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
