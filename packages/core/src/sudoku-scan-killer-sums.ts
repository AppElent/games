/**
 * A Killer's cage sums read by a digit reader that knows 1 to 9 only, as the
 * phone's Apple Vision reader does: each digit of a sum is cut out and read on
 * its own, and a 0 (10, 20, 30, 40) is told by its shape, a ring around one
 * tall hole, which no other digit has.
 */
import {
	type CageRead,
	cageSumInk,
	cagesFromBorders,
	edgeBetween,
	edgeKey,
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
 * reaches from the digit's top third to its bottom third. A 6, 8 or 9 has
 * its holes in one half; a 4's is small.
 */
export function looksLikeZero(sum: SumInk, digit: InkBox) {
	const { width, height } = digit;
	if (width < 3 || height < 5) {
		return false;
	}
	// The ink as found, not grown: growing it closes a small 0's hole.
	const ink = (x: number, y: number) =>
		sum.ink[(digit.y + y) * sum.box.width + digit.x + x] === 1;
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
	// A 0's hole runs from its top third to its bottom third; a 4's closed
	// counter or a 6's or 9's bowl keeps to one half.
	const [hole] = holes;
	return (
		hole.bottom - hole.top + 1 >= height * 0.5 &&
		hole.top <= height * 0.3 &&
		hole.bottom >= height * 0.7
	);
}

/** How far a digit's box reaches past its ink, so a reader sees its edges. */
const DIGIT_PAD = 2;

/** A read this sure counts; below it the digit is left for the player. */
const DIGIT_SURE = 0.3;

/** A read less sure than this is read again, and its sum marked unsure. */
const READ_AGAIN = 0.8;

/**
 * A sum's digits are about one height: ink much taller, shorter or wider
 * than the grid's usual sum digit is a handwritten digit or a scribble in
 * the corner, not a sum.
 */
const SUM_HEIGHT = { low: 0.7, high: 1.35 };
const SUM_WIDTH = 1.25;

/** What `readKillerSums` read. */
export type KillerSumsRead = {
	/**
	 * The cages, with a cage that has no sum of its own joined to the
	 * neighbour across its weakest unsure line: every Killer cage prints a sum.
	 */
	read: CageRead;
	/** Per cage of `read`, its sum, or null where none could be read. */
	sums: (number | null)[];
	/** Per cage of `read`, whether its sum was read with doubt. */
	unsure: boolean[];
};

/** The sum ink of each cage, or null where its corner holds none. */
function sumInks(rgba: ArrayLike<number>, size: number, read: CageRead) {
	return read.cages.map(
		(cage) =>
			cageSumInk(rgba, size, cage, read.bounds, { ignoreBlue: true }) ??
			cageSumInk(rgba, size, cage, read.bounds, { ignoreBlue: false }),
	);
}

/** Drops ink unlike the grid's usual sum digit: see `SUM_HEIGHT`. */
function sumSized(inks: (SumInk | null)[]): (SumInk | null)[] {
	const heights = inks
		.flatMap((ink) => ink?.digits ?? [])
		.map((digit) => digit.height)
		.sort((a, b) => a - b);
	if (heights.length === 0) {
		return inks;
	}
	const usual = heights[Math.floor(heights.length / 2)];
	return inks.map((ink) =>
		ink?.digits.every(
			(digit) =>
				digit.height >= usual * SUM_HEIGHT.low &&
				digit.height <= usual * SUM_HEIGHT.high &&
				digit.width <= usual * SUM_WIDTH,
		)
			? ink
			: null,
	);
}

/**
 * Joins each cage without a sum to a neighbour across its weakest unsure
 * line: a stray mark can pass for a dashed line, but never prints a sum. A
 * line the read was sure of stays, and so does a join past nine cells.
 */
function joinCagesWithoutSums(
	read: CageRead,
	hasSum: boolean[],
): CageRead | null {
	const { scores } = read;
	if (!scores) {
		return null;
	}
	const doubtful = new Set(read.doubtful.map(edgeKey));
	const cageOf = new Array<number>(81);
	read.cages.forEach((cells, index) => {
		for (const cell of cells) cageOf[cell] = index;
	});
	const removed = new Set<string>();
	read.cages.forEach((cells, index) => {
		if (hasSum[index]) {
			return;
		}
		let weakest: { key: string; score: number } | null = null;
		for (const cell of cells) {
			for (const other of [cell - 9, cell - 1, cell + 1, cell + 9]) {
				const edge = other >= 0 && other < 81 ? edgeBetween(cell, other) : null;
				if (!edge || cageOf[other] === index) continue;
				const key = edgeKey(edge);
				const size = cells.length + read.cages[cageOf[other]].length;
				if (
					doubtful.has(key) &&
					size <= 9 &&
					(!weakest || scores[key] < weakest.score)
				) {
					weakest = { key, score: scores[key] };
				}
			}
		}
		if (weakest) removed.add(weakest.key);
	});
	if (removed.size === 0) {
		return null;
	}
	const borders = read.borders.filter((edge) => !removed.has(edgeKey(edge)));
	const kept = new Set(borders.map(edgeKey));
	return {
		...read,
		borders,
		cages: cagesFromBorders((edge) => kept.has(edgeKey(edge))),
	};
}

/**
 * Reads every box, and the boxes read with doubt once more. Vision reads a
 * box better or worse by what else is in its request, so a doubtful box is
 * read again among boxes it read surely.
 */
async function readWithSecondLook(
	boxes: InkBox[],
	readDigits: BoxDigitReader,
): Promise<{ reads: DigitRead[]; disagree: Set<number> }> {
	const read = async (asked: InkBox[]) => {
		const reads = asked.length > 0 ? await readDigits(asked) : [];
		if (reads.length !== asked.length) {
			throw new Error("The reader answered for a different number of boxes");
		}
		return reads;
	};
	const reads = await read(boxes);
	const disagree = new Set<number>();
	const weak = boxes.flatMap((_, i) =>
		reads[i].confidence < READ_AGAIN ? [i] : [],
	);
	const sure = boxes.flatMap((_, i) =>
		reads[i].confidence >= READ_AGAIN ? [i] : [],
	);
	// Without a sure box the same request would only get the same answer.
	if (weak.length === 0 || sure.length === 0) {
		return { reads, disagree };
	}
	const order = weak.flatMap((index, k) => [index, sure[k % sure.length]]);
	const again = await read(order.map((index) => boxes[index]));
	weak.forEach((index, k) => {
		const second = again[k * 2];
		const first = reads[index];
		if (first.digit >= 1 && second.digit >= 1 && first.digit !== second.digit) {
			disagree.add(index);
		}
		if (second.confidence > first.confidence) {
			reads[index] = second;
		}
	});
	return { reads, disagree };
}

/** Whether `cells` distinct digits 1-9 can add up to `sum`. */
function sumFits(sum: number, cells: number) {
	const least = (cells * (cells + 1)) / 2;
	const most = (cells * (19 - cells)) / 2;
	return sum >= least && sum <= most;
}

/**
 * The sum printed in each cage, or null where none could be read: the
 * player types those on the check screen.
 */
export async function readKillerSums(
	rgba: ArrayLike<number>,
	size: number,
	cageRead: CageRead,
	readDigits: BoxDigitReader,
): Promise<KillerSumsRead> {
	let read = cageRead;
	let inks = sumSized(sumInks(rgba, size, read));
	const joined = joinCagesWithoutSums(
		read,
		inks.map((ink) => ink !== null),
	);
	if (joined) {
		read = joined;
		inks = sumSized(sumInks(rgba, size, read));
	}
	// Every digit that is not a 0 goes to the reader in one batch.
	const boxes: InkBox[] = [];
	const plans = inks.map((sum) =>
		sum
			? sum.digits.map((digit, position) => {
					// A sum never starts with 0 (10, 20, 30 and 40 end with one).
					if (position > 0 && looksLikeZero(sum, digit)) {
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
	const { reads, disagree } = await readWithSecondLook(boxes, readDigits);
	const unsure = read.cages.map(() => false);
	const sums = inks.map((sum, index) => {
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
			if (digit.confidence < READ_AGAIN || disagree.has(entry)) {
				unsure[index] = true;
			}
			text += String(digit.digit);
		}
		const value = parseCageSum(text);
		// A sum its cells cannot make is a misread: a digit was lost.
		return value !== null && sumFits(value, read.cages[index].length)
			? value
			: null;
	});
	return {
		read,
		sums,
		unsure: unsure.map((doubt, index) => doubt && sums[index] !== null),
	};
}
