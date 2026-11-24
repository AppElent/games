import {
	emptyScanResult,
	isLowConfidence,
	type ScanCell,
} from "@arcadeclub/core/sudoku-scan";
import { doubtWrongGrid } from "./doubt-grid";

/** Two sure digits and a sure note, in the first three cells. */
const scan = (): ScanCell[] => {
	const cells = emptyScanResult();
	cells[0] = { ...cells[0], type: "given", digit: 1 };
	cells[1] = { ...cells[1], type: "userDigit", digit: 2 };
	cells[2] = { ...cells[2], type: "cornerNotes", cornerMask: 2 };
	return cells;
};

/** Ten lines from a drawing: a dot is a line that was not found. */
const lines = (drawn: string) => [...drawn].map((line) => line !== ".");
const mesh = (vertical: string, horizontal: string, moved = 0) => ({
	found: { vertical: lines(vertical), horizontal: lines(horizontal) },
	moved,
});

describe("doubtWrongGrid", () => {
	it.each([
		["every line is found", "||||||||||", "||||||||||"],
		["the thin lines one way are too faint", "||||||||||", "|..|..|..|"],
		["only some thin lines are found", "|..|..|.||", "|..|..|..|"],
		["outer lines are off the photo", ".||||||||.", ".|||||||||"],
	])("trusts the grid when %s", (_, vertical, horizontal) => {
		const cells = scan();
		expect(doubtWrongGrid(cells, mesh(vertical, horizontal))).toBe(cells);
	});

	it.each([
		["a line between boxes is missing", "|||.||||||", "||||||||||"],
		["the other line between boxes is", "||||||||||", "||||||.|||"],
		["one box was taken for the grid", "|..|..|..|", "|..|..|..|"],
		["there are no lines", "..........", ".........."],
	])("flags every digit and note when %s", (_, vertical, horizontal) => {
		const cells = scan();
		const doubted = doubtWrongGrid(cells, mesh(vertical, horizontal));
		expect(doubted.slice(0, 3).every(isLowConfidence)).toBe(true);
		expect(doubted.map(({ type, digit }) => ({ type, digit }))).toEqual(
			cells.map(({ type, digit }) => ({ type, digit })),
		);
	});

	it("flags a grid whose corners were far off", () => {
		const all = "||||||||||";
		const cells = scan();
		expect(doubtWrongGrid(cells, mesh(all, all, 2.7))).toBe(cells);
		const doubted = doubtWrongGrid(cells, mesh(all, all, 3.3));
		expect(doubted.slice(0, 3).every(isLowConfidence)).toBe(true);
	});

	it("never makes a doubtful cell surer", () => {
		const cells = scan();
		cells[0].confidence = 0.2;
		const doubted = doubtWrongGrid(cells, mesh("..........", ".........."));
		expect(doubted[0].confidence).toBe(0.2);
	});
});
