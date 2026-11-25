/**
 * Which of a grid's digits are printed. The digit network judges each by its
 * shape; a grid's printed digits are also one size and one ink.
 */
export type DigitLook = {
	/** The network's score: above 0 for print. */
	score: number;
	/** The ink's height in flat pixels. */
	height: number;
	/** The ink's mean darkness, 0 to 1. */
	darkness: number;
};

/** The score that makes a digit certainly printed (80%). */
const SURE_PRINT = 1.4;
/** Certain digits it takes to know the size and ink of the grid's print. */
const ENOUGH_PRINT = 4;
/** The score that makes a digit certainly handwritten (8%). */
const SURE_HANDWRITING = -2.5;
/** How near the print's height, as a share of it, a digit of its size is. */
const SAME_HEIGHT = 0.06;
const HEIGHT_BONUS = 1.5;
const HEIGHT_PENALTY = 1;
/** How near the print's darkness a digit in its ink is. */
const SAME_DARKNESS = 0.08;
const DARKNESS_WEIGHT = 1;

const median = (values: number[]) =>
	[...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

export function arePrinted(digits: readonly DigitLook[]): boolean[] {
	const print = digits.filter(({ score }) => score > SURE_PRINT);
	let scores = digits.map(({ score }) => score);
	if (print.length >= ENOUGH_PRINT) {
		const height = median(print.map((digit) => digit.height));
		const ink = median(print.map((digit) => digit.darkness));
		scores = digits.map(
			(digit) =>
				digit.score +
				(Math.abs(digit.height - height) <= SAME_HEIGHT * height
					? HEIGHT_BONUS
					: -HEIGHT_PENALTY) +
				(Math.abs(digit.darkness - ink) <= SAME_DARKNESS
					? DARKNESS_WEIGHT
					: -DARKNESS_WEIGHT),
		);
	}
	// A clean print has no handwriting; one odd-looking digit is still print.
	const written = scores.some((score) => score < SURE_HANDWRITING);
	return scores.map((score) => !written || score > 0);
}
