/**
 * Finds the corners of a sudoku grid in a photo, as Apple Vision does for the
 * phone. Pure pixel work without the DOM: the scan runs it in a worker.
 *
 * The photo is thresholded against its local brightness, so shadows drop out
 * and lines stay. A printed grid is then one large connected piece of ink:
 * the biggest pieces are each boxed in four corners, and a candidate only
 * counts when nine rows and columns of lines are really inside it.
 */
import type { Point } from "@arcadeclub/core/sudoku-scan-ink";

/** Longest side the photo is searched at; more detail only costs time. */
export const DETECT_MAX_DIM = 800;

/** Half the window the local brightness is averaged over, in longest sides. */
const WINDOW = 1 / 50;
/**
 * How much darker than its surroundings a pixel is to count as ink: crisp
 * print first, then fainter, for thin or blurred lines.
 */
const INK_CONTRASTS = [0.1, 0.05, 0.025];
/** The smallest grid worth finding, as a part of the photo's shortest side. */
const MIN_SPAN = 0.2;
/** Candidate pieces of ink looked at, largest first. */
const MAX_CANDIDATES = 6;
/** The shortest side of a grid seen at an angle, against its longest. */
const MIN_SIDE_RATIO = 0.4;
/** Part of the grid's 180 line pieces that must be there. */
const MIN_GRID_SCORE = 0.7;
/** A grid this complete needs no fainter look. */
const CLEAR_GRID_SCORE = 0.9;

/** The quad's corners from the top-left, clockwise; null when unsure. */
export function detectGridCorners(
	gray: ArrayLike<number>,
	width: number,
	height: number,
): Point[] | null {
	const means = localMeans(gray, width, height);
	let best: Point[] | null = null;
	let bestFit = 0;
	let clear = false;
	for (const contrast of INK_CONTRASTS) {
		const ink = inkMask(gray, means, contrast);
		for (const hull of inkHulls(ink, width, height)) {
			const corners = largestQuad(hull);
			if (!corners) {
				continue;
			}
			for (const quad of [corners, straightenSides(corners, hull)]) {
				if (!quad || !isGridShaped(quad)) {
					continue;
				}
				const { score, fit } = scoreGrid(ink, width, height, quad);
				if (score >= MIN_GRID_SCORE && fit > bestFit) {
					best = quad;
					bestFit = fit;
					clear = score >= CLEAR_GRID_SCORE;
				}
			}
		}
		if (clear) {
			break;
		}
	}
	return best
		? clockwiseFromTopLeft(best).map((point) => ({
				x: Math.max(0, Math.min(width, point.x)),
				y: Math.max(0, Math.min(height, point.y)),
			}))
		: null;
}

/** Each pixel's surroundings' average brightness. */
function localMeans(gray: ArrayLike<number>, width: number, height: number) {
	// Summed-area table, one row and column larger, for the local mean.
	const stride = width + 1;
	const sums = new Float64Array(stride * (height + 1));
	for (let y = 0; y < height; y += 1) {
		let row = 0;
		for (let x = 0; x < width; x += 1) {
			row += gray[y * width + x];
			sums[(y + 1) * stride + x + 1] = sums[y * stride + x + 1] + row;
		}
	}
	const reach = Math.max(4, Math.round(Math.max(width, height) * WINDOW));
	const means = new Float32Array(width * height);
	for (let y = 0; y < height; y += 1) {
		const y0 = Math.max(0, y - reach);
		const y1 = Math.min(height, y + reach + 1);
		for (let x = 0; x < width; x += 1) {
			const x0 = Math.max(0, x - reach);
			const x1 = Math.min(width, x + reach + 1);
			const sum =
				sums[y1 * stride + x1] -
				sums[y0 * stride + x1] -
				sums[y1 * stride + x0] +
				sums[y0 * stride + x0];
			means[y * width + x] = sum / ((x1 - x0) * (y1 - y0));
		}
	}
	return means;
}

/** 1 for each pixel that is darker than the paper around it. */
function inkMask(
	gray: ArrayLike<number>,
	means: Float32Array,
	contrast: number,
) {
	const ink = new Uint8Array(means.length);
	for (let i = 0; i < ink.length; i += 1) {
		ink[i] = gray[i] < means[i] * (1 - contrast) - 1 ? 1 : 0;
	}
	return ink;
}

/** The outlines of the largest connected pieces of ink, largest first. */
function inkHulls(ink: Uint8Array, width: number, height: number): Point[][] {
	const seen = new Uint8Array(ink.length);
	const stack = new Int32Array(ink.length);
	const minSpan = Math.min(width, height) * MIN_SPAN;
	const pieces: { area: number; edge: Point[] }[] = [];
	for (let start = 0; start < ink.length; start += 1) {
		if (!ink[start] || seen[start]) {
			continue;
		}
		let size = 0;
		stack[size++] = start;
		seen[start] = 1;
		// The first and last ink of each row hold every corner of the hull.
		const rowMin = new Map<number, number>();
		const rowMax = new Map<number, number>();
		while (size > 0) {
			const index = stack[--size];
			const x = index % width;
			const y = (index - x) / width;
			rowMin.set(y, Math.min(rowMin.get(y) ?? x, x));
			rowMax.set(y, Math.max(rowMax.get(y) ?? x, x));
			for (let ny = y - 1; ny <= y + 1; ny += 1) {
				if (ny < 0 || ny >= height) continue;
				for (let nx = x - 1; nx <= x + 1; nx += 1) {
					if (nx < 0 || nx >= width) continue;
					const next = ny * width + nx;
					if (ink[next] && !seen[next]) {
						seen[next] = 1;
						stack[size++] = next;
					}
				}
			}
		}
		const spanX = Math.max(...rowMax.values()) - Math.min(...rowMin.values());
		const spanY = rowMin.size;
		if (spanX < minSpan || spanY < minSpan) {
			continue;
		}
		const edge = [...rowMin].map(([y, x]) => ({ x, y }));
		edge.push(...[...rowMax].map(([y, x]) => ({ x, y })));
		pieces.push({ area: spanX * spanY, edge });
	}
	return pieces
		.sort((a, b) => b.area - a.area)
		.slice(0, MAX_CANDIDATES)
		.map((piece) => convexHull(piece.edge));
}

/** Twice the signed area of the triangle a, b, c. */
function cross(a: Point, b: Point, c: Point) {
	return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

/** Andrew's monotone chain. */
function convexHull(points: Point[]): Point[] {
	const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
	const chain = (input: Point[]) => {
		const out: Point[] = [];
		for (const point of input) {
			while (
				out.length >= 2 &&
				cross(out[out.length - 2], out[out.length - 1], point) <= 0
			) {
				out.pop();
			}
			out.push(point);
		}
		out.pop();
		return out;
	};
	return [...chain(sorted), ...chain(sorted.reverse())];
}

/** The largest four-cornered shape with its corners on the hull. */
function largestQuad(hull: Point[]): Point[] | null {
	const n = hull.length;
	let best: Point[] | null = null;
	let bestArea = 0;
	for (let i = 0; i < n; i += 1) {
		for (let j = i + 2; j < n; j += 1) {
			// The farthest point on either side of the diagonal i-j.
			let left = -1;
			let leftArea = 0;
			for (let k = i + 1; k < j; k += 1) {
				const area = -cross(hull[i], hull[j], hull[k]);
				if (area > leftArea) {
					leftArea = area;
					left = k;
				}
			}
			let right = -1;
			let rightArea = 0;
			for (let k = j + 1; k < n + i; k += 1) {
				const area = cross(hull[i], hull[j], hull[k % n]);
				if (area > rightArea) {
					rightArea = area;
					right = k % n;
				}
			}
			if (left >= 0 && right >= 0 && leftArea + rightArea > bestArea) {
				bestArea = leftArea + rightArea;
				best = [hull[i], hull[left], hull[j], hull[right]];
			}
		}
	}
	return best;
}

function distance(a: Point, b: Point) {
	return Math.hypot(a.x - b.x, a.y - b.y);
}

/** The hull's points every few pixels, so long sides count for more. */
function alongHull(hull: Point[]) {
	return hull.flatMap((from, i) => {
		const to = hull[(i + 1) % hull.length];
		const steps = Math.max(1, Math.round(distance(from, to) / 3));
		return Array.from({ length: steps }, (_, s) => ({
			x: from.x + ((to.x - from.x) * s) / steps,
			y: from.y + ((to.y - from.y) * s) / steps,
		}));
	});
}

/**
 * The quad whose sides follow the hull's straight stretches. A grid with
 * rounded corners has its corners off the hull, where those sides meet.
 */
function straightenSides(quad: Point[], hull: Point[]): Point[] | null {
	const points = alongHull(hull);
	const lines = quad.map((a, i) => {
		const b = quad[(i + 1) % 4];
		const length = distance(a, b);
		// The hull along the side's middle, past the corners' own bends.
		const near = points.filter((p) => {
			const along =
				((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / length ** 2;
			const off = Math.abs(cross(a, b, p)) / length;
			return along > 0.15 && along < 0.85 && off < length * 0.06;
		});
		return near.length >= 4 ? fitLine(near) : null;
	});
	const corners = lines.map((line, i) => {
		const before = lines[(i + 3) % 4];
		return line && before ? intersection(before, line) : null;
	});
	return corners.every((point) => point !== null) ? corners : null;
}

type Line = { through: Point; dx: number; dy: number };

/** The line with the least squared distance to the points. */
function fitLine(points: Point[]): Line {
	const x = points.reduce((sum, p) => sum + p.x, 0) / points.length;
	const y = points.reduce((sum, p) => sum + p.y, 0) / points.length;
	let xx = 0;
	let xy = 0;
	let yy = 0;
	for (const p of points) {
		xx += (p.x - x) ** 2;
		xy += (p.x - x) * (p.y - y);
		yy += (p.y - y) ** 2;
	}
	const angle = Math.atan2(2 * xy, xx - yy) / 2;
	return { through: { x, y }, dx: Math.cos(angle), dy: Math.sin(angle) };
}

function intersection(a: Line, b: Line): Point | null {
	const det = a.dx * b.dy - a.dy * b.dx;
	if (Math.abs(det) < 0.1) {
		return null;
	}
	const t =
		((b.through.x - a.through.x) * b.dy - (b.through.y - a.through.y) * b.dx) /
		det;
	return { x: a.through.x + a.dx * t, y: a.through.y + a.dy * t };
}

/** A square seen at an angle: no sliver, and no corner close to flat. */
function isGridShaped(quad: Point[]) {
	const sides = quad.map((p, i) => distance(p, quad[(i + 1) % 4]));
	if (Math.min(...sides) < Math.max(...sides) * MIN_SIDE_RATIO) {
		return false;
	}
	return quad.every((p, i) => {
		const a = quad[(i + 3) % 4];
		const b = quad[(i + 1) % 4];
		const sine = Math.abs(cross(p, a, b)) / (distance(p, a) * distance(p, b));
		return sine > 0.5;
	});
}

function clockwiseFromTopLeft(quad: Point[]) {
	const cx = quad.reduce((sum, p) => sum + p.x, 0) / 4;
	const cy = quad.reduce((sum, p) => sum + p.y, 0) / 4;
	const around = [...quad].sort(
		(a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx),
	);
	const first = around.reduce(
		(least, p, i) =>
			p.x + p.y < around[least].x + around[least].y ? i : least,
		0,
	);
	return [...around.slice(first), ...around.slice(0, first)];
}

/** Where (u, v) in the unit square lands in the quad, seen in perspective. */
function perspective(quad: Point[]) {
	const [p0, p1, p2, p3] = quad;
	const sx = p0.x - p1.x + p2.x - p3.x;
	const sy = p0.y - p1.y + p2.y - p3.y;
	const d1x = p1.x - p2.x;
	const d1y = p1.y - p2.y;
	const d2x = p3.x - p2.x;
	const d2y = p3.y - p2.y;
	const det = d1x * d2y - d1y * d2x;
	const g = (sx * d2y - sy * d2x) / det;
	const h = (d1x * sy - d1y * sx) / det;
	return (u: number, v: number): Point => {
		const w = g * u + h * v + 1;
		return {
			x:
				((p1.x - p0.x + g * p1.x) * u + (p3.x - p0.x + h * p3.x) * v + p0.x) /
				w,
			y:
				((p1.y - p0.y + g * p1.y) * u + (p3.y - p0.y + h * p3.y) * v + p0.y) /
				w,
		};
	};
}

/** Pixels a cell is straightened to for scoring. */
const CELL = 24;
/** How far from its even place a line may be, in cells: pages curl. */
const LINE_REACH = 0.3;
/** Part of a cell's middle a line must run through. */
const LINE_COVER = 0.75;

/**
 * Which part of a sudoku's lines the quad holds: for each of the nine rows
 * the ten vertical lines, and for each column the ten horizontal ones. Lines
 * halfway a cell count against it, so a grid of another size falls short.
 * `fit` also takes off how far the lines are from their even places, which
 * tells the true corners from ones a few pixels away.
 */
function scoreGrid(
	ink: Uint8Array,
	width: number,
	height: number,
	quad: Point[],
) {
	const side = CELL * 9;
	// Room around the grid: its outer lines lie on the quad itself.
	const pad = Math.round(CELL * LINE_REACH);
	const size = side + pad * 2 + 1;
	const toPhoto = perspective(quad);
	const flat = new Uint8Array(size * size);
	for (let y = 0; y < size; y += 1) {
		for (let x = 0; x < size; x += 1) {
			const p = toPhoto((x - pad) / side, (y - pad) / side);
			const px = Math.round(p.x);
			const py = Math.round(p.y);
			if (px >= 0 && py >= 0 && px < width && py < height) {
				flat[y * size + x] = ink[py * width + px];
			}
		}
	}

	let found = 0;
	let between = 0;
	let offsets = 0;
	for (const vertical of [true, false]) {
		const at = (across: number, along: number) =>
			vertical ? flat[along * size + across] : flat[across * size + along];
		for (let band = 0; band < 9; band += 1) {
			const from = pad + Math.round((band + 0.2) * CELL);
			const to = pad + Math.round((band + 0.8) * CELL);
			// Where the band is inked from end to end; a line may slant a pixel.
			const isLine = (across: number) => {
				let inked = 0;
				for (let along = from; along < to; along += 1) {
					if (
						at(across, along) ||
						(across > 0 && at(across - 1, along)) ||
						(across < size - 1 && at(across + 1, along))
					) {
						inked += 1;
					}
				}
				return inked >= (to - from) * LINE_COVER;
			};
			/** Pixels from `center` to the nearest line, null beyond `reach`. */
			const lineOffset = (center: number, reach: number) => {
				for (let d = 0; d <= reach; d += 1) {
					if (isLine(center - d) || isLine(center + d)) return d;
				}
				return null;
			};
			for (let line = 0; line < 10; line += 1) {
				const offset = lineOffset(pad + line * CELL, pad);
				if (offset !== null) {
					found += 1;
					offsets += offset / pad;
				}
				if (line < 9 && lineOffset(pad + (line + 0.5) * CELL, 2) !== null) {
					between += 1;
				}
			}
		}
	}
	const score = (found - between) / 180;
	return { score, fit: score - offsets / 180 };
}
