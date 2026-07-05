import { describe, expect, it } from "vitest";
import {
	findConflicts,
	generateSolvedGrid,
	mulberry32,
	SUDOKU_CELL_COUNT,
} from "../sudoku";
import {
	countKillerSolutions,
	findKillerConflicts,
	generateKillerCages,
	generateKillerPuzzle,
	isKillerSolved,
	validateKillerCages,
} from "../sudoku-killer";

describe("generateKillerCages", () => {
	it("partitions all 81 cells into disjoint contiguous cages", () => {
		const rng = mulberry32(7);
		const solution = generateSolvedGrid(rng);
		const cages = generateKillerCages(solution, rng);

		expect(validateKillerCages(cages)).toBe(true);
		const covered = cages.flatMap((cage) => cage.cells);
		expect(new Set(covered).size).toBe(SUDOKU_CELL_COUNT);
	});

	it("gives every cage the sum of its solution digits with no duplicates", () => {
		const rng = mulberry32(21);
		const solution = generateSolvedGrid(rng);
		const cages = generateKillerCages(solution, rng);

		for (const cage of cages) {
			const digits = cage.cells.map((cell) => solution[cell]);
			expect(new Set(digits).size).toBe(digits.length);
			expect(digits.reduce((a, b) => a + b, 0)).toBe(cage.sum);
		}
	});
});

describe("generateKillerPuzzle", () => {
	it("produces a puzzle whose cages + givens have a unique solution", () => {
		const rng = mulberry32(3);
		const puzzle = generateKillerPuzzle("medium", rng);

		expect(validateKillerCages(puzzle.cages)).toBe(true);
		expect(countKillerSolutions(puzzle.givens, puzzle.cages, 2)).toBe(1);
		expect(isKillerSolved(puzzle.solution, puzzle.cages)).toBe(true);
		expect(findConflicts(puzzle.solution).size).toBe(0);
	});

	it("removes more clues than a classic puzzle allows", () => {
		const puzzle = generateKillerPuzzle("expert", mulberry32(11));
		expect(puzzle.clueCount).toBeLessThanOrEqual(10);
	});
});

describe("findKillerConflicts", () => {
	it("flags duplicate digits inside a cage", () => {
		const grid = new Array(SUDOKU_CELL_COUNT).fill(0);
		grid[0] = 5;
		grid[9] = 5; // same column would flag classic too; use a cage-only case
		const cages = [{ sum: 12, cells: [0, 1] }];
		grid[1] = 5;
		const conflicts = findKillerConflicts(grid, cages);
		expect(conflicts.has(0)).toBe(true);
		expect(conflicts.has(1)).toBe(true);
	});

	it("flags a completed cage with the wrong sum", () => {
		const grid = new Array(SUDOKU_CELL_COUNT).fill(0);
		grid[0] = 2;
		grid[1] = 3;
		const conflicts = findKillerConflicts(grid, [{ sum: 9, cells: [0, 1] }]);
		expect(conflicts.has(0)).toBe(true);
		expect(conflicts.has(1)).toBe(true);
	});

	it("flags a partial cage that already exceeds its sum", () => {
		const grid = new Array(SUDOKU_CELL_COUNT).fill(0);
		grid[0] = 9;
		const conflicts = findKillerConflicts(grid, [{ sum: 8, cells: [0, 1] }]);
		expect(conflicts.has(0)).toBe(true);
	});

	it("accepts a valid partial cage", () => {
		const grid = new Array(SUDOKU_CELL_COUNT).fill(0);
		grid[0] = 3;
		const conflicts = findKillerConflicts(grid, [{ sum: 8, cells: [0, 1] }]);
		expect(conflicts.size).toBe(0);
	});
});

describe("validateKillerCages", () => {
	it("rejects overlapping or incomplete cage sets", () => {
		expect(validateKillerCages([{ sum: 5, cells: [0, 1] }])).toBe(false);
		const full = Array.from({ length: 81 }, (_, i) => ({
			sum: 5,
			cells: [i],
		}));
		expect(validateKillerCages(full)).toBe(true);
		const overlapping = [...full.slice(0, 80), { sum: 5, cells: [0] }];
		expect(validateKillerCages(overlapping)).toBe(false);
	});

	it("rejects impossible sums", () => {
		const full = Array.from({ length: 81 }, (_, i) => ({
			sum: 5,
			cells: [i],
		}));
		full[0] = { sum: 10, cells: [0] }; // single cell can't sum to 10
		expect(validateKillerCages(full)).toBe(false);
	});
});
