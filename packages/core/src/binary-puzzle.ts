import { mulberry32, type SudokuRng } from "./sudoku";

/**
 * Binary puzzle (Binairo / Takuzu). Cells hold 0s and 1s:
 * - no three identical digits in a row horizontally or vertically,
 * - every row and column has an equal number of 0s and 1s,
 * - no two rows are identical, no two columns are identical.
 *
 * Grid encoding: 0 = empty, 1 = the digit "0", 2 = the digit "1". This keeps
 * the shared "0 means empty" convention used by the sudoku persistence layer.
 */
export type BinaryGrid = number[];

export type BinaryDifficulty = "easy" | "medium" | "hard" | "expert";

export const BINARY_DIFFICULTIES: readonly BinaryDifficulty[] = [
	"easy",
	"medium",
	"hard",
	"expert",
];

export const BINARY_SIZES: Record<BinaryDifficulty, number> = {
	easy: 6,
	medium: 8,
	hard: 10,
	expert: 10,
};

/** Fraction of cells kept as givens. */
const CLUE_FRACTIONS: Record<BinaryDifficulty, number> = {
	easy: 0.42,
	medium: 0.36,
	hard: 0.3,
	expert: 0.24,
};

/** Display digit ("0" / "1") for an encoded cell value; empty for 0. */
export function binaryDigitLabel(value: number) {
	return value === 1 ? "0" : value === 2 ? "1" : "";
}

export function emptyBinaryGrid(size: number): BinaryGrid {
	return new Array(size * size).fill(0);
}

function rowCells(size: number, row: number) {
	return Array.from({ length: size }, (_, col) => row * size + col);
}

function colCells(size: number, col: number) {
	return Array.from({ length: size }, (_, row) => row * size + col);
}

/**
 * Local validity of `grid` around placements: triples, per-line digit counts
 * and duplicate completed lines. Cheap enough to call from search.
 */
function lineViolation(values: number[], size: number) {
	let zeros = 0;
	let ones = 0;
	for (let i = 0; i < size; i += 1) {
		const value = values[i];
		if (value === 1) zeros += 1;
		if (value === 2) ones += 1;
		if (
			i >= 2 &&
			value !== 0 &&
			values[i - 1] === value &&
			values[i - 2] === value
		) {
			return true;
		}
	}
	return zeros > size / 2 || ones > size / 2;
}

function lineKey(values: number[]) {
	return values.join("");
}

/** All rule violations in the current grid, as a set of cell indices. */
export function findBinaryConflicts(
	grid: BinaryGrid,
	size: number,
): Set<number> {
	const conflicts = new Set<number>();

	const scanLine = (cells: number[]) => {
		// triples
		for (let i = 2; i < size; i += 1) {
			const value = grid[cells[i]];
			if (
				value !== 0 &&
				grid[cells[i - 1]] === value &&
				grid[cells[i - 2]] === value
			) {
				conflicts.add(cells[i]);
				conflicts.add(cells[i - 1]);
				conflicts.add(cells[i - 2]);
			}
		}
		// counts
		let zeros = 0;
		let ones = 0;
		for (const cell of cells) {
			if (grid[cell] === 1) zeros += 1;
			if (grid[cell] === 2) ones += 1;
		}
		if (zeros > size / 2) {
			for (const cell of cells) {
				if (grid[cell] === 1) conflicts.add(cell);
			}
		}
		if (ones > size / 2) {
			for (const cell of cells) {
				if (grid[cell] === 2) conflicts.add(cell);
			}
		}
	};

	const completedRows = new Map<string, number>();
	const completedCols = new Map<string, number>();
	for (let i = 0; i < size; i += 1) {
		const row = rowCells(size, i);
		const col = colCells(size, i);
		scanLine(row);
		scanLine(col);
		const rowValues = row.map((cell) => grid[cell]);
		if (!rowValues.includes(0)) {
			const key = lineKey(rowValues);
			const other = completedRows.get(key);
			if (other !== undefined) {
				for (const cell of row) conflicts.add(cell);
				for (const cell of rowCells(size, other)) conflicts.add(cell);
			} else {
				completedRows.set(key, i);
			}
		}
		const colValues = col.map((cell) => grid[cell]);
		if (!colValues.includes(0)) {
			const key = lineKey(colValues);
			const other = completedCols.get(key);
			if (other !== undefined) {
				for (const cell of col) conflicts.add(cell);
				for (const cell of colCells(size, other)) conflicts.add(cell);
			} else {
				completedCols.set(key, i);
			}
		}
	}
	return conflicts;
}

export function isBinarySolved(grid: BinaryGrid, size: number) {
	return (
		grid.length === size * size &&
		grid.every((value) => value === 1 || value === 2) &&
		findBinaryConflicts(grid, size).size === 0
	);
}

/** Fast check: is placing `value` at `cell` locally legal? */
function placementLegal(
	grid: BinaryGrid,
	size: number,
	cell: number,
	value: number,
) {
	grid[cell] = value;
	const row = Math.floor(cell / size);
	const col = cell % size;
	const rowValues = rowCells(size, row).map((c) => grid[c]);
	const colValues = colCells(size, col).map((c) => grid[c]);
	let legal =
		!lineViolation(rowValues, size) && !lineViolation(colValues, size);
	if (legal && !rowValues.includes(0)) {
		// completed row must differ from every other completed row
		for (let r = 0; r < size && legal; r += 1) {
			if (r === row) continue;
			const other = rowCells(size, r).map((c) => grid[c]);
			if (!other.includes(0) && lineKey(other) === lineKey(rowValues)) {
				legal = false;
			}
		}
	}
	if (legal && !colValues.includes(0)) {
		for (let c = 0; c < size && legal; c += 1) {
			if (c === col) continue;
			const other = colCells(size, c).map((cc) => grid[cc]);
			if (!other.includes(0) && lineKey(other) === lineKey(colValues)) {
				legal = false;
			}
		}
	}
	grid[cell] = 0;
	return legal;
}

function binarySearchCount(
	grid: BinaryGrid,
	size: number,
	limit: number,
	found: { count: number },
) {
	const cell = grid.indexOf(0);
	if (cell === -1) {
		found.count += 1;
		return;
	}
	for (const value of [1, 2]) {
		if (placementLegal(grid, size, cell, value)) {
			grid[cell] = value;
			binarySearchCount(grid, size, limit, found);
			grid[cell] = 0;
			if (found.count >= limit) {
				return;
			}
		}
	}
}

export function countBinarySolutions(
	grid: BinaryGrid,
	size: number,
	limit = 2,
) {
	if (findBinaryConflicts(grid, size).size > 0) {
		return 0;
	}
	const found = { count: 0 };
	binarySearchCount([...grid], size, limit, found);
	return found.count;
}

function generateSolvedBinaryGrid(size: number, rng: SudokuRng): BinaryGrid {
	const grid = emptyBinaryGrid(size);
	const solve = (): boolean => {
		const cell = grid.indexOf(0);
		if (cell === -1) {
			return true;
		}
		const order = rng() < 0.5 ? [1, 2] : [2, 1];
		for (const value of order) {
			if (placementLegal(grid, size, cell, value)) {
				grid[cell] = value;
				if (solve()) {
					return true;
				}
				grid[cell] = 0;
			}
		}
		return false;
	};
	solve();
	return grid;
}

export type GeneratedBinaryPuzzle = {
	size: number;
	givens: BinaryGrid;
	solution: BinaryGrid;
	difficulty: BinaryDifficulty;
	clueCount: number;
};

export function generateBinaryPuzzle(
	difficulty: BinaryDifficulty,
	rng: SudokuRng = Math.random,
): GeneratedBinaryPuzzle {
	const size = BINARY_SIZES[difficulty];
	const solution = generateSolvedBinaryGrid(size, rng);
	const givens = [...solution];
	const total = size * size;
	const target = Math.round(total * CLUE_FRACTIONS[difficulty]);
	let clueCount = total;

	const order = Array.from({ length: total }, (_, i) => i);
	for (let i = order.length - 1; i > 0; i -= 1) {
		const j = Math.floor(rng() * (i + 1));
		[order[i], order[j]] = [order[j], order[i]];
	}
	for (const cell of order) {
		if (clueCount <= target) {
			break;
		}
		const saved = givens[cell];
		givens[cell] = 0;
		if (countBinarySolutions(givens, size, 2) === 1) {
			clueCount -= 1;
		} else {
			givens[cell] = saved;
		}
	}
	return { size, givens, solution, difficulty, clueCount };
}

export function seededBinaryPuzzle(seed: number, difficulty: BinaryDifficulty) {
	return generateBinaryPuzzle(difficulty, mulberry32(seed));
}

// --- serialization (shared with the Convex sudoku module) ---

export function binaryGridToString(grid: BinaryGrid) {
	return grid.join("");
}

export function parseBinaryGrid(text: string, size: number): BinaryGrid {
	if (!new RegExp(`^[0-2]{${size * size}}$`).test(text)) {
		throw new Error("Invalid binary grid");
	}
	return [...text].map(Number);
}

export function isBinaryDifficulty(value: string): value is BinaryDifficulty {
	return (BINARY_DIFFICULTIES as readonly string[]).includes(value);
}
