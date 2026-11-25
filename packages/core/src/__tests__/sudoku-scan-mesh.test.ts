import { describe, expect, it } from "vitest";
import {
	CELL,
	clearOutside,
	FLAT,
	findMesh,
	flatMap,
	withMargins,
} from "../sudoku-scan-mesh";
import { drawGrid } from "../testing/drawn-grid";

const photo = { width: 1200, height: 1600 };
const evenMargins = (margin: number) => ({
	left: margin,
	top: margin,
	right: margin,
	bottom: margin,
});

describe("withMargins", () => {
	it("adds paper on the sides where the photo has some", () => {
		const { corners, margins } = withMargins(
			[
				{ x: 300, y: 300 },
				{ x: 1200, y: 300 },
				{ x: 1200, y: 1200 },
				{ x: 300, y: 1200 },
			],
			photo,
		);
		expect(margins.left).toBeCloseTo(0.7);
		expect(margins.top).toBeCloseTo(0.7);
		expect(margins.bottom).toBeCloseTo(0.7);
		expect(margins.right).toBe(0);
		expect(corners[0].x).toBeCloseTo(230);
		expect(corners[1].x).toBeCloseTo(1200);
	});

	it("leaves corners that are on one point alone", () => {
		const corners = Array.from({ length: 4 }, () => ({ x: 5, y: 5 }));
		expect(withMargins(corners, photo)).toEqual({
			corners,
			margins: evenMargins(0),
		});
	});
});

describe("clearOutside", () => {
	it("turns the black beyond the photo into paper, and leaves ink", () => {
		const size = 40;
		const gray = new Uint8Array(size * size).fill(200);
		for (let y = 0; y < size; y += 1) gray[y * size] = 0;
		gray[20 * size + 20] = 0;
		const cleared = clearOutside(gray, size);
		expect(cleared[5 * size]).toBe(255);
		expect(cleared[20 * size + 20]).toBe(0);
		expect(gray[5 * size]).toBe(0);
	});
});

/** The furthest, in cells, any crossing of two lines is from its place. */
function furthest(
	grid: ReturnType<typeof drawGrid>,
	margins = evenMargins(0.7),
) {
	const mesh = findMesh(grid.gray, grid.size, margins);
	const { mapX, mapY } = flatMap(mesh);
	let worst = 0;
	for (let row = 0; row < 9; row += 1) {
		for (let column = 0; column < 9; column += 1) {
			const index = (row * CELL + CELL / 2) * FLAT + column * CELL + CELL / 2;
			const place = grid.at(column + 0.505, row + 0.505);
			worst = Math.max(
				worst,
				Math.hypot(mapX[index] - place.x, mapY[index] - place.y),
			);
		}
	}
	return worst / (grid.size / 10.4);
}

describe("findMesh", () => {
	it("finds straight lines", () => {
		expect(furthest(drawGrid({ margin: 0.7 }))).toBeLessThan(0.05);
	});

	it("follows the lines of a curled page", () => {
		expect(furthest(drawGrid({ margin: 0.7, bend: 50 }))).toBeLessThan(0.05);
	});

	it("finds the lines when a corner is most of a cell off", () => {
		// The same grid in a frame that says its top is 0.6 cells higher.
		const grid = drawGrid({ margin: 0.7 });
		const margins = { left: 0.7, right: 0.7, top: 0.1, bottom: 1.3 };
		expect(furthest(grid, margins)).toBeLessThan(0.05);
		const { moved } = findMesh(grid.gray, grid.size, margins);
		expect(moved).toBeCloseTo(4 * 0.67);
	});

	it.each([true, false])("says which lines it found: %s", (lines) => {
		const { gray, size } = drawGrid({ margin: 0.7, lines });
		const found = Array.from({ length: 10 }, () => lines);
		expect(findMesh(gray, size, evenMargins(0.7))).toMatchObject({
			found: { vertical: found, horizontal: found },
			moved: 0,
		});
	});

	it("falls back on the even grid when there are no lines", () => {
		expect(furthest(drawGrid({ margin: 0.7, lines: false }))).toBeLessThan(
			0.05,
		);
	});
});
