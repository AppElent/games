/**
 * The image-independent half of reading a scanned sudoku: where the grid's
 * corners start, which ink in each cell of the straightened grid to read,
 * and what the digits read there make of the cell.
 *
 * The web (canvas and tesseract.js) warps the grid to a square, hands its
 * grayscale pixels to `planGridReads` and reads a digit in each box
 * `readBoxes` lists. The app (Apple Vision) finds the ink itself, on curled
 * pages too. Both turn the reads into `ScanCell`s with `scanCellFromReads`.
 */
import { digitMask } from "./sudoku";
import type { ScanCell } from "./sudoku-scan";
import { emptyScanCell } from "./sudoku-scan";

export type Point = { x: number; y: number };

/** A centred square inset from the photo's edges, for when no grid is found. */
export function defaultCorners(width: number, height: number): Point[] {
	const inset = 0.06;
	const side = Math.min(width, height) * (1 - inset * 2);
	const cx = width / 2;
	const cy = height / 2;
	return [
		{ x: cx - side / 2, y: cy - side / 2 },
		{ x: cx + side / 2, y: cy - side / 2 },
		{ x: cx + side / 2, y: cy + side / 2 },
		{ x: cx - side / 2, y: cy + side / 2 },
	];
}

/** A rectangle in the warped grid image, in pixels. */
export type InkBox = { x: number; y: number; width: number; height: number };

/** What a cell's ink asks to be read. */
export type CellReadPlan =
	| { kind: "empty" }
	/** One full-size digit; printed ink is darker than handwriting. */
	| { kind: "digit"; box: InkBox; printed: boolean }
	/** Small pencil marks; the central ones are centre notes. */
	| { kind: "notes"; marks: { box: InkBox; central: boolean }[] };

/** One box's reading: 0 when no digit 1-9 was recognized. */
export type DigitRead = { digit: number; confidence: number };

type Component = {
	minX: number;
	maxX: number;
	minY: number;
	maxY: number;
	pixels: number;
	meanGray: number;
};

/** Notes read per cell at most. */
const MAX_MARKS = 6;
/** Mean gray below which a full-size digit counts as printed. */
const PRINTED_GRAY = 110;

/**
 * The ink components inside one cell: thresholded against the cell's own
 * brightness, without specks and without grid-line pieces along its edge.
 */
function cellInk(gray: ArrayLike<number>, width: number, cell: InkBox) {
	const marginX = Math.round(cell.width * 0.1);
	const marginY = Math.round(cell.height * 0.1);
	const x0 = Math.round(cell.x) + marginX;
	const y0 = Math.round(cell.y) + marginY;
	const w = Math.max(1, Math.round(cell.width) - marginX * 2);
	const h = Math.max(1, Math.round(cell.height) - marginY * 2);

	let sum = 0;
	for (let y = 0; y < h; y += 1) {
		for (let x = 0; x < w; x += 1) {
			sum += gray[(y0 + y) * width + (x0 + x)];
		}
	}
	const mean = sum / (w * h);
	const threshold = Math.min(mean * 0.72, mean - 18);

	const binary = new Uint8Array(w * h);
	for (let y = 0; y < h; y += 1) {
		for (let x = 0; x < w; x += 1) {
			binary[y * w + x] = gray[(y0 + y) * width + (x0 + x)] < threshold ? 1 : 0;
		}
	}

	const visited = new Uint8Array(w * h);
	const components: Component[] = [];
	const queue: number[] = [];
	for (let start = 0; start < w * h; start += 1) {
		if (!binary[start] || visited[start]) {
			continue;
		}
		visited[start] = 1;
		queue.length = 0;
		queue.push(start);
		const comp: Component = {
			minX: w,
			maxX: 0,
			minY: h,
			maxY: 0,
			pixels: 0,
			meanGray: 0,
		};
		while (queue.length > 0) {
			const index = queue.pop();
			if (index === undefined) {
				break;
			}
			const px = index % w;
			const py = Math.floor(index / w);
			comp.pixels += 1;
			comp.meanGray += gray[(y0 + py) * width + (x0 + px)];
			comp.minX = Math.min(comp.minX, px);
			comp.maxX = Math.max(comp.maxX, px);
			comp.minY = Math.min(comp.minY, py);
			comp.maxY = Math.max(comp.maxY, py);
			for (const next of [index - 1, index + 1, index - w, index + w]) {
				if (
					next >= 0 &&
					next < w * h &&
					binary[next] &&
					!visited[next] &&
					Math.abs((next % w) - px) <= 1
				) {
					visited[next] = 1;
					queue.push(next);
				}
			}
		}
		comp.meanGray /= comp.pixels;
		if (comp.pixels >= 12 && !isGridLine(comp, w, h)) {
			components.push(comp);
		}
	}
	return { components, w, h, x0, y0 };
}

/**
 * A piece of grid line: it touches the cell's edge and is thin, long and
 * narrow, or spans most of the cell. A thick or slightly misaligned line
 * reaches into the cell this way; a digit near the edge does not.
 */
function isGridLine(comp: Component, w: number, h: number) {
	const width = comp.maxX - comp.minX + 1;
	const height = comp.maxY - comp.minY + 1;
	const touchesEdge =
		comp.minX <= 1 ||
		comp.minY <= 1 ||
		comp.maxX >= w - 2 ||
		comp.maxY >= h - 2;
	const lineShaped =
		width <= 3 ||
		height <= 3 ||
		width >= height * 4 ||
		height >= width * 6 ||
		width >= w * 0.8 ||
		height >= h * 0.9;
	return touchesEdge && lineShaped;
}

/** What to read in one cell of a warped grid `width` pixels wide. */
export function planCellRead(
	gray: ArrayLike<number>,
	width: number,
	cell: InkBox,
): CellReadPlan {
	const { components, w, h, x0, y0 } = cellInk(gray, width, cell);
	if (components.length === 0) {
		return { kind: "empty" };
	}
	const sorted = [...components].sort((a, b) => b.pixels - a.pixels);
	const biggest = sorted[0];
	const bigW = biggest.maxX - biggest.minX + 1;
	const bigH = biggest.maxY - biggest.minY + 1;
	if (bigH >= h * 0.38 && bigW >= w * 0.12) {
		return {
			kind: "digit",
			box: {
				x: x0 + biggest.minX - 2,
				y: y0 + biggest.minY - 2,
				width: bigW + 4,
				height: bigH + 4,
			},
			printed: biggest.meanGray < PRINTED_GRAY,
		};
	}
	return {
		kind: "notes",
		marks: sorted.slice(0, MAX_MARKS).map((mark) => {
			const cx = (mark.minX + mark.maxX) / 2 / w;
			const cy = (mark.minY + mark.maxY) / 2 / h;
			return {
				box: {
					x: x0 + mark.minX - 1,
					y: y0 + mark.minY - 1,
					width: mark.maxX - mark.minX + 3,
					height: mark.maxY - mark.minY + 3,
				},
				central: cx > 0.3 && cx < 0.7 && cy > 0.3 && cy < 0.7,
			};
		}),
	};
}

/** Slices a line is checked in along its length; a line is dark in most. */
const LINE_SLICES = 10;
/** Slices out of `LINE_SLICES` that make a grid line rather than a digit. */
const LINE_MIN_SLICES = 7;

/** How far either side of a pixel the paper around a line is sampled. */
const RIDGE_SIDE = 7;
/** How much darker than the paper on both sides a line's pixel is. */
const RIDGE_CONTRAST = 40;

/**
 * Whether the pixel at `across` on the line `along` is part of a thin dark
 * line: darker than the paper a few pixels to either side. Thin grid lines
 * are often light grey, so this measures contrast, not an absolute level.
 */
function onRidge(
	gray: ArrayLike<number>,
	size: number,
	vertical: boolean,
	along: number,
	across: number,
) {
	const at = (offset: number) =>
		vertical ? gray[along * size + offset] : gray[offset * size + along];
	const value = at(across);
	const before = across - RIDGE_SIDE >= 0 ? at(across - RIDGE_SIDE) : 255;
	const after = across + RIDGE_SIDE < size ? at(across + RIDGE_SIDE) : 255;
	return Math.min(before, after) - value >= RIDGE_CONTRAST;
}

/**
 * How much of a band a candidate line at `at` darkens: the number of slices
 * along the band in which some pixel within a few of `at` is on a ridge. A
 * grid line crosses every slice, even slightly slanted; a digit stroke a few.
 */
function lineScore(
	gray: ArrayLike<number>,
	size: number,
	vertical: boolean,
	at: number,
	from: number,
	to: number,
) {
	let score = 0;
	const slice = (to - from) / LINE_SLICES;
	for (let s = 0; s < LINE_SLICES; s += 1) {
		let hit = false;
		const a = Math.floor(from + s * slice);
		const b = Math.floor(from + (s + 1) * slice);
		for (let along = a; along < b && !hit; along += 1) {
			for (let across = at - 4; across <= at + 4 && !hit; across += 1) {
				if (across < 0 || across >= size) continue;
				hit = onRidge(gray, size, vertical, along, across);
			}
		}
		if (hit) score += 1;
	}
	return score;
}

/** How dark one row or column of pixels is along a band. */
function lineInk(
	gray: ArrayLike<number>,
	size: number,
	vertical: boolean,
	at: number,
	from: number,
	to: number,
) {
	let ink = 0;
	for (let along = Math.floor(from); along < Math.floor(to); along += 1) {
		ink += 255 - (vertical ? gray[along * size + at] : gray[at * size + along]);
	}
	return ink;
}

/**
 * The ten lines across one band of the grid (a row of cells for the
 * vertical lines, a column for the horizontal ones), each searched near
 * where an even grid would have it. A page that curls or a grid that does
 * not quite fill the corners puts them elsewhere; where no line stands out,
 * the even position stays.
 */
function bandLines(
	gray: ArrayLike<number>,
	size: number,
	vertical: boolean,
	band: number,
) {
	const cell = size / 9;
	const from = band * cell;
	const to = from + cell;
	const reach = Math.round(cell * 0.45);
	return Array.from({ length: 10 }, (_, i) => {
		const expected = Math.round(i * cell);
		let best = expected;
		let bestScore = LINE_MIN_SLICES - 1;
		let bestInk = 0;
		for (let at = expected - reach; at <= expected + reach; at += 1) {
			if (at < 0 || at >= size) continue;
			const score = lineScore(gray, size, vertical, at, from, to);
			if (score < bestScore || score < LINE_MIN_SLICES) continue;
			// Several positions reach a line within a few pixels: take the
			// darkest, the line's middle, and the nearest of equals.
			const ink = lineInk(gray, size, vertical, at, from, to);
			if (
				score > bestScore ||
				ink > bestInk ||
				(ink === bestInk && Math.abs(at - expected) < Math.abs(best - expected))
			) {
				best = at;
				bestScore = score;
				bestInk = ink;
			}
		}
		return best;
	});
}

/**
 * Each cell's rectangle in a warped grid `size` pixels square, cut along
 * the grid lines found in its row and column bands.
 */
export function gridCells(gray: ArrayLike<number>, size: number): InkBox[] {
	const columns = Array.from({ length: 9 }, (_, row) =>
		bandLines(gray, size, true, row),
	);
	const rows = Array.from({ length: 9 }, (_, col) =>
		bandLines(gray, size, false, col),
	);
	return Array.from({ length: 81 }, (_, index) => {
		const row = Math.floor(index / 9);
		const col = index % 9;
		const x = columns[row][col];
		const y = rows[col][row];
		const width = columns[row][col + 1] - x;
		const height = rows[col][row + 1] - y;
		// A misplaced line leaves an odd cell: fall back to the even grid.
		const even = size / 9;
		if (
			width < even * 0.5 ||
			height < even * 0.5 ||
			width > even * 1.6 ||
			height > even * 1.6
		) {
			return { x: col * even, y: row * even, width: even, height: even };
		}
		return { x, y, width, height };
	});
}

/** The 81 cells' plans for a warped grid `size` pixels square. */
export function planGridReads(
	gray: ArrayLike<number>,
	size: number,
): CellReadPlan[] {
	return gridCells(gray, size).map((cell) => planCellRead(gray, size, cell));
}

/** The boxes a plan needs read, in the order `scanCellFromReads` expects. */
export function readBoxes(plan: CellReadPlan): InkBox[] {
	if (plan.kind === "digit") {
		return [plan.box];
	}
	if (plan.kind === "notes") {
		return plan.marks.map((mark) => mark.box);
	}
	return [];
}

/**
 * The cell the reads make of a plan. Handwritten digits and notes never get
 * full confidence, so the verifier flags them for a check.
 */
export function scanCellFromReads(
	plan: CellReadPlan,
	reads: readonly DigitRead[],
): ScanCell {
	if (plan.kind === "empty") {
		return emptyScanCell();
	}
	if (plan.kind === "digit") {
		const read = reads[0];
		if (!read || read.digit === 0) {
			return emptyScanCell(0.2);
		}
		return {
			type: plan.printed ? "given" : "userDigit",
			digit: read.digit,
			cornerMask: 0,
			centerMask: 0,
			confidence: Math.min(read.confidence, plan.printed ? 1 : 0.85),
		};
	}
	let cornerMask = 0;
	let centerMask = 0;
	let worst = 1;
	plan.marks.forEach((mark, index) => {
		const read = reads[index];
		if (!read || read.digit === 0) {
			worst = Math.min(worst, 0.3);
			return;
		}
		if (mark.central) {
			centerMask |= digitMask(read.digit);
		} else {
			cornerMask |= digitMask(read.digit);
		}
		worst = Math.min(worst, read.confidence, 0.8);
	});
	if (cornerMask === 0 && centerMask === 0) {
		return emptyScanCell(0.3);
	}
	return {
		type: centerMask !== 0 && cornerMask === 0 ? "centerNotes" : "cornerNotes",
		digit: 0,
		cornerMask,
		centerMask,
		confidence: worst,
	};
}
