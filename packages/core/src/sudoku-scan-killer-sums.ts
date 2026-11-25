/**
 * A Killer's cage sums read by a digit reader that knows 1 to 9 only, as the
 * phone's Apple Vision reader does: each digit of a sum is cut out and read on
 * its own, and a 0 (10, 20, 30, 40) is told by its shape, a ring around one
 * tall hole, which no other digit has.
 */
import {
	type CageRead,
	cageSumInk,
	parseCageSum,
	type SumInk,
} from "./sudoku-scan-cages";
import type { DigitRead, InkBox } from "./sudoku-scan-ink";

/** Reads one digit (1-9) per box of the warped grid, in order. */
export type BoxDigitReader = (boxes: InkBox[]) => Promise<DigitRead[]>;

/** Gray pixels (one per pixel) as RGBA, for the readers that take colour. */
export function grayToRgba(gray: ArrayLike<number>): Uint8ClampedArray {
	const rgba = new Uint8ClampedArray(gray.length * 4);
	for (let i = 0; i < gray.length; i += 1) {
		rgba[i * 4] = gray[i];
		rgba[i * 4 + 1] = gray[i];
		rgba[i * 4 + 2] = gray[i];
		rgba[i * 4 + 3] = 255;
	}
	return rgba;
}

/**
 * Whether a cut-out digit is a 0: its paper holds one enclosed hole that
 * runs at least half the digit's height. A 6, 8 or 9 has its holes in one
 * half; a 4's is small.
 */
export function looksLikeZero(sum: SumInk, digit: InkBox) {
	const { width, height } = digit;
	if (width < 3 || height < 5) {
		return false;
	}
	const ink = (x: number, y: number) =>
		sum.mask[(digit.y + y) * sum.box.width + digit.x + x] === 1;
	// Paper reached from the digit's edge is outside; what is left is a hole.
	const outside = new Uint8Array(width * height);
	const stack: number[] = [];
	const visit = (x: number, y: number) => {
		const index = y * width + x;
		if (!outside[index] && !ink(x, y)) {
			outside[index] = 1;
			stack.push(index);
		}
	};
	for (let x = 0; x < width; x += 1) {
		visit(x, 0);
		visit(x, height - 1);
	}
	for (let y = 0; y < height; y += 1) {
		visit(0, y);
		visit(width - 1, y);
	}
	while (stack.length > 0) {
		const index = stack.pop() as number;
		const x = index % width;
		const y = Math.floor(index / width);
		if (x > 0) visit(x - 1, y);
		if (x < width - 1) visit(x + 1, y);
		if (y > 0) visit(x, y - 1);
		if (y < height - 1) visit(x, y + 1);
	}
	// The holes, each as the rows and columns it spans.
	const seen = new Uint8Array(width * height);
	const holes: { top: number; bottom: number; left: number; right: number }[] =
		[];
	for (let start = 0; start < width * height; start += 1) {
		const x0 = start % width;
		const y0 = Math.floor(start / width);
		if (seen[start] || outside[start] || ink(x0, y0)) {
			continue;
		}
		const hole = { top: y0, bottom: y0, left: x0, right: x0 };
		seen[start] = 1;
		stack.push(start);
		while (stack.length > 0) {
			const index = stack.pop() as number;
			const x = index % width;
			const y = Math.floor(index / width);
			hole.top = Math.min(hole.top, y);
			hole.bottom = Math.max(hole.bottom, y);
			hole.left = Math.min(hole.left, x);
			hole.right = Math.max(hole.right, x);
			for (const [nx, ny] of [
				[x - 1, y],
				[x + 1, y],
				[x, y - 1],
				[x, y + 1],
			]) {
				const next = ny * width + nx;
				if (
					nx >= 0 &&
					ny >= 0 &&
					nx < width &&
					ny < height &&
					!seen[next] &&
					!outside[next] &&
					!ink(nx, ny)
				) {
					seen[next] = 1;
					stack.push(next);
				}
			}
		}
		holes.push(hole);
	}
	if (holes.length !== 1) {
		return false;
	}
	const [hole] = holes;
	return hole.bottom - hole.top + 1 >= height * 0.5;
}

/** How far a digit's box reaches past its ink, so a reader sees its edges. */
const DIGIT_PAD = 2;

/** A read this sure counts; below it the digit is left for the player. */
const DIGIT_SURE = 0.3;

/**
 * The sum printed in each cage, or null where none could be read: the
 * player types those on the check screen.
 */
export async function readKillerSums(
	rgba: ArrayLike<number>,
	size: number,
	read: CageRead,
	readDigits: BoxDigitReader,
): Promise<(number | null)[]> {
	const inks = read.cages.map(
		(cage) =>
			cageSumInk(rgba, size, cage, read.bounds, { ignoreBlue: true }) ??
			cageSumInk(rgba, size, cage, read.bounds, { ignoreBlue: false }),
	);
	// Every digit that is not a 0 goes to the reader in one batch.
	const boxes: InkBox[] = [];
	const plans = inks.map((sum) =>
		sum
			? sum.digits.map((digit) => {
					if (looksLikeZero(sum, digit)) {
						return "0";
					}
					const x = Math.max(0, sum.box.x + digit.x - DIGIT_PAD);
					const y = Math.max(0, sum.box.y + digit.y - DIGIT_PAD);
					boxes.push({
						x,
						y,
						width:
							Math.min(size, sum.box.x + digit.x + digit.width + DIGIT_PAD) - x,
						height:
							Math.min(size, sum.box.y + digit.y + digit.height + DIGIT_PAD) -
							y,
					});
					return boxes.length - 1;
				})
			: null,
	);
	const reads = boxes.length > 0 ? await readDigits(boxes) : [];
	return inks.map((sum, index) => {
		const plan = plans[index];
		if (!sum || !plan || plan.length === 0) {
			return null;
		}
		// Each digit is a 0 already, or the index of its read.
		let text = "";
		for (const entry of plan) {
			if (entry === "0") {
				text += "0";
				continue;
			}
			const digit = reads[entry];
			if (!digit || digit.digit < 1 || digit.confidence < DIGIT_SURE) {
				return null;
			}
			text += String(digit.digit);
		}
		return parseCageSum(text);
	});
}
