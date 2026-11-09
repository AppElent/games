import { describe, expect, it } from "vitest";
import { digitsFromString, digitsToString, removeClues } from "../puzzle";

describe("digit codec", () => {
	it("round-trips a grid through one digit per cell", () => {
		const grid = [0, 1, 9, 0, 5];
		expect(digitsToString(grid)).toBe("01905");
		expect(digitsFromString("01905")).toEqual(grid);
	});
});

describe("removeClues", () => {
	it("empties cells in order until the target is reached", () => {
		const removed = removeClues([1, 2, 3, 4], [3, 2, 1, 0], 2, () => true);
		expect(removed).toEqual({ givens: [1, 2, 0, 0], clueCount: 2 });
	});

	it("restores a cell whose removal breaks uniqueness", () => {
		const removed = removeClues(
			[1, 2, 3],
			[0, 1, 2],
			0,
			(givens) => givens[1] !== 0,
		);
		expect(removed).toEqual({ givens: [0, 2, 0], clueCount: 1 });
	});

	it("skips cells that are already empty and counts only filled ones", () => {
		const checked: number[][] = [];
		const removed = removeClues([0, 2, 3], [0, 1, 2], 1, (givens) => {
			checked.push([...givens]);
			return true;
		});
		expect(checked).toEqual([[0, 0, 3]]);
		expect(removed).toEqual({ givens: [0, 0, 3], clueCount: 1 });
	});

	it("does not touch the grid it was given", () => {
		const grid = [1, 2];
		removeClues(grid, [0, 1], 0, () => true);
		expect(grid).toEqual([1, 2]);
	});
});
