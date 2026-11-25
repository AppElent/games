/**
 * Synthetic Killer photos for tests: a straightened grid with dashed cages,
 * optional pen strokes, and blocky printed digits for the cage sums.
 */
import type { Rng } from "../random";

export const SIZE = 900;
export const CELL = SIZE / 9;
type Rgb = [number, number, number];

const PAPER: Rgb = [244, 238, 222];
export const PRINT: Rgb = [40, 40, 48];
export const BLUE_PRINT: Rgb = [40, 70, 150];
const BLUE_PEN: Rgb = [30, 50, 160];

/**
 * Draws a printed Killer as a straightened photo would show it: a grid with
 * thick box lines, and each cage outlined by dashes 8 px inside its cells.
 */
export function renderKiller(
	cages: number[][],
	{
		dashColor = PRINT,
		rng,
		penStrokes = 0,
	}: { dashColor?: Rgb; rng: Rng; penStrokes?: number },
) {
	const rgba = new Uint8ClampedArray(SIZE * SIZE * 4);
	const paint = (x: number, y: number, [r, g, b]: Rgb) => {
		if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) {
			return;
		}
		const i = (Math.round(y) * SIZE + Math.round(x)) * 4;
		rgba[i] = r;
		rgba[i + 1] = g;
		rgba[i + 2] = b;
	};
	for (let y = 0; y < SIZE; y += 1) {
		for (let x = 0; x < SIZE; x += 1) {
			const noise = Math.round((rng() - 0.5) * 16);
			const i = (y * SIZE + x) * 4;
			rgba[i] = PAPER[0] + noise;
			rgba[i + 1] = PAPER[1] + noise;
			rgba[i + 2] = PAPER[2] + noise;
			rgba[i + 3] = 255;
		}
	}
	for (let k = 0; k <= 9; k += 1) {
		const width = k % 3 === 0 ? 4 : 2;
		for (let w = -width / 2; w < width / 2; w += 1) {
			for (let t = 0; t < SIZE; t += 1) {
				paint(k * CELL + w, t, PRINT);
				paint(t, k * CELL + w, PRINT);
			}
		}
	}
	const cageOf = new Array<number>(81);
	cages.forEach((cage, index) => {
		for (const cell of cage) {
			cageOf[cell] = index;
		}
	});
	const inset = 8;
	const dashed = (from: number, to: number, draw: (t: number) => void) => {
		for (let t = from; t < to; t += 1) {
			if ((t - from) % 7 < 4) {
				draw(t);
			}
		}
	};
	for (let cell = 0; cell < 81; cell += 1) {
		const x0 = (cell % 9) * CELL;
		const y0 = Math.floor(cell / 9) * CELL;
		const row = Math.floor(cell / 9);
		const col = cell % 9;
		const differs = (other: number | null) =>
			other === null || cageOf[other] !== cageOf[cell];
		const sides = {
			top: differs(row > 0 ? cell - 9 : null),
			bottom: differs(row < 8 ? cell + 9 : null),
			left: differs(col > 0 ? cell - 1 : null),
			right: differs(col < 8 ? cell + 1 : null),
		};
		const a = inset;
		const b = CELL - inset;
		if (sides.top) dashed(a, b, (t) => paint(x0 + t, y0 + a, dashColor));
		if (sides.bottom) dashed(a, b, (t) => paint(x0 + t, y0 + b, dashColor));
		if (sides.left) dashed(a, b, (t) => paint(x0 + a, y0 + t, dashColor));
		if (sides.right) dashed(a, b, (t) => paint(x0 + b, y0 + t, dashColor));
	}
	// Handwriting: digit-sized blue strokes, some reaching the cage lines.
	for (let s = 0; s < penStrokes; s += 1) {
		const cell = Math.floor(rng() * 81);
		const cx = (cell % 9) * CELL + CELL / 2 + (rng() - 0.5) * 50;
		const cy = Math.floor(cell / 9) * CELL + CELL / 2 + (rng() - 0.5) * 50;
		const angle = rng() * Math.PI;
		for (let t = -16; t < 16; t += 0.5) {
			for (let w = -1.5; w <= 1.5; w += 0.5) {
				paint(
					cx + Math.cos(angle) * t - Math.sin(angle) * w,
					cy + Math.sin(angle) * t + Math.cos(angle) * w,
					BLUE_PEN,
				);
			}
		}
	}
	return rgba;
}

/** Paints a blocky digit: a 3 px ring, 12 x 22 px, its top-left at (x, y). */
export function paintGlyph(rgba: Uint8ClampedArray, x: number, y: number) {
	for (let dy = 0; dy < 22; dy += 1) {
		for (let dx = 0; dx < 12; dx += 1) {
			if (dx < 3 || dx >= 9 || dy < 3 || dy >= 19) {
				const i = ((y + dy) * SIZE + x + dx) * 4;
				rgba[i] = PRINT[0];
				rgba[i + 1] = PRINT[1];
				rgba[i + 2] = PRINT[2];
			}
		}
	}
}
