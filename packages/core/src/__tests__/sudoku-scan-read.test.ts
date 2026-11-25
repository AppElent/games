import { describe, expect, it } from "vitest";
import type { DigitRead } from "../sudoku-scan-ink";
import { type GlyphToRead, readWarpedGrid } from "../sudoku-scan-read";
import { drawGrid } from "../testing/drawn-grid";

const margins = (margin: number) => ({
	left: margin,
	top: margin,
	right: margin,
	bottom: margin,
});

const grid = () =>
	drawGrid({
		margin: 0.7,
		bend: 40,
		digits: [
			{ row: 0, column: 4, digit: 7 },
			{ row: 4, column: 0, digit: 4 },
			{ row: 8, column: 8, digit: 2 },
		],
	});

/** Takes the network's word for each digit, as the web does when it is sure. */
const byNetwork = async (glyphs: GlyphToRead[]): Promise<DigitRead[]> =>
	glyphs.map(({ guess }) =>
		guess
			? { digit: guess.digit, confidence: guess.confidence }
			: { digit: 0, confidence: 0 },
	);

describe("readWarpedGrid", () => {
	it("reads a curled grid's digits with the network's guesses", async () => {
		const drawn = grid();
		const seen: GlyphToRead[][] = [];
		const cells = await readWarpedGrid(
			{ pixels: drawn.gray, size: drawn.size },
			margins(0.7),
			async (glyphs) => {
				seen.push(glyphs);
				return byNetwork(glyphs);
			},
		);
		const found = cells?.flatMap((cell, index) =>
			cell.type === "empty" ? [] : [[index, cell.digit]],
		);
		expect(found).toEqual([
			[4, 7],
			[36, 4],
			[80, 2],
		]);
		// Only rows with ink are read, each glyph with its guess.
		expect(seen).toHaveLength(3);
		expect(seen.flat().every((glyph) => glyph.guess !== null)).toBe(true);
	});

	it("counts the cells read after each row, and stops when told to", async () => {
		const drawn = grid();
		const counts: number[] = [];
		const cells = await readWarpedGrid(
			{ pixels: drawn.gray, size: drawn.size },
			margins(0.7),
			byNetwork,
			(done) => {
				counts.push(done);
				return done < 27;
			},
		);
		expect(cells).toBeNull();
		expect(counts).toEqual([9, 18, 27]);
	});

	it("refuses a reader that answers for other glyphs", async () => {
		const drawn = grid();
		await expect(
			readWarpedGrid(
				{ pixels: drawn.gray, size: drawn.size },
				margins(0.7),
				async () => [],
			),
		).rejects.toThrow(/different number of boxes/);
	});
});
