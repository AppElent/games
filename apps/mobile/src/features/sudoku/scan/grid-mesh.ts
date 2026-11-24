/**
 * Where the grid's twenty lines run in a warped grid image. A curled page
 * bends them, so each line is traced as a curve instead of cut straight, and
 * the mesh maps the flat grid (9 × `CELL` pixels a side) onto the image.
 */
import type { Point } from "@arcadeclub/core/sudoku-scan-ink";

/** A cell's side in the flat grid. */
export const CELL = 100;
/** The flat grid's side. */
export const FLAT = CELL * 9;

/** Pixels between two points of a traced line. */
const STEP = 4;
/** The most margin around the grid in its image, in cells. */
const MAX_MARGIN = 0.7;
/** What a margin shrinks by when it does not fit in the photo. */
const MARGIN_STEP = 0.1;
/** How far from its even place a line is looked for, as a share of a cell. */
const REACH = 0.7;
/** The same, once its neighbours say where it runs. */
const NEAR_REACH = 0.45;
/** Pixels a trace may move sideways in one step. */
const MAX_BEND = 2;
/** How much a pixel looks like a line when the trace is on one. */
const ON_LINE = 0.25;
/** The share of a trace on a line for it to be a line at all. */
const MIN_SUPPORT = 0.5;
/** How often the lines are put right against each other. */
const SETTLE_ROUNDS = 2;
/** How far either side of a thin and a thick line the paper is sampled. */
const PAPER_SIDES = [7, 12];
/** Contrast with the paper at which a pixel is as much line as it gets. */
const FULL_CONTRAST = 60;
/** What a trace pays to move a pixel sideways in one step. */
const BEND_COST = 0.35;
/** What a trace pays to run a whole reach away from its even place. */
const STRAY_COST = 0.25;

/** How far a corner may be off, in cells. */
const SHIFTS = [-1, -0.67, -0.33, 0, 0.33, 0.67, 1];
/** How far off a moved line a line still counts, as a share of a cell. */
const SHIFT_REACH = 0.17;
/** Steps between the places a moved line is compared at. */
const SHIFT_SAMPLE = 8;
/** What the lines must gain from moving the corners at all, and per cell. */
const SHIFT_GAIN = 0.03;
const SHIFT_COST = 0.02;

export type GridMesh = {
	/** `vertical[i]`: the x of line `i` every `STEP` pixels down the image. */
	vertical: Float32Array[];
	/** `horizontal[i]`: the y of line `i` every `STEP` pixels along the image. */
	horizontal: Float32Array[];
	/** Which of the lines are in the image; the others only follow those. */
	found: { vertical: boolean[]; horizontal: boolean[] };
	/** Cells the four corners moved in all, one way, to get onto the lines. */
	moved: number;
};

/** The corners to warp, and where the grid's even lines come out between them. */
export type GridFrame = {
	corners: Point[];
	/** Cells outside the grid on each side. */
	margins: { left: number; top: number; right: number; bottom: number };
};

/** The photo point at (u, v) of a grid: (0, 0) its first corner, (1, 1) its third. */
function gridPlane([a, b, c, d]: readonly Point[]) {
	// The projective map of the unit square onto the corners.
	const dx1 = b.x - c.x;
	const dx2 = d.x - c.x;
	const dx3 = a.x - b.x + c.x - d.x;
	const dy1 = b.y - c.y;
	const dy2 = d.y - c.y;
	const dy3 = a.y - b.y + c.y - d.y;
	const det = dx1 * dy2 - dx2 * dy1;
	if (det === 0) return null;
	const g = (dx3 * dy2 - dx2 * dy3) / det;
	const h = (dx1 * dy3 - dx3 * dy1) / det;
	return (u: number, v: number): Point => {
		const w = g * u + h * v + 1;
		return {
			x: ((b.x - a.x + g * b.x) * u + (d.x - a.x + h * d.x) * v + a.x) / w,
			y: ((b.y - a.y + g * b.y) * u + (d.y - a.y + h * d.y) * v + a.y) / w,
		};
	};
}

/**
 * The grid with a margin, so that a page that bulges past the straight line
 * between two corners stays in the image. A side gets only as much as fits in
 * the photo: the warp crops what is outside, which would move the grid.
 */
export function withMargins(
	corners: readonly Point[],
	photo: { width: number; height: number },
): GridFrame {
	const plane = gridPlane(corners);
	const margins = { left: 0, top: 0, right: 0, bottom: 0 };
	if (!plane) return { corners: [...corners], margins };
	const place = () => {
		const left = -margins.left / 9;
		const top = -margins.top / 9;
		const right = 1 + margins.right / 9;
		const bottom = 1 + margins.bottom / 9;
		return [
			plane(left, top),
			plane(right, top),
			plane(right, bottom),
			plane(left, bottom),
		];
	};
	const fits = ({ x, y }: Point) =>
		x >= 0 && y >= 0 && x <= photo.width && y <= photo.height;
	const sides = ["left", "top", "right", "bottom"] as const;
	for (let step = MARGIN_STEP; step < MAX_MARGIN + 0.01; step += MARGIN_STEP) {
		for (const side of sides) {
			const before = margins[side];
			margins[side] = step;
			if (!place().every(fits)) margins[side] = before;
		}
	}
	return { corners: place(), margins };
}

/** How far into the photo its blended edge reaches. */
const EDGE = 3;

/**
 * The image with the part outside the photo, which the warp leaves black, in
 * paper white. It starts at the image's edge, so black ink is left alone.
 */
export function clearOutside(gray: ArrayLike<number>, size: number) {
	const pixels = Uint8Array.from(gray);
	const queue: number[] = [];
	const outside = new Uint8Array(size * size);
	const visit = (index: number) => {
		if (outside[index] || gray[index] > 1) return;
		outside[index] = 1;
		queue.push(index);
	};
	for (let i = 0; i < size; i += 1) {
		visit(i);
		visit((size - 1) * size + i);
		visit(i * size);
		visit(i * size + size - 1);
	}
	for (let index = queue.pop(); index !== undefined; index = queue.pop()) {
		const x = index % size;
		const y = Math.floor(index / size);
		if (x > 0) visit(index - 1);
		if (x < size - 1) visit(index + 1);
		if (y > 0) visit(index - size);
		if (y < size - 1) visit(index + size);
		for (let dy = -EDGE; dy <= EDGE; dy += 1) {
			for (let dx = -EDGE; dx <= EDGE; dx += 1) {
				const px = x + dx;
				const py = y + dy;
				if (px >= 0 && py >= 0 && px < size && py < size) {
					pixels[py * size + px] = 255;
				}
			}
		}
	}
	return pixels;
}

/**
 * How much a pixel looks like part of a line running `vertical`ly: how much
 * darker it is than the paper on both sides, from 0 to 1.
 */
function lineness(
	gray: ArrayLike<number>,
	size: number,
	vertical: boolean,
	along: number,
	across: number,
) {
	if (across < 1 || across + 1 >= size) return 0;
	const step = vertical ? 1 : size;
	const index = vertical ? along * size + across : across * size + along;
	// Averaged over the line's width, so that a trace keeps to its middle.
	const value = (gray[index - step] + gray[index] * 2 + gray[index + step]) / 4;
	let contrast = 0;
	for (let i = 0; i < PAPER_SIDES.length; i += 1) {
		const side = PAPER_SIDES[i];
		if (across < side || across + side >= size) continue;
		contrast = Math.max(
			contrast,
			Math.min(gray[index - side * step], gray[index + side * step]) - value,
		);
	}
	return Math.min(1, contrast / FULL_CONTRAST);
}

/** How the ten lines one way lie in the image before they are traced. */
type Layout = {
	cell: number;
	cellAlong: number;
	/** Cells before the first line, and before the lines start. */
	before: number;
	beforeAlong: number;
};

/** The lineness of every pixel across, at every step along: a row per step. */
function linenessMap(gray: ArrayLike<number>, size: number, vertical: boolean) {
	const steps = Math.floor((size - 1) / STEP) + 1;
	const map = new Float32Array(steps * size);
	for (let step = 0; step < steps; step += 1) {
		const along = step * STEP;
		const next = Math.min(size - 1, along + STEP / 2);
		for (let across = 0; across < size; across += 1) {
			map[step * size + across] =
				(lineness(gray, size, vertical, along, across) +
					lineness(gray, size, vertical, next, across)) /
				2;
		}
	}
	return map;
}

type Trace = {
	path: Float32Array;
	/** The share of the path that is on a line. */
	support: number;
};

/** The strongest lineness within `reach` pixels across of every place. */
function widened(lines: Float32Array, size: number, reach: number) {
	const map = new Float32Array(lines.length);
	for (let start = 0; start < lines.length; start += size) {
		for (let across = 0; across < size; across += 1) {
			const value = lines[start + across];
			if (value < ON_LINE) continue;
			const low = Math.max(0, across - reach);
			const high = Math.min(size - 1, across + reach);
			for (let i = start + low; i <= start + high; i += 1) {
				if (map[i] < value) map[i] = value;
			}
		}
	}
	return map;
}

/**
 * Where to look for line `i` at each step, with the grid's corners moved by
 * `shifts` pixels: at the line's start and end, for the first and last line.
 */
function expectedLine(
	i: number,
	steps: number,
	{ cell, cellAlong, before, beforeAlong }: Layout,
	shifts: readonly number[],
) {
	const u = i / 9;
	const start = shifts[0] * (1 - u) + shifts[1] * u;
	const end = shifts[2] * (1 - u) + shifts[3] * u;
	return Float32Array.from({ length: steps }, (_, step) => {
		const v = ((step * STEP) / cellAlong - beforeAlong) / 9;
		return (before + i) * cell + start * (1 - v) + end * v;
	});
}

/**
 * How far the corners are off, for lines one way. The corners of a curled
 * page are easily placed half a cell wrong, which puts some lines out of reach.
 */
function cornerShifts(lines: Float32Array, size: number, layout: Layout) {
	const { cell } = layout;
	const steps = lines.length / size;
	const map = widened(lines, size, Math.round(cell * SHIFT_REACH));
	const score = (shifts: readonly number[]) => {
		let sum = 0;
		let count = 0;
		for (let i = 0; i <= 9; i += 1) {
			const u = i / 9;
			const start = shifts[0] * (1 - u) + shifts[1] * u;
			const end = shifts[2] * (1 - u) + shifts[3] * u;
			for (let step = 0; step < steps; step += SHIFT_SAMPLE) {
				const v = ((step * STEP) / layout.cellAlong - layout.beforeAlong) / 9;
				if (v < 0 || v > 1) continue;
				const across = Math.round(
					(layout.before + i) * cell + start * (1 - v) + end * v,
				);
				if (across >= 0 && across < size) sum += map[step * size + across];
				count += 1;
			}
		}
		return sum / count;
	};
	let best = [0, 0, 0, 0];
	let bestScore = score(best) + SHIFT_GAIN;
	const options = SHIFTS.map((shift) => shift * cell);
	for (const a of options) {
		for (const b of options) {
			for (const c of options) {
				for (const d of options) {
					const shifts = [a, b, c, d];
					const far =
						shifts.reduce((sum, shift) => sum + Math.abs(shift), 0) / cell;
					const value = score(shifts) - far * SHIFT_COST;
					if (value > bestScore) {
						best = shifts;
						bestScore = value;
					}
				}
			}
		}
	}
	return best;
}

/**
 * The smoothest, most line-like path within `reach` pixels of `expected` (one
 * place per step), by dynamic programming.
 */
function traceLine(
	lines: Float32Array,
	size: number,
	expected: ArrayLike<number>,
	reach: number,
): Trace {
	const steps = expected.length;
	const offsets = reach * 2 + 1;
	const back = new Int8Array(steps * offsets);
	const onLine = new Float32Array(steps * offsets);
	let scores = new Float32Array(offsets);
	let next = new Float32Array(offsets);
	for (let step = 0; step < steps; step += 1) {
		const middle = Math.round(expected[step]);
		const shift = step > 0 ? middle - Math.round(expected[step - 1]) : 0;
		for (let offset = 0; offset < offsets; offset += 1) {
			const across = middle - reach + offset;
			const line =
				across < 0 || across >= size ? 0 : lines[step * size + across];
			onLine[step * offsets + offset] = line;
			const stray = Math.abs(offset - reach) / reach;
			let best = Number.NEGATIVE_INFINITY;
			let from = 0;
			for (let move = -MAX_BEND; move <= MAX_BEND; move += 1) {
				const previous = offset + move + shift;
				if (previous < 0 || previous >= offsets) continue;
				const score = scores[previous] - BEND_COST * Math.abs(move);
				if (score > best || (score === best && move === 0)) {
					best = score;
					from = move + shift;
				}
			}
			if (best === Number.NEGATIVE_INFINITY) best = scores[offset] - 1;
			next[offset] = best + line - STRAY_COST * stray;
			back[step * offsets + offset] = from;
		}
		[scores, next] = [next, scores];
	}
	let offset = 0;
	for (let i = 1; i < offsets; i += 1) {
		if (scores[i] > scores[offset]) offset = i;
	}
	const path = new Float32Array(steps);
	let support = 0;
	for (let step = steps - 1; step >= 0; step -= 1) {
		path[step] = Math.round(expected[step]) - reach + offset;
		if (onLine[step * offsets + offset] >= ON_LINE) support += 1;
		offset += back[step * offsets + offset];
	}
	return { path, support: support / steps };
}

/**
 * Where the other lines put line `i`: a straight fit of place to line number
 * at every step, the nearest lines counting most.
 */
function predicted(traces: Trace[], i: number): Float32Array | null {
	const others = traces
		.map(({ path, support }, index) => ({
			path,
			index,
			weight: index === i ? 0 : support * 0.45 ** Math.abs(index - i),
			support,
		}))
		.filter(({ index, support }) => index !== i && support >= MIN_SUPPORT);
	if (others.length < 2) return null;
	return Float32Array.from(traces[i].path, (_, step) => {
		let sum = 0;
		let sumX = 0;
		let sumY = 0;
		let sumXX = 0;
		let sumXY = 0;
		for (const { path, index, weight } of others) {
			const x = index - i;
			sum += weight;
			sumX += weight * x;
			sumY += weight * path[step];
			sumXX += weight * x * x;
			sumXY += weight * x * path[step];
		}
		return (sumXX * sumY - sumX * sumXY) / (sum * sumXX - sumX * sumX);
	});
}

/**
 * The ten lines one way. Each is traced on its own first; then again near
 * where the others put it, so that a line that is missing or faint, or that
 * lost out to a row of digits, falls in with its neighbours.
 */
function traceLines(
	gray: ArrayLike<number>,
	size: number,
	vertical: boolean,
	layout: Layout,
) {
	const { cell } = layout;
	const lines = linenessMap(gray, size, vertical);
	const steps = lines.length / size;
	const shifts = cornerShifts(lines, size, layout);
	const traces = Array.from({ length: 10 }, (_, i) =>
		traceLine(
			lines,
			size,
			expectedLine(i, steps, layout, shifts),
			Math.round(REACH * cell),
		),
	);
	for (let round = 0; round < SETTLE_ROUNDS; round += 1) {
		// From the surest line on, each with its neighbours as they are by then.
		const order = traces
			.map((_, i) => i)
			.sort((a, b) => traces[b].support - traces[a].support);
		for (const i of order) {
			const place = predicted(traces, i);
			if (!place) continue;
			const again = traceLine(
				lines,
				size,
				place,
				Math.round(NEAR_REACH * cell),
			);
			traces[i] =
				again.support >= MIN_SUPPORT ? again : { path: place, support: 0 };
		}
	}
	return {
		paths: traces.map(({ path }) => path),
		found: traces.map(({ support }) => support >= MIN_SUPPORT),
		moved: shifts.reduce((sum, shift) => sum + Math.abs(shift), 0) / cell,
	};
}

/** The mesh of grid lines in an image warped from a frame. */
export function findMesh(
	gray: ArrayLike<number>,
	size: number,
	{ left, top, right, bottom }: GridFrame["margins"],
): GridMesh {
	const cellX = size / (9 + left + right);
	const cellY = size / (9 + top + bottom);
	const vertical = traceLines(gray, size, true, {
		cell: cellX,
		cellAlong: cellY,
		before: left,
		beforeAlong: top,
	});
	const horizontal = traceLines(gray, size, false, {
		cell: cellY,
		cellAlong: cellX,
		before: top,
		beforeAlong: left,
	});
	return {
		vertical: vertical.paths,
		horizontal: horizontal.paths,
		found: { vertical: vertical.found, horizontal: horizontal.found },
		moved: Math.max(vertical.moved, horizontal.moved),
	};
}

function at(path: Float32Array, along: number) {
	const place = Math.max(0, Math.min(path.length - 1, along / STEP));
	const low = Math.floor(place);
	const high = Math.min(path.length - 1, low + 1);
	return path[low] + (path[high] - path[low]) * (place - low);
}

/** Where lines `column` and `row` cross in the image. */
function crossing(mesh: GridMesh, column: number, row: number): Point {
	const vertical = mesh.vertical[column];
	const horizontal = mesh.horizontal[row];
	let x = at(vertical, 0);
	let y = 0;
	for (let i = 0; i < 4; i += 1) {
		y = at(horizontal, x);
		x = at(vertical, y);
	}
	return { x, y };
}

/**
 * The image point of every flat pixel, as x and y arrays `FLAT` square. Each
 * cell is bent along its own four lines (a Coons patch), so lines that curve
 * within a cell come out straight too.
 */
export function flatMap(mesh: GridMesh) {
	const mapX = new Float32Array(FLAT * FLAT);
	const mapY = new Float32Array(FLAT * FLAT);
	const corners = Array.from({ length: 10 }, (_, row) =>
		Array.from({ length: 10 }, (_, column) => crossing(mesh, column, row)),
	);
	for (let row = 0; row < 9; row += 1) {
		for (let column = 0; column < 9; column += 1) {
			const a = corners[row][column];
			const b = corners[row][column + 1];
			const c = corners[row + 1][column];
			const d = corners[row + 1][column + 1];
			const top = mesh.horizontal[row];
			const bottom = mesh.horizontal[row + 1];
			const left = mesh.vertical[column];
			const right = mesh.vertical[column + 1];
			for (let v = 0; v < CELL; v += 1) {
				const t = (v + 0.5) / CELL;
				const leftY = a.y + (c.y - a.y) * t;
				const leftX = at(left, leftY);
				const rightY = b.y + (d.y - b.y) * t;
				const rightX = at(right, rightY);
				for (let u = 0; u < CELL; u += 1) {
					const s = (u + 0.5) / CELL;
					const topX = a.x + (b.x - a.x) * s;
					const topY = at(top, topX);
					const bottomX = c.x + (d.x - c.x) * s;
					const bottomY = at(bottom, bottomX);
					const index = (row * CELL + v) * FLAT + column * CELL + u;
					mapX[index] =
						(1 - t) * topX +
						t * bottomX +
						(1 - s) * leftX +
						s * rightX -
						((1 - s) * (1 - t) * a.x +
							s * (1 - t) * b.x +
							(1 - s) * t * c.x +
							s * t * d.x);
					mapY[index] =
						(1 - t) * topY +
						t * bottomY +
						(1 - s) * leftY +
						s * rightY -
						((1 - s) * (1 - t) * a.y +
							s * (1 - t) * b.y +
							(1 - s) * t * c.y +
							s * t * d.y);
				}
			}
		}
	}
	return { mapX, mapY };
}

/** The warped grid with its lines straightened, bilinearly sampled. */
export function flatten(gray: ArrayLike<number>, size: number, mesh: GridMesh) {
	const { mapX, mapY } = flatMap(mesh);
	const pixels = new Uint8Array(FLAT * FLAT);
	for (let i = 0; i < pixels.length; i += 1) {
		const x = Math.max(0, Math.min(size - 1.001, mapX[i]));
		const y = Math.max(0, Math.min(size - 1.001, mapY[i]));
		const x0 = Math.floor(x);
		const y0 = Math.floor(y);
		const fx = x - x0;
		const fy = y - y0;
		const index = y0 * size + x0;
		pixels[i] =
			(gray[index] * (1 - fx) + gray[index + 1] * fx) * (1 - fy) +
			(gray[index + size] * (1 - fx) + gray[index + size + 1] * fx) * fy;
	}
	return { pixels, mapX, mapY };
}
