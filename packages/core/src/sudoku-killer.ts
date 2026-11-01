import {
	colOf,
	digitMask,
	digitsInMask,
	FULL_MASK,
	findConflicts,
	generateSolvedGrid,
	maskSize,
	rowOf,
	SUDOKU_CELL_COUNT,
	SUDOKU_PEERS,
	type SudokuDifficulty,
	type SudokuGrid,
	type SudokuRng,
} from "./sudoku";

/** A killer cage: contiguous cells whose digits are distinct and sum to `sum`. */
export type KillerCage = { sum: number; cells: number[] };

/** Givens left on the board per difficulty — cages carry most of the work. */
const KILLER_CLUE_TARGETS: Record<SudokuDifficulty, number> = {
	easy: 22,
	medium: 14,
	hard: 6,
	expert: 0,
};

function orthogonalNeighbors(cell: number): number[] {
	const row = rowOf(cell);
	const col = colOf(cell);
	const neighbors: number[] = [];
	if (row > 0) neighbors.push(cell - 9);
	if (row < 8) neighbors.push(cell + 9);
	if (col > 0) neighbors.push(cell - 1);
	if (col < 8) neighbors.push(cell + 1);
	return neighbors;
}

function shuffled<T>(items: readonly T[], rng: SudokuRng) {
	const copy = [...items];
	for (let i = copy.length - 1; i > 0; i -= 1) {
		const j = Math.floor(rng() * (i + 1));
		[copy[i], copy[j]] = [copy[j], copy[i]];
	}
	return copy;
}

/** Weighted cage size: mostly 2-3 cells, occasionally larger. */
function pickCageSize(rng: SudokuRng) {
	const roll = rng();
	if (roll < 0.32) return 2;
	if (roll < 0.68) return 3;
	if (roll < 0.9) return 4;
	return 5;
}

/**
 * Partition the board into contiguous cages over a solved grid. Every cage
 * has distinct digits (required for the sums to be a valid killer clue set).
 */
export function generateKillerCages(
	solution: SudokuGrid,
	rng: SudokuRng = Math.random,
): KillerCage[] {
	const cageIndex = new Array<number>(SUDOKU_CELL_COUNT).fill(-1);
	const cages: number[][] = [];
	for (const start of shuffled(
		Array.from({ length: SUDOKU_CELL_COUNT }, (_, i) => i),
		rng,
	)) {
		if (cageIndex[start] !== -1) {
			continue;
		}
		const index = cages.length;
		const cells = [start];
		const digits = new Set([solution[start]]);
		cageIndex[start] = index;
		const target = pickCageSize(rng);
		while (cells.length < target) {
			const frontier: number[] = [];
			for (const cell of cells) {
				for (const neighbor of orthogonalNeighbors(cell)) {
					if (
						cageIndex[neighbor] === -1 &&
						!digits.has(solution[neighbor]) &&
						!frontier.includes(neighbor)
					) {
						frontier.push(neighbor);
					}
				}
			}
			if (frontier.length === 0) {
				break;
			}
			const next = frontier[Math.floor(rng() * frontier.length)];
			cageIndex[next] = index;
			cells.push(next);
			digits.add(solution[next]);
		}
		cages.push(cells);
	}
	return cages.map((cells) => ({
		sum: cells.reduce((total, cell) => total + solution[cell], 0),
		cells: [...cells].sort((a, b) => a - b),
	}));
}

/** Minimum sum of `count` distinct digits 1-9. */
function minDistinctSum(count: number) {
	return (count * (count + 1)) / 2;
}

/** Maximum sum of `count` distinct digits 1-9. */
function maxDistinctSum(count: number) {
	return (count * (19 - count)) / 2;
}

type CageLookup = {
	/** Cage index per cell, -1 when uncaged. */
	byCell: Int8Array;
	cages: KillerCage[];
};

function buildCageLookup(cages: KillerCage[]): CageLookup {
	const byCell = new Int8Array(SUDOKU_CELL_COUNT).fill(-1);
	cages.forEach((cage, index) => {
		for (const cell of cage.cells) {
			byCell[cell] = index;
		}
	});
	return { byCell, cages };
}

function cageAllowsDigit(
	grid: SudokuGrid,
	lookup: CageLookup,
	cell: number,
	digit: number,
) {
	const index = lookup.byCell[cell];
	if (index === -1) {
		return true;
	}
	const cage = lookup.cages[index];
	let usedSum = 0;
	let emptyCount = 0;
	for (const other of cage.cells) {
		if (other === cell) {
			continue;
		}
		const value = grid[other];
		if (value === 0) {
			emptyCount += 1;
		} else {
			if (value === digit) {
				return false;
			}
			usedSum += value;
		}
	}
	const remaining = cage.sum - usedSum - digit;
	if (emptyCount === 0) {
		return remaining === 0;
	}
	return (
		remaining >= minDistinctSum(emptyCount) &&
		remaining <= maxDistinctSum(emptyCount)
	);
}

function killerCandidates(grid: SudokuGrid, lookup: CageLookup): number[] {
	const candidates = new Array<number>(SUDOKU_CELL_COUNT).fill(0);
	for (let cell = 0; cell < SUDOKU_CELL_COUNT; cell += 1) {
		if (grid[cell] !== 0) {
			continue;
		}
		let mask = FULL_MASK;
		for (const peer of SUDOKU_PEERS[cell]) {
			const value = grid[peer];
			if (value !== 0) {
				mask &= ~digitMask(value);
			}
		}
		for (const digit of digitsInMask(mask)) {
			if (!cageAllowsDigit(grid, lookup, cell, digit)) {
				mask &= ~digitMask(digit);
			}
		}
		candidates[cell] = mask;
	}
	return candidates;
}

function killerSearch(
	grid: SudokuGrid,
	lookup: CageLookup,
	limit: number,
	found: { count: number },
) {
	const candidates = killerCandidates(grid, lookup);
	let best = -1;
	let bestSize = 10;
	for (let cell = 0; cell < SUDOKU_CELL_COUNT; cell += 1) {
		if (grid[cell] !== 0) {
			continue;
		}
		const size = maskSize(candidates[cell]);
		if (size === 0) {
			return;
		}
		if (size < bestSize) {
			best = cell;
			bestSize = size;
			if (size === 1) {
				break;
			}
		}
	}
	if (best === -1) {
		found.count += 1;
		return;
	}
	for (const digit of digitsInMask(candidates[best])) {
		grid[best] = digit;
		killerSearch(grid, lookup, limit, found);
		grid[best] = 0;
		if (found.count >= limit) {
			return;
		}
	}
}

export function countKillerSolutions(
	grid: SudokuGrid,
	cages: KillerCage[],
	limit = 2,
) {
	if (findConflicts(grid).size > 0) {
		return 0;
	}
	const found = { count: 0 };
	killerSearch([...grid], buildCageLookup(cages), limit, found);
	return found.count;
}

export type GeneratedKillerPuzzle = {
	givens: SudokuGrid;
	solution: SudokuGrid;
	cages: KillerCage[];
	difficulty: SudokuDifficulty;
	clueCount: number;
};

export function generateKillerPuzzle(
	difficulty: SudokuDifficulty,
	rng: SudokuRng = Math.random,
): GeneratedKillerPuzzle {
	const solution = generateSolvedGrid(rng);
	const cages = generateKillerCages(solution, rng);
	const givens = [...solution];
	const target = KILLER_CLUE_TARGETS[difficulty];
	let clueCount = SUDOKU_CELL_COUNT;
	for (const cell of shuffled(
		Array.from({ length: SUDOKU_CELL_COUNT }, (_, i) => i),
		rng,
	)) {
		if (clueCount <= target) {
			break;
		}
		const saved = givens[cell];
		if (saved === 0) {
			continue;
		}
		givens[cell] = 0;
		if (countKillerSolutions(givens, cages, 2) === 1) {
			clueCount -= 1;
		} else {
			givens[cell] = saved;
		}
	}
	return { givens, solution, cages, difficulty, clueCount };
}

/**
 * Cage-rule violations for the current grid: duplicated digits inside a
 * cage, a filled cage with the wrong sum, or a partial cage already over
 * its sum. Returned cells are rendered as conflicts.
 */
export function findKillerConflicts(
	grid: SudokuGrid,
	cages: KillerCage[],
): Set<number> {
	const conflicts = new Set<number>();
	for (const cage of cages) {
		const seen = new Map<number, number>();
		let sum = 0;
		let filled = 0;
		for (const cell of cage.cells) {
			const value = grid[cell];
			if (value === 0) {
				continue;
			}
			filled += 1;
			sum += value;
			const previous = seen.get(value);
			if (previous !== undefined) {
				conflicts.add(previous);
				conflicts.add(cell);
			} else {
				seen.set(value, cell);
			}
		}
		const complete = filled === cage.cells.length;
		if ((complete && sum !== cage.sum) || (!complete && sum >= cage.sum)) {
			for (const cell of cage.cells) {
				if (grid[cell] !== 0) {
					conflicts.add(cell);
				}
			}
		}
	}
	return conflicts;
}

/** True when the cages cover all 81 cells exactly once with plausible sums. */
export function validateKillerCages(cages: KillerCage[]): boolean {
	const seen = new Set<number>();
	for (const cage of cages) {
		if (cage.cells.length === 0 || cage.cells.length > 9) {
			return false;
		}
		if (
			cage.sum < minDistinctSum(cage.cells.length) ||
			cage.sum > maxDistinctSum(cage.cells.length)
		) {
			return false;
		}
		for (const cell of cage.cells) {
			if (
				!Number.isInteger(cell) ||
				cell < 0 ||
				cell >= SUDOKU_CELL_COUNT ||
				seen.has(cell)
			) {
				return false;
			}
			seen.add(cell);
		}
	}
	return seen.size === SUDOKU_CELL_COUNT;
}

export function isKillerSolved(grid: SudokuGrid, cages: KillerCage[]) {
	return (
		grid.every((value) => value !== 0) &&
		findConflicts(grid).size === 0 &&
		findKillerConflicts(grid, cages).size === 0
	);
}
