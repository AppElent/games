import { describe, expect, it } from "vitest";
import { digitMask } from "../sudoku";
import {
	type CellReadPlan,
	defaultCorners,
	gridCells,
	planCellRead,
	planGridReads,
	readBoxes,
	scanCellFromReads,
} from "../sudoku-scan-ink";

const SIZE = 900;
const CELL = SIZE / 9;
const PAPER = 230;

/** A blank warped grid with lines `lineWidth` thick on every cell edge. */
function blankGrid(lineWidth = 0) {
	const gray = new Uint8Array(SIZE * SIZE).fill(PAPER);
	for (let i = 0; i <= 9; i += 1) {
		const edge = Math.min(SIZE - lineWidth, Math.round(i * CELL));
		for (let w = 0; w < lineWidth; w += 1) {
			for (let t = 0; t < SIZE; t += 1) {
				const at = Math.max(0, edge - Math.floor(lineWidth / 2) + w);
				gray[t * SIZE + at] = 40; // vertical line
				gray[at * SIZE + t] = 40; // horizontal line
			}
		}
	}
	return gray;
}

function fill(
	gray: Uint8Array,
	cell: number,
	box: { x: number; y: number; width: number; height: number },
	value: number,
) {
	const x0 = (cell % 9) * CELL;
	const y0 = Math.floor(cell / 9) * CELL;
	for (let y = box.y; y < box.y + box.height; y += 1) {
		for (let x = box.x; x < box.x + box.width; x += 1) {
			gray[(y0 + y) * SIZE + x0 + x] = value;
		}
	}
}

const plan = (gray: Uint8Array, cell: number) =>
	planCellRead(gray, SIZE, {
		x: (cell % 9) * CELL,
		y: Math.floor(cell / 9) * CELL,
		width: CELL,
		height: CELL,
	});

describe("planCellRead", () => {
	it("reads nothing in a blank cell, even between thick grid lines", () => {
		const gray = blankGrid(6);
		for (const cell of [0, 40, 80]) {
			expect(plan(gray, cell)).toEqual({ kind: "empty" });
		}
	});

	it("reads one printed digit from dark, full-height ink", () => {
		const gray = blankGrid(2);
		fill(gray, 10, { x: 40, y: 28, width: 20, height: 44 }, 30);
		const result = plan(gray, 10);
		expect(result).toEqual({
			kind: "digit",
			box: { x: 100 + 38, y: 100 + 26, width: 24, height: 48 },
			printed: true,
		});
	});

	it("calls lighter ink handwriting", () => {
		const gray = blankGrid(2);
		fill(gray, 20, { x: 42, y: 30, width: 16, height: 40 }, 140);
		expect(plan(gray, 20)).toMatchObject({ kind: "digit", printed: false });
	});

	it("reads small marks as notes, central ones as centre notes", () => {
		const gray = blankGrid(2);
		fill(gray, 30, { x: 16, y: 16, width: 6, height: 10 }, 60);
		fill(gray, 30, { x: 47, y: 45, width: 6, height: 10 }, 60);
		const result = plan(gray, 30);
		expect(result.kind).toBe("notes");
		if (result.kind !== "notes") return;
		expect(result.marks.map((mark) => mark.central).sort()).toEqual([
			false,
			true,
		]);
	});

	it("ignores a misaligned grid line reaching into the cell", () => {
		const gray = blankGrid(0);
		// A thick line 14px inside the cell's left edge, the full height.
		fill(gray, 50, { x: 10, y: 0, width: 5, height: CELL }, 40);
		fill(gray, 50, { x: 0, y: 12, width: CELL, height: 4 }, 40);
		expect(plan(gray, 50)).toEqual({ kind: "empty" });
	});
});

describe("scanCellFromReads", () => {
	const digit: CellReadPlan = {
		kind: "digit",
		box: { x: 0, y: 0, width: 10, height: 10 },
		printed: true,
	};

	it("makes a printed digit a given, handwriting a user digit", () => {
		expect(scanCellFromReads(digit, [{ digit: 7, confidence: 1 }])).toEqual({
			type: "given",
			digit: 7,
			cornerMask: 0,
			centerMask: 0,
			confidence: 1,
		});
		expect(
			scanCellFromReads({ ...digit, printed: false }, [
				{ digit: 3, confidence: 1 },
			]),
		).toMatchObject({ type: "userDigit", digit: 3, confidence: 0.85 });
	});

	it("leaves an unreadable digit empty and doubtful", () => {
		expect(scanCellFromReads(digit, [{ digit: 0, confidence: 0 }])).toEqual({
			type: "empty",
			digit: 0,
			cornerMask: 0,
			centerMask: 0,
			confidence: 0.2,
		});
	});

	it("sorts note reads into corner and centre masks", () => {
		const notes: CellReadPlan = {
			kind: "notes",
			marks: [
				{ box: { x: 0, y: 0, width: 4, height: 4 }, central: false },
				{ box: { x: 0, y: 0, width: 4, height: 4 }, central: true },
			],
		};
		expect(
			scanCellFromReads(notes, [
				{ digit: 2, confidence: 0.9 },
				{ digit: 5, confidence: 0.6 },
			]),
		).toEqual({
			type: "cornerNotes",
			digit: 0,
			cornerMask: digitMask(2),
			centerMask: digitMask(5),
			confidence: 0.6,
		});
		expect(
			scanCellFromReads(notes, [
				{ digit: 0, confidence: 0 },
				{ digit: 0, confidence: 0 },
			]),
		).toMatchObject({ type: "empty", confidence: 0.3 });
	});
});

describe("planGridReads", () => {
	it("plans every cell of a grid", () => {
		const gray = blankGrid(2);
		fill(gray, 0, { x: 40, y: 28, width: 20, height: 44 }, 30);
		fill(gray, 80, { x: 40, y: 28, width: 20, height: 44 }, 30);
		const plans = planGridReads(gray, SIZE);
		expect(plans).toHaveLength(81);
		expect(plans[0].kind).toBe("digit");
		expect(plans[80].kind).toBe("digit");
		expect(plans.flatMap(readBoxes)).toHaveLength(2);
	});
});

/**
 * A grid drawn with its lines at `xs` (vertical) and `ys` (horizontal); the
 * box lines are black, the thin ones `thin`.
 */
function drawnGrid(xs: number[], ys: number[], thin = 40) {
	const gray = new Uint8Array(SIZE * SIZE).fill(PAPER);
	xs.forEach((x, i) => {
		const ink = i % 3 === 0 ? 40 : thin;
		for (let y = ys[0]; y <= ys[9]; y += 1) {
			for (let w = -1; w <= 1; w += 1) gray[y * SIZE + x + w] = ink;
		}
	});
	ys.forEach((y, i) => {
		const ink = i % 3 === 0 ? 40 : thin;
		for (let x = xs[0]; x <= xs[9]; x += 1) {
			for (let w = -1; w <= 1; w += 1) gray[(y + w) * SIZE + x] = ink;
		}
	});
	return gray;
}

/** Each side within 2 pixels: a line is a few pixels wide. */
function expectNear(
	cell: { x: number; y: number; width: number; height: number },
	expected: { x: number; y: number; width: number; height: number },
) {
	for (const key of ["x", "y", "width", "height"] as const) {
		expect(Math.abs(cell[key] - expected[key]), key).toBeLessThanOrEqual(2);
	}
}

describe("gridCells", () => {
	const even = Array.from({ length: 10 }, (_, i) =>
		Math.min(SIZE - 2, i * CELL + 1),
	);

	it("cuts an even grid into even cells", () => {
		const cells = gridCells(drawnGrid(even, even), SIZE);
		expectNear(cells[0], { x: 1, y: 1, width: 100, height: 100 });
		expectNear(cells[40], { x: 401, y: 401, width: 100, height: 100 });
	});

	it("follows a grid that is inset and squeezed on one side, as a curled page", () => {
		// The first two boxes are wide, the last one narrow, inside a margin.
		const xs = [30, 135, 240, 345, 448, 551, 655, 730, 805, 880];
		const ys = [25, 120, 215, 310, 405, 500, 595, 690, 785, 880];
		const cells = gridCells(drawnGrid(xs, ys), SIZE);
		expectNear(cells[0], { x: 30, y: 25, width: 105, height: 95 });
		expectNear(cells[8], { x: 805, y: 25, width: 75, height: 95 });
		expectNear(cells[80], { x: 805, y: 785, width: 75, height: 95 });
	});

	it("does not take a digit's stroke for a line", () => {
		const gray = drawnGrid(even, even);
		// A tall "1" next to where the line between the first two cells is.
		fill(gray, 0, { x: 70, y: 25, width: 8, height: 50 }, 30);
		expectNear(gridCells(gray, SIZE)[0], {
			x: 1,
			y: 1,
			width: 100,
			height: 100,
		});
	});

	it("finds light grey thin lines beside dark digits", () => {
		const gray = drawnGrid(even, even, 180);
		// A tall dark "1" in each of the first three cells of the top row.
		for (const x of [62, 162, 262]) {
			fill(gray, 0, { x, y: 15, width: 6, height: 70 }, 20);
		}
		const cells = gridCells(gray, SIZE);
		expectNear(cells[0], { x: 1, y: 1, width: 100, height: 100 });
		expectNear(cells[1], { x: 101, y: 1, width: 100, height: 100 });
		expectNear(cells[2], { x: 201, y: 1, width: 100, height: 100 });
	});

	it("keeps an even cell where no line stands out", () => {
		const blank = new Uint8Array(SIZE * SIZE).fill(PAPER);
		expectNear(gridCells(blank, SIZE)[10], {
			x: 100,
			y: 100,
			width: 100,
			height: 100,
		});
	});

	it("breaks line-score ties on ridge support rather than raw darkness", () => {
		const xs = [...even];
		xs[1] = 85;
		const gray = drawnGrid(xs, even, 150);
		// A darker, wider vertical stroke nearby that also reaches every slice
		// via the ±4 px score window, so it ties the thin grid line on score
		// and beats it on raw ink darkness, yet has far less ridge support.
		for (let y = 0; y < CELL; y += 1) {
			for (let x = 114; x <= 130; x += 1) {
				gray[y * SIZE + x] = 20;
			}
		}
		const cells = gridCells(gray, SIZE);
		expectNear(cells[1], { x: 85, y: 1, width: 116, height: 100 });
	});
});

describe("defaultCorners", () => {
	it("is a centred square inset from the photo's edges", () => {
		expect(defaultCorners(1000, 500)).toEqual([
			{ x: 280, y: 30 },
			{ x: 720, y: 30 },
			{ x: 720, y: 470 },
			{ x: 280, y: 470 },
		]);
	});
});
