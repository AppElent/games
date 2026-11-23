import type { InkBox, Point } from "@arcadeclub/core/sudoku-scan-ink";
import { drawGrid } from "../../../../test/drawn-grid";
import { readGrid } from "./read-grid";

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
