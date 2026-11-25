import { describe, expect, it } from "vitest";
import {
	darkness,
	GLYPH,
	glyphImage,
	gridInk,
	heightOf,
	imageBox,
	inkDarkness,
} from "../sudoku-scan-glyphs";
import { FLAT } from "../sudoku-scan-mesh";
import { type DrawnDigit, drawGrid } from "../testing/drawn-grid";

const read = (digits: DrawnDigit[]) => {
	const dark = darkness(drawGrid({ digits }).gray);
	return { dark, inks: gridInk(dark) };
};

describe("gridInk", () => {
	it("finds no ink in an empty grid", () => {
		const kinds = read([]).inks.map((ink) => ink.kind);
		expect(kinds).toEqual(Array.from({ length: 81 }, () => "empty"));
	});

	it("tells digits from notes by their size", () => {
		const { inks } = read([
			{ row: 0, column: 0, digit: 4 },
			{ row: 4, column: 4, digit: 2, height: 0.22 },
		]);
		expect(inks[0].kind).toBe("digit");
		expect(inks[40]).toMatchObject({ kind: "notes", marks: [{}] });
		expect(inks.filter((ink) => ink.kind !== "empty")).toHaveLength(2);
	});

	it("keeps a digit that crosses a grid line whole, in one cell", () => {
		const { inks } = read([{ row: 4, column: 4, digit: 2, right: 0.35 }]);
		const ink = inks[40];
		if (ink.kind !== "digit") throw new Error("no digit");
		expect(ink.ink.maxX).toBeGreaterThan(502);
		expect(heightOf(ink.ink)).toBeGreaterThan(55);
		expect(inks.filter((other) => other.kind !== "empty")).toHaveLength(1);
	});

	it("reads ink in a shadow", () => {
		const { gray } = drawGrid({ digits: [{ row: 8, column: 8, digit: 4 }] });
		const shaded = gray.map((value, index) =>
			Math.round(value * (1 - (0.6 * (index % FLAT)) / FLAT)),
		);
		expect(gridInk(darkness(shaded))[80].kind).toBe("digit");
	});
});

describe("a piece of ink", () => {
	const { dark, inks } = read([{ row: 0, column: 0, digit: 4 }]);
	const ink = inks[0];
	if (ink.kind !== "digit") throw new Error("no digit");
	const piece = ink.ink;

	it("has the darkness of its pixels", () => {
		expect(inkDarkness(piece, dark)).toBeCloseTo(1 - 40 / 225, 1);
	});

	it("has a box in the image the grid was flattened from", () => {
		const mapX = Float32Array.from(dark, (_, i) => (i % FLAT) * 2);
		const mapY = Float32Array.from(dark, (_, i) => Math.floor(i / FLAT) + 10);
		expect(imageBox(piece, { mapX, mapY }, 3)).toEqual({
			x: piece.minX * 2 - 3,
			y: piece.minY + 10 - 3,
			width: (piece.maxX - piece.minX) * 2 + 7,
			height: piece.maxY - piece.minY + 7,
		});
	});

	it("is scaled into the middle of the network's input", () => {
		const image = glyphImage(piece);
		const rows = Array.from({ length: GLYPH }, (_, y) =>
			image.subarray(y * GLYPH, (y + 1) * GLYPH).some((value) => value > 0.5),
		);
		expect(rows.indexOf(true)).toBe(3);
		expect(rows.lastIndexOf(true)).toBe(24);
		expect(Math.max(...image)).toBeLessThanOrEqual(1);
	});
});
