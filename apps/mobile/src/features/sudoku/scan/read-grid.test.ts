import { mulberry32 } from "@arcadeclub/core/random";
import { generateSolvedGrid } from "@arcadeclub/core/sudoku";
import { generateKillerCages } from "@arcadeclub/core/sudoku-killer";
import { isLowConfidence } from "@arcadeclub/core/sudoku-scan";
import { killerScanCages } from "@arcadeclub/core/sudoku-scan-cages";
import type { InkBox, Point } from "@arcadeclub/core/sudoku-scan-ink";
import { withMargins } from "@arcadeclub/core/sudoku-scan-mesh";
import { drawGrid } from "@arcadeclub/core/testing/drawn-grid";
import {
	CELL,
	paintGlyph,
	renderKiller,
	SIZE,
} from "@arcadeclub/core/testing/drawn-killer";
import { readGrid, readKiller } from "./read-grid";

const photo = { uri: "file://photo.jpg", width: 1200, height: 1600 };
const corners = [
	{ x: 200, y: 400 },
	{ x: 1000, y: 400 },
	{ x: 1000, y: 1200 },
	{ x: 200, y: 1200 },
];

/** A reader that warps every photo to a drawn grid and reads nothing. */
function drawnReader(grid: ReturnType<typeof drawGrid>) {
	return {
		warpGrid: jest.fn(async (_uri: string, _corners: Point[]) => ({
			uri: "file://grid.png",
			size: grid.size,
			pixels: grid.gray,
		})),
		readDigits: jest.fn(async (_uri: string, boxes: InkBox[]) =>
			boxes.map(() => ({ digit: 0, confidence: 0 })),
		),
	};
}

const curled = () =>
	drawGrid({
		margin: 0.7,
		bend: 40,
		digits: [
			{ row: 0, column: 4, digit: 7 },
			{ row: 4, column: 0, digit: 4 },
			{ row: 8, column: 8, digit: 2 },
		],
	});

describe("readGrid", () => {
	it("reads the digits of a curled page", async () => {
		const reader = drawnReader(curled());
		const read = await readGrid(reader, photo, corners, () => true);
		const found = read?.cells.flatMap((cell, index) =>
			cell.type === "empty" ? [] : [[index, cell.digit]],
		);
		expect(found).toEqual([
			[4, 7],
			[36, 4],
			[80, 2],
		]);
		expect(read?.gridUri).toBe("file://grid.png");
	});

	it("flags every digit when the photo shows no grid lines", async () => {
		const grid = drawGrid({
			margin: 0.7,
			lines: false,
			digits: [
				{ row: 0, column: 4, digit: 7 },
				{ row: 4, column: 0, digit: 4 },
			],
		});
		const reader = drawnReader(grid);
		reader.readDigits.mockImplementation(async (_uri, boxes) =>
			boxes.map(() => ({ digit: 7, confidence: 1 })),
		);
		const read = await readGrid(reader, photo, corners, () => true);
		const filled = read?.cells.filter((cell) => cell.type !== "empty");
		expect(filled).toHaveLength(2);
		expect(filled?.every(isLowConfidence)).toBe(true);
	});

	it("warps the photo with paper around the grid", async () => {
		const reader = drawnReader(curled());
		await readGrid(reader, photo, corners, () => true);
		const [uri, warped] = reader.warpGrid.mock.calls[0];
		expect(uri).toBe(photo.uri);
		expect(warped[0].x).toBeLessThan(corners[0].x);
		expect(warped[2].y).toBeGreaterThan(corners[2].y);
	});

	it("leaves a note Vision cannot read empty", async () => {
		const grid = drawGrid({
			margin: 0.7,
			digits: [{ row: 4, column: 4, digit: 2, height: 0.22 }],
		});
		const reader = drawnReader(grid);
		const read = await readGrid(reader, photo, corners, () => true);
		expect(read?.cells[40]).toMatchObject({ type: "empty", confidence: 0.3 });
		reader.readDigits.mockImplementation(async (_uri, boxes) =>
			boxes.map(() => ({ digit: 2, confidence: 0.9 })),
		);
		const again = await readGrid(reader, photo, corners, () => true);
		expect(again?.cells[40].type).toBe("centerNotes");
	});

	it("counts the cells read, and stops when a newer scan took over", async () => {
		const counts: number[] = [];
		const read = await readGrid(
			drawnReader(curled()),
			photo,
			corners,
			({ done }) => {
				counts.push(done);
				return done < 18;
			},
		);
		expect(counts).toEqual([0, 9, 18]);
		expect(read).toBeNull();
	});

	it("refuses an answer for a different number of boxes", async () => {
		const reader = drawnReader(curled());
		reader.readDigits.mockResolvedValue([]);
		await expect(readGrid(reader, photo, corners, () => true)).rejects.toThrow(
			"different number of boxes",
		);
	});
});

/** A printed 1: one upright bar, as tall as `paintGlyph`'s 0. */
function paintOne(rgba: Uint8ClampedArray, x: number, y: number) {
	for (let dy = 0; dy < 22; dy += 1) {
		for (let dx = 4; dx < 8; dx += 1) {
			const i = ((y + dy) * SIZE + x + dx) * 4;
			rgba[i] = 30;
			rgba[i + 1] = 30;
			rgba[i + 2] = 30;
		}
	}
}

describe("readKiller", () => {
	const rng = mulberry32(5);
	const cages = generateKillerCages(generateSolvedGrid(rng), rng).map((cage) =>
		[...cage.cells].sort((a, b) => a - b),
	);
	/**
	 * A drawn Killer as the phone warps it: gray, with a margin of `margin`
	 * cells around it, and a 1 then a 0 (10) in every cage's corner.
	 */
	function killerReader(margin: number) {
		const rgba = renderKiller(cages, { rng: mulberry32(6) });
		for (const cage of cages) {
			const x = (cage[0] % 9) * CELL;
			const y = Math.floor(cage[0] / 9) * CELL;
			paintOne(rgba, x + 11, y + 11);
			paintGlyph(rgba, x + 22, y + 11);
		}
		const pad = Math.round(margin * CELL);
		const size = SIZE + pad * 2;
		const gray = new Uint8Array(size * size).fill(255);
		for (let y = 0; y < SIZE; y += 1) {
			for (let x = 0; x < SIZE; x += 1) {
				const i = (y * SIZE + x) * 4;
				gray[(y + pad) * size + x + pad] = Math.round(
					(rgba[i] + rgba[i + 1] + rgba[i + 2]) / 3,
				);
			}
		}
		return drawnReader({ gray, size, at: () => ({ x: 0, y: 0 }) });
	}

	const frame = withMargins(corners, photo);
	const sorted = [...cages].sort((a, b) => a[0] - b[0]);

	it("reads the cages and sums of a Killer, warped with margins", async () => {
		const reader = killerReader(frame.margins.left);
		reader.readDigits.mockImplementation(async (_uri, boxes) =>
			boxes.map(() => ({ digit: 1, confidence: 0.9 })),
		);
		const read = await readKiller(reader, photo, corners);
		expect(reader.warpGrid).toHaveBeenCalledWith(photo.uri, frame.corners);
		expect(read?.gridUri).toBe("file://grid.png");
		const found = killerScanCages(
			read?.scan ?? { borders: [], doubtful: [], sums: {} },
		);
		expect(found.map((cage) => cage.cells)).toEqual(sorted);
		expect(found.every((cage) => cage.sum === 10)).toBe(true);
		// Vision is asked about each 1 where the warped image shows it.
		const pad = frame.margins.left * CELL;
		const [first] = reader.readDigits.mock.calls[0][1];
		const corner = sorted[0][0];
		expect(first.x).toBeGreaterThan(pad + (corner % 9) * CELL);
		expect(first.x).toBeLessThan(pad + (corner % 9) * CELL + 25);
	});

	it("reads a Killer whose corners were placed on a frame around it", async () => {
		// The grid sits half a cell inside where the corners put it.
		const reader = killerReader(frame.margins.left + 0.5);
		const read = await readKiller(reader, photo, corners);
		const found = killerScanCages(
			read?.scan ?? { borders: [], doubtful: [], sums: {} },
		);
		expect(found.map((cage) => cage.cells)).toEqual(sorted);
	});

	it("leaves a classic grid to the classic read", async () => {
		const reader = drawnReader(curled());
		expect(await readKiller(reader, photo, corners)).toBeNull();
		expect(reader.readDigits).not.toHaveBeenCalled();
	});
});
