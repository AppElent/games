export type SudokuDifficulty = "easy" | "medium" | "hard" | "expert";

/** 81 cells, row-major. 0 = empty, 1-9 = digit. */
export type SudokuGrid = number[];

export const SUDOKU_CELL_COUNT = 81;
export const SUDOKU_DIFFICULTIES: readonly SudokuDifficulty[] = [
	"easy",
	"medium",
	"hard",
	"expert",
];

const CLUE_TARGETS: Record<SudokuDifficulty, number> = {
	easy: 40,
	medium: 34,
	hard: 28,
	expert: 24,
};

export function rowOf(cell: number) {
	return Math.floor(cell / 9);
}

export function colOf(cell: number) {
	return cell % 9;
}

export function boxOf(cell: number) {
	return Math.floor(rowOf(cell) / 3) * 3 + Math.floor(colOf(cell) / 3);
}

export function cellAt(row: number, col: number) {
	return row * 9 + col;
}

function buildUnits() {
	const rows: number[][] = [];
	const cols: number[][] = [];
	const boxes: number[][] = [];
	for (let i = 0; i < 9; i += 1) {
		rows.push([]);
		cols.push([]);
		boxes.push([]);
	}
	for (let cell = 0; cell < SUDOKU_CELL_COUNT; cell += 1) {
		rows[rowOf(cell)].push(cell);
		cols[colOf(cell)].push(cell);
		boxes[boxOf(cell)].push(cell);
	}
	return { rows, cols, boxes };
}

const UNITS = buildUnits();

export const SUDOKU_ROWS: readonly (readonly number[])[] = UNITS.rows;
export const SUDOKU_COLS: readonly (readonly number[])[] = UNITS.cols;
export const SUDOKU_BOXES: readonly (readonly number[])[] = UNITS.boxes;

function buildPeers() {
	const peers: number[][] = [];
	for (let cell = 0; cell < SUDOKU_CELL_COUNT; cell += 1) {
		const set = new Set<number>();
		for (const unit of [
			UNITS.rows[rowOf(cell)],
			UNITS.cols[colOf(cell)],
			UNITS.boxes[boxOf(cell)],
		]) {
			for (const other of unit) {
				if (other !== cell) {
					set.add(other);
				}
			}
		}
		peers.push([...set]);
	}
	return peers;
}

export const SUDOKU_PEERS: readonly (readonly number[])[] = buildPeers();

// --- bitmask helpers (bit 0 = digit 1 ... bit 8 = digit 9) ---

export function digitMask(digit: number) {
	return 1 << (digit - 1);
}

export function maskHasDigit(mask: number, digit: number) {
	return (mask & digitMask(digit)) !== 0;
}

export function toggleDigitInMask(mask: number, digit: number) {
	return mask ^ digitMask(digit);
}

export function digitsInMask(mask: number) {
	const digits: number[] = [];
	for (let digit = 1; digit <= 9; digit += 1) {
		if (maskHasDigit(mask, digit)) {
			digits.push(digit);
		}
	}
	return digits;
}

export function maskSize(mask: number) {
	let count = 0;
	let value = mask;
	while (value) {
		value &= value - 1;
		count += 1;
	}
	return count;
}

export const FULL_MASK = 0x1ff;

// --- grid parsing/serialization ---

export function emptyGrid(): SudokuGrid {
	return new Array(SUDOKU_CELL_COUNT).fill(0);
}

export function parseGrid(text: string): SudokuGrid {
	const chars = text.replace(/[^0-9.]/g, "");
	if (chars.length !== SUDOKU_CELL_COUNT) {
		throw new Error(`Expected 81 cells, got ${chars.length}`);
	}
	return [...chars].map((ch) => (ch === "." || ch === "0" ? 0 : Number(ch)));
}

export function gridToString(grid: SudokuGrid) {
	return grid.map((value) => (value === 0 ? "0" : String(value))).join("");
}

// --- validation ---

export function findConflicts(grid: SudokuGrid): Set<number> {
	const conflicts = new Set<number>();
	for (let cell = 0; cell < SUDOKU_CELL_COUNT; cell += 1) {
		const value = grid[cell];
		if (value === 0) {
			continue;
		}
		for (const peer of SUDOKU_PEERS[cell]) {
			if (grid[peer] === value) {
				conflicts.add(cell);
				conflicts.add(peer);
			}
		}
	}
	return conflicts;
}

export function isValidPlacement(grid: SudokuGrid, cell: number, digit: number) {
	for (const peer of SUDOKU_PEERS[cell]) {
		if (grid[peer] === digit) {
			return false;
		}
	}
	return true;
}

export function isGridFull(grid: SudokuGrid) {
	return grid.every((value) => value !== 0);
}

export function isGridSolved(grid: SudokuGrid) {
	return isGridFull(grid) && findConflicts(grid).size === 0;
}

/** Candidate bitmask per cell; 0 for filled cells. */
export function computeCandidates(grid: SudokuGrid): number[] {
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
		candidates[cell] = mask;
	}
	return candidates;
}

// --- solver ---

function findBestCell(grid: SudokuGrid, candidates: number[]) {
	let best = -1;
	let bestSize = 10;
	for (let cell = 0; cell < SUDOKU_CELL_COUNT; cell += 1) {
		if (grid[cell] !== 0) {
			continue;
		}
		const size = maskSize(candidates[cell]);
		if (size === 0) {
			return { cell, size: 0 };
		}
		if (size < bestSize) {
			best = cell;
			bestSize = size;
			if (size === 1) {
				break;
			}
		}
	}
	return { cell: best, size: bestSize };
}

function search(
	grid: SudokuGrid,
	limit: number,
	found: { count: number; solution: SudokuGrid | null },
) {
	const candidates = computeCandidates(grid);
	const { cell, size } = findBestCell(grid, candidates);
	if (cell === -1) {
		found.count += 1;
		if (!found.solution) {
			found.solution = [...grid];
		}
		return;
	}
	if (size === 0) {
		return;
	}
	for (const digit of digitsInMask(candidates[cell])) {
		grid[cell] = digit;
		search(grid, limit, found);
		grid[cell] = 0;
		if (found.count >= limit) {
			return;
		}
	}
}

export function countSolutions(grid: SudokuGrid, limit = 2) {
	if (findConflicts(grid).size > 0) {
		return 0;
	}
	const found = { count: 0, solution: null as SudokuGrid | null };
	search([...grid], limit, found);
	return found.count;
}

export function solve(grid: SudokuGrid): SudokuGrid | null {
	if (findConflicts(grid).size > 0) {
		return null;
	}
	const found = { count: 0, solution: null as SudokuGrid | null };
	search([...grid], 1, found);
	return found.solution;
}

// --- generation ---

export type SudokuRng = () => number;

/** Deterministic RNG for reproducible tests. */
export function mulberry32(seed: number): SudokuRng {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function shuffled<T>(items: readonly T[], rng: SudokuRng) {
	const copy = [...items];
	for (let i = copy.length - 1; i > 0; i -= 1) {
		const j = Math.floor(rng() * (i + 1));
		[copy[i], copy[j]] = [copy[j], copy[i]];
	}
	return copy;
}

export function generateSolvedGrid(rng: SudokuRng = Math.random): SudokuGrid {
	const grid = emptyGrid();
	const fill = (index: number): boolean => {
		if (index === SUDOKU_CELL_COUNT) {
			return true;
		}
		const candidates = computeCandidates(grid);
		const { cell, size } = findBestCell(grid, candidates);
		if (cell === -1) {
			return true;
		}
		if (size === 0) {
			return false;
		}
		for (const digit of shuffled(digitsInMask(candidates[cell]), rng)) {
			grid[cell] = digit;
			if (fill(index + 1)) {
				return true;
			}
			grid[cell] = 0;
		}
		return false;
	};
	fill(0);
	return grid;
}

export type GeneratedPuzzle = {
	givens: SudokuGrid;
	solution: SudokuGrid;
	difficulty: SudokuDifficulty;
	clueCount: number;
};

export function generatePuzzle(
	difficulty: SudokuDifficulty,
	rng: SudokuRng = Math.random,
): GeneratedPuzzle {
	const solution = generateSolvedGrid(rng);
	const givens = [...solution];
	const target = CLUE_TARGETS[difficulty];
	let clueCount = SUDOKU_CELL_COUNT;

	// Remove symmetric pairs while the puzzle keeps a unique solution.
	const order = shuffled(
		Array.from({ length: 41 }, (_, i) => i),
		rng,
	);
	for (const cell of order) {
		if (clueCount <= target) {
			break;
		}
		const mirror = SUDOKU_CELL_COUNT - 1 - cell;
		const saved = [givens[cell], givens[mirror]];
		if (saved[0] === 0 && saved[1] === 0) {
			continue;
		}
		const removing = cell === mirror ? 1 : Number(saved[0] !== 0) + Number(saved[1] !== 0);
		givens[cell] = 0;
		givens[mirror] = 0;
		if (countSolutions(givens, 2) === 1) {
			clueCount -= removing;
		} else {
			givens[cell] = saved[0];
			givens[mirror] = saved[1];
		}
	}

	// Second pass: single-cell removals to get closer to the target for
	// harder levels where symmetric removal stalls early.
	if (clueCount > target) {
		for (const cell of shuffled(
			Array.from({ length: SUDOKU_CELL_COUNT }, (_, i) => i),
			rng,
		)) {
			if (clueCount <= target) {
				break;
			}
			if (givens[cell] === 0) {
				continue;
			}
			const saved = givens[cell];
			givens[cell] = 0;
			if (countSolutions(givens, 2) === 1) {
				clueCount -= 1;
			} else {
				givens[cell] = saved;
			}
		}
	}

	return { givens, solution, difficulty, clueCount };
}

export function isSudokuDifficulty(value: string): value is SudokuDifficulty {
	return (SUDOKU_DIFFICULTIES as readonly string[]).includes(value);
}
