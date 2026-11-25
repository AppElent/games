import { describe, expect, it } from "vitest";
import { mulberry32 } from "../random";
import { generateSolvedGrid } from "../sudoku";
import { generateKillerCages } from "../sudoku-killer";
import { readCages } from "../sudoku-scan-cages";
import type { InkBox } from "../sudoku-scan-ink";
import {
	grayToRgba,
	looksLikeZero,
	readKillerSums,
} from "../sudoku-scan-killer-sums";
import {
	CELL,
	PRINT,
	paintGlyph,
	renderKiller,
	SIZE,
} from "../testing/drawn-killer";

/** A printed 1: one upright bar, as tall as `paintGlyph`'s 0. */
function paintOne(rgba: Uint8ClampedArray, x: number, y: number) {
	for (let dy = 0; dy < 22; dy += 1) {
		for (let dx = 4; dx < 8; dx += 1) {
			const i = ((y + dy) * SIZE + x + dx) * 4;
			rgba[i] = PRINT[0];
			rgba[i + 1] = PRINT[1];
			rgba[i + 2] = PRINT[2];
		}
	}
}

const rng = mulberry32(11);
const cages = generateKillerCages(generateSolvedGrid(rng), rng).map((cage) =>
	[...cage.cells].sort((a, b) => a - b),
);

/**
 * A Killer whose cages alternate the sums 10 and 11, in the first cell's
 * corner, and the cells of its read in order.
 */
function drawnKiller() {
	const rgba = renderKiller(cages, { rng: mulberry32(12) });
	cages.forEach((cage, index) => {
		const x = (cage[0] % 9) * CELL;
		const y = Math.floor(cage[0] / 9) * CELL;
		paintOne(rgba, x + 11, y + 11);
		if (index % 2 === 0) {
			paintGlyph(rgba, x + 26, y + 11);
		} else {
			// A 1 is narrow: its neighbour sits closer.
			paintOne(rgba, x + 22, y + 11);
		}
	});
	return rgba;
}

describe("readKillerSums", () => {
	const rgba = drawnKiller();
	const read = readCages(rgba, SIZE);
	const sumOf = (cells: number[]) =>
		cages.findIndex((cage) => cage[0] === cells[0]) % 2 === 0 ? 10 : 11;

	it("reads each sum, telling a 0 by its shape", async () => {
		const asked: InkBox[] = [];
		const sums = await readKillerSums(rgba, SIZE, read, async (boxes) => {
			asked.push(...boxes);
			return boxes.map(() => ({ digit: 1, confidence: 0.9 }));
		});
		expect(read.cages.length).toBe(cages.length);
		expect(sums).toEqual(read.cages.map(sumOf));
		// Only the 1s go to the reader, in one batch: three per pair of cages.
		const tens = read.cages.filter((cells) => sumOf(cells) === 10).length;
		expect(asked).toHaveLength(read.cages.length * 2 - tens);
	});

	it("leaves a sum for the player when a digit reads unsure", async () => {
		const sums = await readKillerSums(rgba, SIZE, read, async (boxes) =>
			boxes.map((_, index) => ({
				digit: 1,
				confidence: index === 0 ? 0.1 : 0.9,
			})),
		);
		expect(sums[0]).toBeNull();
		expect(sums.filter((sum) => sum === null)).toHaveLength(1);
	});

	it("reads from a gray warp, as the phone's is", async () => {
		const gray = Uint8ClampedArray.from({ length: SIZE * SIZE }, (_, i) =>
			Math.round(
				0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2],
			),
		);
		const fromGray = grayToRgba(gray);
		const grayRead = readCages(fromGray, SIZE);
		expect(grayRead.cages).toEqual(read.cages);
		const sums = await readKillerSums(fromGray, SIZE, grayRead, async (boxes) =>
			boxes.map(() => ({ digit: 1, confidence: 0.9 })),
		);
		expect(sums).toEqual(read.cages.map(sumOf));
	});
});

describe("looksLikeZero", () => {
	const box = { x: 0, y: 0, width: 7, height: 10 };
	const sumOf = (rows: string[]) => ({
		box,
		mask: Uint8Array.from(rows.join(""), (pixel) => (pixel === "#" ? 1 : 0)),
		digits: [box],
	});

	it("takes a ring around one tall hole as a 0", () => {
		const zero = sumOf([
			".#####.",
			"##...##",
			"#.....#",
			"#.....#",
			"#.....#",
			"#.....#",
			"#.....#",
			"#.....#",
			"##...##",
			".#####.",
		]);
		expect(looksLikeZero(zero, box)).toBe(true);
	});

	it("does not take an 8 or a 6, whose holes are short", () => {
		const eight = sumOf([
			".#####.",
			"#.....#",
			"#.....#",
			"#.....#",
			".#####.",
			"#.....#",
			"#.....#",
			"#.....#",
			"#.....#",
			".#####.",
		]);
		const six = sumOf([
			"..####.",
			".#.....",
			"#......",
			"#......",
			"#.####.",
			"##....#",
			"#.....#",
			"#.....#",
			"#.....#",
			".#####.",
		]);
		expect(looksLikeZero(eight, box)).toBe(false);
		expect(looksLikeZero(six, box)).toBe(false);
	});
});
