import { describe, expect, it } from "vitest";
import {
	BINARY_SIZES,
	binaryGridToString,
	countBinarySolutions,
	findBinaryConflicts,
	generateBinaryPuzzle,
	isBinarySolved,
	parseBinaryGrid,
	seededBinaryPuzzle,
} from "../binary-puzzle";
import { mulberry32 } from "../sudoku";

describe("findBinaryConflicts", () => {
	it("flags three identical digits in a row", () => {
		const size = 6;
		const grid = new Array(size * size).fill(0);
		grid[0] = 1;
		grid[1] = 1;
		grid[2] = 1;
		const conflicts = findBinaryConflicts(grid, size);
		expect(conflicts.has(0)).toBe(true);
		expect(conflicts.has(1)).toBe(true);
		expect(conflicts.has(2)).toBe(true);
	});

	it("flags three identical digits in a column", () => {
		const size = 6;
		const grid = new Array(size * size).fill(0);
		grid[0] = 2;
		grid[6] = 2;
		grid[12] = 2;
		expect(findBinaryConflicts(grid, size).size).toBe(3);
	});

	it("flags a row with too many of one digit", () => {
		const size = 6;
		const grid = new Array(size * size).fill(0);
		// four 0s in a 6-wide row (max is 3), spaced to avoid triples
		grid[0] = 1;
		grid[1] = 1;
		grid[3] = 1;
		grid[4] = 1;
		const conflicts = findBinaryConflicts(grid, size);
		expect(conflicts.size).toBeGreaterThan(0);
	});

	it("flags duplicate completed rows", () => {
		const size = 6;
		const grid = new Array(size * size).fill(0);
		const pattern = [1, 2, 1, 2, 1, 2];
		for (let col = 0; col < size; col += 1) {
			grid[col] = pattern[col];
			grid[size * 3 + col] = pattern[col];
		}
		const conflicts = findBinaryConflicts(grid, size);
		expect(conflicts.size).toBe(12);
	});

	it("accepts a legal partial grid", () => {
		const size = 6;
		const grid = new Array(size * size).fill(0);
		grid[0] = 1;
		grid[1] = 1;
		grid[2] = 2;
		expect(findBinaryConflicts(grid, size).size).toBe(0);
	});
});

describe("generateBinaryPuzzle", () => {
	it("generates uniquely solvable puzzles for every difficulty", () => {
		for (const difficulty of ["easy", "medium"] as const) {
			const puzzle = generateBinaryPuzzle(difficulty, mulberry32(5));
			expect(puzzle.size).toBe(BINARY_SIZES[difficulty]);
			expect(isBinarySolved(puzzle.solution, puzzle.size)).toBe(true);
			expect(countBinarySolutions(puzzle.givens, puzzle.size, 2)).toBe(1);
			// givens must be a subset of the solution
			puzzle.givens.forEach((value, cell) => {
				if (value !== 0) {
					expect(value).toBe(puzzle.solution[cell]);
				}
			});
		}
	});

	it("is deterministic for a given seed", () => {
		const a = seededBinaryPuzzle(42, "easy");
		const b = seededBinaryPuzzle(42, "easy");
		expect(a.givens).toEqual(b.givens);
		expect(a.solution).toEqual(b.solution);
	});

	it("hard puzzles solve uniquely at 10x10", () => {
		const puzzle = generateBinaryPuzzle("hard", mulberry32(9));
		expect(puzzle.size).toBe(10);
		expect(countBinarySolutions(puzzle.givens, puzzle.size, 2)).toBe(1);
	});
});

describe("serialization", () => {
	it("round-trips grids through strings", () => {
		const puzzle = seededBinaryPuzzle(1, "easy");
		const text = binaryGridToString(puzzle.givens);
		expect(text).toHaveLength(36);
		expect(parseBinaryGrid(text, puzzle.size)).toEqual(puzzle.givens);
	});

	it("rejects malformed grids", () => {
		expect(() => parseBinaryGrid("012", 6)).toThrow();
		expect(() => parseBinaryGrid("3".repeat(36), 6)).toThrow();
	});
});
