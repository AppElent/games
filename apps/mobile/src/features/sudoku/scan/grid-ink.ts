/**
 * The ink in each cell of a flattened grid (see `grid-mesh.ts`). Grid lines
 * are taken out first and ink is followed across the cell's edges, so a
 * handwritten digit that touches or crosses a line stays whole.
 */
import type { InkBox } from "@arcadeclub/core/sudoku-scan-ink";
import { CELL, FLAT } from "./grid-mesh";

/** One connected piece of ink, in flat pixels. */
export type InkPiece = {
	minX: number;
	maxX: number;
	minY: number;
	maxY: number;
	/** Indexes into the flat image. */
	pixels: number[];
};

export type CellInk =
	| { kind: "empty" }
	| { kind: "digit"; ink: InkPiece }
	| { kind: "notes"; marks: InkPiece[] };

/** The paper's brightness is measured in windows this far apart. */
const PAPER_STEP = 25;
/** Share of a window that may be ink. */
const PAPER_PERCENTILE = 0.8;
/** How much darker than the paper ink is at least, as a share of the paper. */
const MIN_DARKNESS = 0.18;
/** Ink is at least this dark next to the darkest ink in its cell. */
const RELATIVE_DARKNESS = 0.45;
/** Half the widest grid line looked for, in flat pixels. */
const LINE_REACH = 12;
/** The share of a piece this near a line that makes it part of the line. */
const LEFTOVER_SHARE = 0.6;
/** A digit is at least this tall; smaller ink is a note. */
const DIGIT_HEIGHT = 33;
/** A digit is at least this wide: a handwritten 1 is a single stroke. */
const DIGIT_WIDTH = 4;
/** Smaller pieces are specks. */
const MIN_PIXELS = 14;
/** A piece this near the digit is part of it: a 5's bar, a broken stroke. */
const PART_GAP = 7;
/** A broken digit's largest part is at least this tall or wide. */
const PART_SIZE = 22;
/** A note is at least this tall and has at least this much ink. */
const MARK_HEIGHT = 12;
const MIN_MARK_PIXELS = 40;
/** Ink wider or taller than this runs across cells and is cut at the lines. */
const MAX_SPAN = 125;
/** Notes read per cell at most. */
const MAX_MARKS = 6;

function percentile(values: Uint8Array | Float32Array, share: number) {
	const sorted = values.slice().sort();
	return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * share))];
}

/** Each pixel's darkness against the paper around it, from 0 to 1. */
export function darkness(flat: ArrayLike<number>): Float32Array {
	const count = FLAT / PAPER_STEP + 1;
	const paper = new Float32Array(count * count);
	const values = new Uint8Array(PAPER_STEP ** 2);
	for (let row = 0; row < count; row += 1) {
		for (let column = 0; column < count; column += 1) {
			let used = 0;
			for (let dy = -PAPER_STEP; dy < PAPER_STEP; dy += 2) {
				for (let dx = -PAPER_STEP; dx < PAPER_STEP; dx += 2) {
					const x = Math.max(0, Math.min(FLAT - 1, column * PAPER_STEP + dx));
					const y = Math.max(0, Math.min(FLAT - 1, row * PAPER_STEP + dy));
					values[used] = flat[y * FLAT + x];
					used += 1;
				}
			}
			paper[row * count + column] = percentile(values, PAPER_PERCENTILE);
		}
	}
	const dark = new Float32Array(FLAT * FLAT);
	for (let y = 0; y < FLAT; y += 1) {
		const row = Math.floor(y / PAPER_STEP);
		const fy = y / PAPER_STEP - row;
		for (let x = 0; x < FLAT; x += 1) {
			const column = Math.floor(x / PAPER_STEP);
			const fx = x / PAPER_STEP - column;
			const at = row * count + column;
			const value =
				(paper[at] * (1 - fx) + paper[at + 1] * fx) * (1 - fy) +
				(paper[at + count] * (1 - fx) + paper[at + count + 1] * fx) * fy;
			const index = y * FLAT + x;
			dark[index] = Math.max(0, 1 - flat[index] / Math.max(1, value));
		}
	}
	return dark;
}

/** The darkness that counts as ink in each cell. */
function inkThresholds(dark: Float32Array) {
	const inset = 12;
	const side = CELL - inset * 2;
	const values = new Float32Array(side * side);
	return Float32Array.from({ length: 81 }, (_, cell) => {
		const x0 = (cell % 9) * CELL + inset;
		const y0 = Math.floor(cell / 9) * CELL + inset;
		for (let y = 0; y < side; y += 1) {
			for (let x = 0; x < side; x += 1) {
				values[y * side + x] = dark[(y0 + y) * FLAT + x0 + x];
			}
		}
		return Math.max(MIN_DARKNESS, percentile(values, 0.99) * RELATIVE_DARKNESS);
	});
}

/**
 * Clears one cell side of a grid line, `across` being its place, from `ink`.
 * A stroke that comes out on both sides of the line keeps its crossing.
 */
function clearLine(
	ink: Uint8Array,
	dark: Float32Array,
	vertical: boolean,
	line: number,
	from: number,
) {
	const at = (along: number, across: number) =>
		vertical ? along * FLAT + across : across * FLAT + along;
	const inside = (across: number) => across >= 0 && across < FLAT;
	const middle = line * CELL;
	const samples = new Float32Array(CELL - 20);
	const levels: number[] = [];
	for (let offset = -LINE_REACH; offset <= LINE_REACH; offset += 1) {
		const across = middle + offset;
		if (!inside(across)) {
			levels.push(0);
			continue;
		}
		for (let i = 0; i < samples.length; i += 1) {
			samples[i] = dark[at(from + 10 + i, across)];
		}
		levels.push(percentile(samples, 0.5));
	}
	let peak = LINE_REACH;
	for (let i = LINE_REACH - 5; i <= LINE_REACH + 5; i += 1) {
		if (levels[i] > levels[peak]) peak = i;
	}
	const limit = Math.max(0.08, levels[peak] * 0.35);
	let low = peak;
	let high = peak;
	while (low > 0 && levels[low - 1] > limit) low -= 1;
	while (high < levels.length - 1 && levels[high + 1] > limit) high += 1;
	const first = middle - LINE_REACH + low - 1;
	const last = middle - LINE_REACH + high + 1;

	const keep = new Set<number>();
	if (inside(first - 1) && inside(last + 1)) {
		const depth = last - first + 2;
		for (
			let along = from + LINE_REACH;
			along < from + CELL - LINE_REACH;
			along += 1
		) {
			if (!ink[at(along, first - 1)]) continue;
			for (let slant = -depth; slant <= depth; slant += 1) {
				const end = along + slant;
				if (end < 0 || end >= FLAT || !ink[at(end, last + 1)]) continue;
				for (let across = first; across <= last; across += 1) {
					const share = (across - first + 1) / depth;
					const index = at(Math.round(along + slant * share), across);
					if (ink[index]) keep.add(index);
				}
			}
		}
	}
	for (let across = first; across <= last; across += 1) {
		if (!inside(across)) continue;
		for (let along = from; along < from + CELL; along += 1) {
			const index = at(along, across);
			if (!keep.has(index)) ink[index] = 0;
		}
	}
}

/** Connected ink, diagonals included. */
function pieces(ink: Uint8Array): InkPiece[] {
	const seen = new Uint8Array(ink.length);
	const found: InkPiece[] = [];
	for (let start = 0; start < ink.length; start += 1) {
		if (!ink[start] || seen[start]) continue;
		const pixels = [start];
		seen[start] = 1;
		for (let i = 0; i < pixels.length; i += 1) {
			const x = pixels[i] % FLAT;
			const y = Math.floor(pixels[i] / FLAT);
			for (let dy = -1; dy <= 1; dy += 1) {
				for (let dx = -1; dx <= 1; dx += 1) {
					const px = x + dx;
					const py = y + dy;
					if (px < 0 || py < 0 || px >= FLAT || py >= FLAT) continue;
					const next = py * FLAT + px;
					if (!ink[next] || seen[next]) continue;
					seen[next] = 1;
					pixels.push(next);
				}
			}
		}
		if (pixels.length >= MIN_PIXELS) found.push(pieceOf(pixels));
	}
	return found;
}

function pieceOf(pixels: number[]): InkPiece {
	const piece = { minX: FLAT, maxX: 0, minY: FLAT, maxY: 0, pixels };
	for (const index of pixels) {
		const x = index % FLAT;
		const y = Math.floor(index / FLAT);
		piece.minX = Math.min(piece.minX, x);
		piece.maxX = Math.max(piece.maxX, x);
		piece.minY = Math.min(piece.minY, y);
		piece.maxY = Math.max(piece.maxY, y);
	}
	return piece;
}

const widthOf = (piece: InkPiece) => piece.maxX - piece.minX + 1;
export const heightOf = (piece: InkPiece) => piece.maxY - piece.minY + 1;

/** The cell most of a piece lies in. */
function cellOf(piece: InkPiece) {
	let x = 0;
	let y = 0;
	for (const index of piece.pixels) {
		x += index % FLAT;
		y += Math.floor(index / FLAT);
	}
	const column = Math.floor(x / piece.pixels.length / CELL);
	const row = Math.floor(y / piece.pixels.length / CELL);
	return row * 9 + column;
}

/** A piece that runs across cells, cut where it crosses a line. */
function cutAtLines(piece: InkPiece): InkPiece[] {
	if (widthOf(piece) <= MAX_SPAN && heightOf(piece) <= MAX_SPAN) return [piece];
	const parts = new Map<number, number[]>();
	for (const index of piece.pixels) {
		const cell =
			Math.floor(index / FLAT / CELL) * 9 + Math.floor((index % FLAT) / CELL);
		const part = parts.get(cell);
		if (part) part.push(index);
		else parts.set(cell, [index]);
	}
	return [...parts.values()]
		.filter((pixels) => pixels.length >= MIN_PIXELS)
		.map(pieceOf);
}

/** What a cleared line left over: ink that stays near a line or is one. */
function isLeftover(piece: InkPiece) {
	let near = 0;
	for (const index of piece.pixels) {
		const x = (index % FLAT) % CELL;
		const y = Math.floor(index / FLAT) % CELL;
		const gap = Math.min(x, y, CELL - x, CELL - y);
		if (gap <= LINE_REACH) near += 1;
	}
	if (near >= piece.pixels.length * LEFTOVER_SHARE) return true;
	// A second frame beside the grid: taller than a digit, and as thin.
	return heightOf(piece) >= CELL * 0.92 && widthOf(piece) <= CELL * 0.15;
}

function gapBetween(a: InkPiece, b: InkPiece) {
	const x = Math.max(a.minX - b.maxX, b.minX - a.maxX, 0);
	const y = Math.max(a.minY - b.maxY, b.minY - a.maxY, 0);
	return Math.max(x, y);
}

/** A piece with the pieces that belong to the same digit. */
function withParts(main: InkPiece, all: InkPiece[]): InkPiece {
	let digit = main;
	if (Math.max(widthOf(main), heightOf(main)) < PART_SIZE) return main;
	let rest = all.filter(
		(piece) =>
			piece !== main && Math.max(widthOf(piece), heightOf(piece)) >= 10,
	);
	for (;;) {
		const near = rest.filter((piece) => gapBetween(digit, piece) <= PART_GAP);
		if (near.length === 0) return digit;
		rest = rest.filter((piece) => !near.includes(piece));
		digit = pieceOf([digit, ...near].flatMap((piece) => piece.pixels));
	}
}

function readCell(found: InkPiece[]): CellInk {
	const rest = found.filter((piece) => !isLeftover(piece));
	rest.sort((a, b) => b.pixels.length - a.pixels.length);
	const main = rest[0];
	if (!main) return { kind: "empty" };
	const digit = withParts(main, rest);
	if (heightOf(digit) >= DIGIT_HEIGHT && widthOf(digit) >= DIGIT_WIDTH) {
		return { kind: "digit", ink: digit };
	}
	const marks = rest.filter(
		(piece) =>
			piece.pixels.length >= MIN_MARK_PIXELS && heightOf(piece) >= MARK_HEIGHT,
	);
	if (marks.length === 0) return { kind: "empty" };
	return { kind: "notes", marks: marks.slice(0, MAX_MARKS) };
}

/** What each of the 81 cells of a flattened grid holds. */
export function gridInk(dark: Float32Array): CellInk[] {
	const thresholds = inkThresholds(dark);
	const ink = new Uint8Array(dark.length);
	for (let index = 0; index < ink.length; index += 1) {
		const cell =
			Math.floor(index / FLAT / CELL) * 9 + Math.floor((index % FLAT) / CELL);
		ink[index] = dark[index] >= thresholds[cell] ? 1 : 0;
	}
	for (let line = 0; line <= 9; line += 1) {
		for (let band = 0; band < 9; band += 1) {
			clearLine(ink, dark, true, line, band * CELL);
			clearLine(ink, dark, false, line, band * CELL);
		}
	}
	const perCell: InkPiece[][] = Array.from({ length: 81 }, () => []);
	for (const piece of pieces(ink).flatMap(cutAtLines)) {
		perCell[cellOf(piece)].push(piece);
	}
	return perCell.map((found) => readCell(found));
}

/** How dark a piece's ink is on average, 0 to 1. */
export function inkDarkness(piece: InkPiece, dark: Float32Array) {
	let sum = 0;
	for (const index of piece.pixels) sum += dark[index];
	return sum / piece.pixels.length;
}

/** A piece's box in the image the grid was flattened from. */
export function imageBox(
	piece: InkPiece,
	{ mapX, mapY }: { mapX: Float32Array; mapY: Float32Array },
	margin: number,
): InkBox {
	let minX = Number.POSITIVE_INFINITY;
	let minY = Number.POSITIVE_INFINITY;
	let maxX = 0;
	let maxY = 0;
	for (const index of piece.pixels) {
		minX = Math.min(minX, mapX[index]);
		maxX = Math.max(maxX, mapX[index]);
		minY = Math.min(minY, mapY[index]);
		maxY = Math.max(maxY, mapY[index]);
	}
	return {
		x: Math.round(minX) - margin,
		y: Math.round(minY) - margin,
		width: Math.round(maxX) - Math.round(minX) + 1 + margin * 2,
		height: Math.round(maxY) - Math.round(minY) + 1 + margin * 2,
	};
}

/** The classifier's input is this many pixels square. */
export const GLYPH = 28;
/** The glyph fills this much of it. */
const GLYPH_BODY = 22;

/** A piece of ink scaled into the classifier's input, 0 paper to 1 ink. */
export function glyphImage(piece: InkPiece): Float32Array {
	const width = widthOf(piece);
	const height = heightOf(piece);
	const scale = GLYPH_BODY / Math.max(width, height);
	const left = (GLYPH - width * scale) / 2;
	const top = (GLYPH - height * scale) / 2;
	const image = new Float32Array(GLYPH * GLYPH);
	// Every ink pixel spreads its area over the input pixels it covers.
	for (const index of piece.pixels) {
		const x0 = left + ((index % FLAT) - piece.minX) * scale;
		const y0 = top + (Math.floor(index / FLAT) - piece.minY) * scale;
		const x1 = x0 + scale;
		const y1 = y0 + scale;
		for (let y = Math.floor(y0); y < y1; y += 1) {
			for (let x = Math.floor(x0); x < x1; x += 1) {
				if (x < 0 || y < 0 || x >= GLYPH || y >= GLYPH) continue;
				image[y * GLYPH + x] +=
					(Math.min(x1, x + 1) - Math.max(x0, x)) *
					(Math.min(y1, y + 1) - Math.max(y0, y));
			}
		}
	}
	for (let i = 0; i < image.length; i += 1) image[i] = Math.min(1, image[i]);
	return image;
}
