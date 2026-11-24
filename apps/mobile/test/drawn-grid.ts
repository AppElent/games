/** Grid images for the sudoku scan's tests, drawn pixel by pixel. */
import type { Point } from "@arcadeclub/core/sudoku-scan-ink";

const PAPER = 225;
const INK = 40;

type Stroke = [number, number][];

/** Digits as pen strokes in a unit box. */
const STROKES: Record<number, Stroke[]> = {
	1: [
		[
			[0.5, 0],
			[0.5, 1],
		],
	],
	2: [
		[
			[0, 0.25],
			[0.25, 0],
			[0.75, 0],
			[1, 0.25],
			[0, 1],
			[1, 1],
		],
	],
	4: [
		[
			[0.75, 1],
			[0.75, 0],
			[0, 0.65],
			[1, 0.65],
		],
	],
	7: [
		[
			[0, 0],
			[1, 0],
			[0.4, 1],
		],
	],
};

/** Puts ink along the straight line between two points. */
function drawLine(
	gray: Uint8Array,
	size: number,
	from: Point,
	to: Point,
	thickness: number,
) {
	const steps = Math.ceil(Math.hypot(to.x - from.x, to.y - from.y)) * 2;
	for (let i = 0; i <= steps; i += 1) {
		const x = from.x + ((to.x - from.x) * i) / steps;
		const y = from.y + ((to.y - from.y) * i) / steps;
		for (let dy = -thickness; dy <= thickness; dy += 1) {
			for (let dx = -thickness; dx <= thickness; dx += 1) {
				const px = Math.round(x + dx);
				const py = Math.round(y + dy);
				if (px >= 0 && py >= 0 && px < size && py < size) {
					gray[py * size + px] = INK;
				}
			}
		}
	}
}

export type DrawnDigit = {
	row: number;
	column: number;
	digit: number;
	/** The digit's height in cells; 0.6 unless given. */
	height?: number;
	/** How far right of its cell's middle it stands, in cells. */
	right?: number;
};

/**
 * A grid image with `margin` cells of paper around the grid and its lines
 * bent by `bend` pixels, as a curled page's are.
 */
export function drawGrid({
	size = 900,
	margin = 0,
	bend = 0,
	digits = [] as DrawnDigit[],
	lines = true,
}) {
	const cell = size / (9 + margin * 2);
	// The image point at (u, v), in cells from the grid's corner.
	const at = (u: number, v: number): Point => ({
		x: (margin + u) * cell,
		y: (margin + v) * cell - bend * Math.sin((Math.PI * u) / 9),
	});
	const gray = new Uint8Array(size * size).fill(PAPER);
	const line = (stroke: Point[], thickness: number) => {
		for (let i = 1; i < stroke.length; i += 1) {
			drawLine(gray, size, stroke[i - 1], stroke[i], thickness);
		}
	};
	if (lines) {
		const steps = Array.from({ length: 37 }, (_, i) => i / 4);
		for (let i = 0; i <= 9; i += 1) {
			const thickness = i % 3 === 0 ? 2 : 1;
			line(
				steps.map((step) => at(i, step)),
				thickness,
			);
			line(
				steps.map((step) => at(step, i)),
				thickness,
			);
		}
	}
	for (const { row, column, digit, height = 0.6, right = 0 } of digits) {
		for (const stroke of STROKES[digit]) {
			line(
				stroke.map(([x, y]) =>
					at(
						column + 0.5 + right + (x - 0.5) * height * 0.6,
						row + 0.5 + (y - 0.5) * height,
					),
				),
				2,
			);
		}
	}
	return { gray, size, at };
}
