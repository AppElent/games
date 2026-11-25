/**
 * Which way up a scanned grid is. A photo taken sideways or upside down warps
 * to a grid turned by a quarter, a half or three quarters. Turning the
 * corners (top-left first, clockwise) by the same amount warps it upright, so
 * the scan reads the grid at each turn and keeps the one that looks printed
 * the right way up:
 *
 * - a Killer prints each cage's sum in the top-left corner of the cage's
 *   first cell, so the upright turn finds the most sums there;
 * - a classic grid's digits read with the most confidence upright.
 */
import type { DigitGuess } from "./sudoku-digit-net";
import { type CageRead, cageSumInk } from "./sudoku-scan-cages";
import type { GridFrame } from "./sudoku-scan-mesh";
import { readWarpedGrid } from "./sudoku-scan-read";

/**
 * The corners as seen from `turns` corners further along: warping them turns
 * the grid that many quarter turns.
 */
export function turnCorners<T>(corners: readonly T[], turns: number): T[] {
	const shift = ((turns % 4) + 4) % 4;
	return [...corners.slice(shift), ...corners.slice(0, shift)];
}

/**
 * The share of cages with sum-sized ink where an upright Killer prints the
 * sum: the top-left corner of the cage's first cell. The sum search reaches
 * well past that corner to allow for a curled page, and there a turned
 * grid's digits or sums count too; this score takes only ink that starts in
 * the corner itself.
 */
/**
 * Where an upright sum's box starts, in cells from its first cell's corner.
 * Measured on the bench's Killer photo: upright sums start 0.04-0.23 down,
 * while turned digits and sums mostly start lower, or a cell to the side.
 */
const SUM_CORNER = { left: -0.2, right: 0.35, top: -0.12, bottom: 0.25 };

export function killerSumScore(
	rgba: ArrayLike<number>,
	size: number,
	read: CageRead,
) {
	if (read.cages.length === 0) {
		return 0;
	}
	const cellWidth = (read.bounds.right - read.bounds.left) / 9;
	const cellHeight = (read.bounds.bottom - read.bounds.top) / 9;
	const hits = read.cages.filter((cage) => {
		const ink =
			cageSumInk(rgba, size, cage, read.bounds, { ignoreBlue: true }) ??
			cageSumInk(rgba, size, cage, read.bounds, { ignoreBlue: false });
		if (!ink) {
			return false;
		}
		const first = Math.min(...cage);
		const across = (ink.box.x - read.bounds.left) / cellWidth - (first % 9);
		const down =
			(ink.box.y - read.bounds.top) / cellHeight - Math.floor(first / 9);
		return (
			across >= SUM_CORNER.left &&
			across <= SUM_CORNER.right &&
			down >= SUM_CORNER.top &&
			down <= SUM_CORNER.bottom
		);
	}).length;
	return hits / read.cages.length;
}

/**
 * How sure the digit network is of the grid's digits, from 0 to 1: a turned
 * digit reads as junk or as a doubtful other digit.
 */
export function uprightDigitScore(guesses: readonly (DigitGuess | null)[]) {
	const digits = guesses.filter((guess): guess is DigitGuess => !!guess);
	if (digits.length === 0) {
		return 0;
	}
	const total = digits.reduce(
		(sum, guess) => sum + guess.confidence * (1 - guess.junk),
		0,
	);
	return total / digits.length;
}

/**
 * The network's guess for every single-digit cell of a warped grid, without
 * reading anything else.
 */
export async function gridDigitGuesses(
	grid: { pixels: ArrayLike<number>; size: number },
	margins: GridFrame["margins"],
) {
	const guesses: (DigitGuess | null)[] = [];
	await readWarpedGrid(grid, margins, async (glyphs) => {
		guesses.push(...glyphs.map((glyph) => glyph.guess));
		return glyphs.map(() => ({ digit: 0, confidence: 0 }));
	});
	return guesses;
}

export type TurnSearch = {
	/** A score at the photo's own turn this high needs no other turn. */
	enough: number;
	/** How much better another turn must score to win over the photo's own. */
	margin: number;
};

export const KILLER_TURNS: TurnSearch = { enough: 0.7, margin: 0.2 };
export const CLASSIC_TURNS: TurnSearch = { enough: 0.75, margin: 0.1 };

/**
 * The quarter turns (0-3) that make the grid upright. The photo as taken is
 * scored first, and kept when it scores `enough` or no other turn beats it
 * by `margin`.
 */
export async function findUprightTurns(
	scoreAt: (turns: number) => number | Promise<number>,
	{ enough, margin }: TurnSearch,
) {
	const asTaken = await scoreAt(0);
	if (asTaken >= enough) {
		return 0;
	}
	let best = 0;
	let bestScore = asTaken;
	for (let turns = 1; turns < 4; turns += 1) {
		const score = await scoreAt(turns);
		if (score > bestScore) {
			best = turns;
			bestScore = score;
		}
	}
	return bestScore - asTaken >= margin ? best : 0;
}
