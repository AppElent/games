import { describe, expect, it } from "vitest";
import { mulberry32 } from "../random";
import { generateSolvedGrid } from "../sudoku";
import { generateKillerCages } from "../sudoku-killer";
import {
	type CageEdge,
	type CageRead,
	cagesFromBorders,
	edgeBetween,
	edgeKey,
	readCages,
} from "../sudoku-scan-cages";
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
	// The drawing prints 10 or 11 in every cage; a big cage cannot make
	// them, so the read leaves those for the player.
	const most = (cells: number[]) => (cells.length * (19 - cells.length)) / 2;
	const least = (cells: number[]) => (cells.length * (cells.length + 1)) / 2;
	const expected = (cells: number[]) =>
		least(cells) <= sumOf(cells) && sumOf(cells) <= most(cells)
			? sumOf(cells)
			: null;

	it("reads each sum, telling a 0 by its shape", async () => {
		const asked: InkBox[] = [];
		const result = await readKillerSums(rgba, SIZE, read, async (boxes) => {
			asked.push(...boxes);
			return boxes.map(() => ({ digit: 1, confidence: 0.9 }));
		});
		expect(read.cages.length).toBe(cages.length);
		expect(result.read.cages).toEqual(read.cages);
		expect(result.sums).toEqual(read.cages.map(expected));
		expect(result.unsure.every((doubt) => !doubt)).toBe(true);
		// Only the 1s go to the reader, in one batch: three per pair of cages.
		const tens = read.cages.filter((cells) => sumOf(cells) === 10).length;
		expect(asked).toHaveLength(read.cages.length * 2 - tens);
	});

	it("leaves a sum for the player when a digit reads unsure", async () => {
		const { sums } = await readKillerSums(rgba, SIZE, read, async (boxes) =>
			boxes.map((_, index) => ({
				digit: 1,
				confidence: index === 0 ? 0.1 : 0.9,
			})),
		);
		expect(sums[0]).toBeNull();
		expect(sums.filter((sum) => sum === null)).toHaveLength(
			read.cages.slice(1).filter((cells) => expected(cells) === null).length +
				1,
		);
	});

	it("reads a doubtful digit again among sure ones, and marks its sum", async () => {
		const calls: InkBox[][] = [];
		const { sums, unsure } = await readKillerSums(
			rgba,
			SIZE,
			read,
			async (boxes) => {
				calls.push(boxes);
				// The first look misses the first box; the second reads it, unsure.
				return boxes.map((_, index) =>
					calls.length === 1 && index === 0
						? { digit: 0, confidence: 0 }
						: { digit: 1, confidence: calls.length === 1 ? 0.9 : 0.5 },
				);
			},
		);
		expect(calls).toHaveLength(2);
		// The doubtful box, then a sure one beside it.
		expect(calls[1]).toEqual([calls[0][0], calls[0][1]]);
		expect(sums).toEqual(read.cages.map(expected));
		expect(unsure[0]).toBe(true);
		expect(unsure.filter(Boolean)).toHaveLength(1);
	});

	it("reads once when every digit is sure", async () => {
		let calls = 0;
		await readKillerSums(rgba, SIZE, read, async (boxes) => {
			calls += 1;
			return boxes.map(() => ({ digit: 1, confidence: 0.9 }));
		});
		expect(calls).toBe(1);
	});

	it("drops a sum its cage's cells cannot make", async () => {
		// 40 and 44: only a cage of eight or nine cells makes 44.
		const { sums } = await readKillerSums(rgba, SIZE, read, async (boxes) =>
			boxes.map(() => ({ digit: 4, confidence: 0.9 })),
		);
		read.cages.forEach((cells, index) => {
			const wanted = sumOf(cells) === 10 ? 40 : 44;
			expect(sums[index]).toBe(wanted <= most(cells) ? wanted : null);
		});
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
		const { sums } = await readKillerSums(
			fromGray,
			SIZE,
			grayRead,
			async (boxes) => boxes.map(() => ({ digit: 1, confidence: 0.9 })),
		);
		expect(sums).toEqual(read.cages.map(expected));
	});
});

describe("readKillerSums joins a cage without a sum", () => {
	const rgba = drawnKiller();
	const read = readCages(rgba, SIZE);
	const reader = async (boxes: InkBox[]) =>
		boxes.map(() => ({ digit: 1, confidence: 0.9 }));
	// A cage split in two by a line read where there is none.
	const cage = read.cages.find((cells) => cells.includes(cells[0] + 1)) ?? [];
	const edge = edgeBetween(cage[0], cage[0] + 1) as CageEdge;
	const split = (score: number, doubtful: boolean): CageRead => {
		const borders = [...read.borders, edge];
		const keys = new Set(borders.map(edgeKey));
		return {
			...read,
			borders,
			doubtful: doubtful ? [...read.doubtful, edge] : read.doubtful,
			scores: { ...read.scores, [edgeKey(edge)]: score },
			cages: cagesFromBorders((other) => keys.has(edgeKey(other))),
		};
	};

	it("across its weakest unsure line", async () => {
		const result = await readKillerSums(rgba, SIZE, split(0.7, true), reader);
		expect(result.read.cages).toEqual(read.cages);
		expect(result.read.borders.map(edgeKey)).not.toContain(edgeKey(edge));
		const whole = await readKillerSums(rgba, SIZE, read, reader);
		expect(result.sums).toEqual(whole.sums);
	});

	it("not across a line read surely", async () => {
		const result = await readKillerSums(rgba, SIZE, split(1.3, false), reader);
		expect(result.read.cages).toHaveLength(read.cages.length + 1);
	});
});

describe("readKillerSums with a short answer", () => {
	it("refuses a reader that answers for fewer boxes", async () => {
		const rgba = drawnKiller();
		const read = readCages(rgba, SIZE);
		await expect(
			readKillerSums(rgba, SIZE, read, async () => []),
		).rejects.toThrow("different number of boxes");
	});
});

describe("looksLikeZero", () => {
	const box = { x: 0, y: 0, width: 7, height: 10 };
	const pixels = (rows: string[]) =>
		Uint8Array.from(rows.join(""), (pixel) => (pixel === "#" ? 1 : 0));
	const sumOf = (rows: string[], grown = rows) => ({
		box,
		mask: pixels(grown),
		ink: pixels(rows),
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

	it("takes a small 0 whose grown ink closes its hole, and a dash beside it", () => {
		const zero = sumOf(
			[
				".####....",
				"#....#...",
				"#....#...",
				"#....####",
				"#....#...",
				"#....#...",
				"#....#...",
				"#....#...",
				"#....#...",
				".####....",
			],
			[
				"######...",
				"######...",
				"##..##...",
				"##..#####",
				"##..##...",
				"##..##...",
				"######...",
				"######...",
				"######...",
				"######...",
			],
		);
		const wide = { ...box, width: 9 };
		expect(looksLikeZero({ ...zero, box: wide, digits: [wide] }, wide)).toBe(
			true,
		);
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
		// A printed 4's closed counter runs half its height, in the top part.
		const four = sumOf([
			"....##.",
			"...###.",
			"..#.##.",
			".#..##.",
			"#...##.",
			"#######",
			"....##.",
			"....##.",
			"....##.",
			"....##.",
		]);
		expect(looksLikeZero(four, box)).toBe(false);
		expect(looksLikeZero(eight, box)).toBe(false);
		expect(looksLikeZero(six, box)).toBe(false);
	});
});
