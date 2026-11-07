import { describe, expect, it } from "vitest";
import { mulberry32 } from "../random";
import {
	emptyGrid,
	findConflicts,
	generateSolvedGrid,
	SUDOKU_CELL_COUNT,
} from "../sudoku";
import { createBoardState } from "../sudoku-board";
import {
	boardConflictsWithCages,
	countKillerSolutions,
	findKillerConflicts,
	generateKillerCages,
	generateKillerPuzzle,
	isBoardSolved,
	isKillerSolved,
	killerCageLayout,
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

describe("board verdicts", () => {
	const solution = generateSolvedGrid(mulberry32(5));
	const cages = generateKillerCages(solution, mulberry32(6));

	it("adds cage conflicts to peer conflicts only when there are cages", () => {
		const givens = emptyGrid();
		givens[0] = 5;
		givens[1] = 5;
		const board = createBoardState(givens);
		expect(boardConflictsWithCages(board)).toEqual(new Set([0, 1]));

		const overSum = createBoardState(emptyGrid());
		overSum.digits[40] = 9;
		const cage = { sum: 5, cells: [40, 41] };
		expect(boardConflictsWithCages(overSum)).toEqual(new Set());
		expect(boardConflictsWithCages(overSum, [cage])).toEqual(new Set([40]));
	});

	it("calls a board solved when it is complete and no cage objects", () => {
		const board = createBoardState(solution);
		expect(isBoardSolved(board)).toBe(true);
		expect(isBoardSolved(board, cages)).toBe(true);
		expect(isBoardSolved(board, [{ ...cages[0], sum: cages[0].sum + 1 }])).toBe(
			false,
		);
		expect(isBoardSolved(createBoardState(emptyGrid()))).toBe(false);
	});
});

describe("killerCageLayout", () => {
	it("has nothing to draw without cages", () => {
		expect(killerCageLayout(undefined)).toBeNull();
		expect(killerCageLayout([])).toBeNull();
	});

	it("labels each cage on its first cell and outlines it", () => {
		const layout = killerCageLayout([
			{ sum: 7, cells: [0, 1, 9] },
			{ sum: 3, cells: [10] },
		]);
		expect(layout?.sumAt).toEqual(
			new Map([
				[0, 7],
				[10, 3],
			]),
		);
		expect(layout?.byCell.slice(0, 2)).toEqual([0, 0]);
		expect(layout?.byCell[2]).toBe(-1);
		expect(layout?.byCell[10]).toBe(1);
		expect(layout?.edges[0]).toEqual({
			top: true,
			bottom: false,
			left: true,
			right: false,
		});
		expect(layout?.edges[1]).toEqual({
			top: true,
			bottom: true,
			left: false,
			right: true,
		});
		expect(layout?.edges[10]).toEqual({
			top: true,
			bottom: true,
			left: true,
			right: true,
		});
	});
});
