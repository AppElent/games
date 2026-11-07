/** What every grid puzzle shares: difficulty levels, clue removal and the digit-string format. */
export const PUZZLE_DIFFICULTIES = [
	"easy",
	"medium",
	"hard",
	"expert",
] as const;
export type PuzzleDifficulty = (typeof PUZZLE_DIFFICULTIES)[number];

/**
 * Grids travel and persist as one digit per cell. Callers that accept outside
 * input validate the text first; this only converts.
 */
export function digitsToString(grid: readonly number[]) {
	return grid.join("");
}

export function digitsFromString(text: string): number[] {
	return [...text].map(Number);
}

/**
 * Empties cells of `grid` in `order` until `target` clues are left, restoring
 * any cell whose removal makes `isUnique` fail. Returns a new grid.
 */
export function removeClues(
	grid: readonly number[],
	order: readonly number[],
	target: number,
	isUnique: (givens: number[]) => boolean,
) {
	const givens = [...grid];
	let clueCount = givens.filter((value) => value !== 0).length;
	for (const cell of order) {
		if (clueCount <= target) {
			break;
		}
		const saved = givens[cell];
		if (saved === 0) {
			continue;
		}
		givens[cell] = 0;
		if (isUnique(givens)) {
			clueCount -= 1;
		} else {
			givens[cell] = saved;
		}
	}
	return { givens, clueCount };
}
