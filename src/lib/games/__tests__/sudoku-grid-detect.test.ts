import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { detectGridCorners } from "../sudoku-grid-detect";

/** A grayscale PNG's pixels; only reads the unfiltered ones in `fixtures`. */
function readPhoto(name: string) {
	const file = readFileSync(new URL(`./fixtures/${name}`, import.meta.url));
	const width = file.readUInt32BE(16);
	const height = file.readUInt32BE(20);
	const chunks: Buffer[] = [];
	for (let at = 8; at < file.length; ) {
		const length = file.readUInt32BE(at);
		if (file.toString("latin1", at + 4, at + 8) === "IDAT") {
			chunks.push(file.subarray(at + 8, at + 8 + length));
		}
		at += length + 12;
	}
	const rows = inflateSync(Buffer.concat(chunks));
	const gray = new Uint8Array(width * height);
	for (let y = 0; y < height; y += 1) {
		const row = y * (width + 1);
		if (rows[row] !== 0) {
			throw new Error(`${name} has filtered rows`);
		}
		gray.set(rows.subarray(row + 1, row + 1 + width), y * width);
	}
	return { gray, width, height };
}

/** White paper with a square of evenly spaced lines, `cells` along each side. */
function drawGrid(cells: number) {
	const size = 300;
	const left = 60;
	const side = 180;
	const gray = new Uint8Array(size * size).fill(230);
	for (let line = 0; line <= cells; line += 1) {
		const at = left + Math.round((line * side) / cells);
		for (let along = left; along <= left + side; along += 1) {
			gray[at * size + along] = 40;
			gray[along * size + at] = 40;
		}
	}
	return { gray, size, left, right: left + side };
}

describe("detectGridCorners", () => {
	it("finds the grid on a curled book page seen at an angle", () => {
		const { gray, width, height } = readPhoto("sudoku-book-page.png");
		const corners = detectGridCorners(gray, width, height);
		// Placed by hand on the photo, from the top-left, clockwise.
		const expected = [
			{ x: 48, y: 35 },
			{ x: 148, y: 78 },
			{ x: 157, y: 194 },
			{ x: 37, y: 174 },
		];
		expect(corners).toHaveLength(4);
		for (const [i, corner] of (corners ?? []).entries()) {
			const off = Math.hypot(
				corner.x - expected[i].x,
				corner.y - expected[i].y,
			);
			expect(off).toBeLessThan(6);
		}
	});

	it("is unsure about a grid that runs off the photo", () => {
		const { gray, width, height } = readPhoto("sudoku-cut-off.png");
		expect(detectGridCorners(gray, width, height)).toBeNull();
	});

	it("finds nothing on an empty page", () => {
		const gray = new Uint8Array(300 * 200).fill(230);
		expect(detectGridCorners(gray, 300, 200)).toBeNull();
	});

	it("counts the cells: nine by nine is a sudoku, six or eight is not", () => {
		const { gray, size, left, right } = drawGrid(9);
		expect(detectGridCorners(gray, size, size)).toEqual([
			{ x: left, y: left },
			{ x: right, y: left },
			{ x: right, y: right },
			{ x: left, y: right },
		]);
		for (const cells of [1, 6, 8, 18]) {
			const other = drawGrid(cells);
			expect(detectGridCorners(other.gray, size, size)).toBeNull();
		}
	});
});
