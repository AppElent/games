/**
 * What differs between the grid puzzles stored as sudoku: classic, killer
 * (cages with sums) and binary (zeros and ones on a square board of a chosen
 * size). Everything a client or the server asks of a variant goes through
 * `SUDOKU_VARIANT_RULES`.
 */
import {
	BINARY_ACCEPTED_SIZES,
	findBinaryConflicts,
	generateBinaryPuzzle,
	isBinarySolved,
} from "./binary-puzzle";
import { GameRuleError } from "./errors";
import type { Rng } from "./random";
import {
	findConflicts,
	generatePuzzle,
	isGridSolved,
	SUDOKU_CELL_COUNT,
	type SudokuDifficulty,
	type SudokuGrid,
	type SudokuVariant,
} from "./sudoku";
import {
	findKillerConflicts,
	generateKillerPuzzle,
	isKillerSolved,
	type KillerCage,
	validateKillerCages,
} from "./sudoku-killer";

/** The parts of a stored puzzle a variant may need besides its digits. */
export type VariantShape = { size?: number; cages?: KillerCage[] };

/** A freshly generated puzzle, with what its variant stores beside the grids. */
type VariantPuzzle = VariantShape &
	(
		| { variant: "classic"; givens: SudokuGrid; solution: SudokuGrid }
		| {
				variant: "killer";
				givens: SudokuGrid;
				solution: SudokuGrid;
				cages: KillerCage[];
		  }
		| {
				variant: "binary";
				givens: number[];
				solution: number[];
				size: number;
		  }
	);

type VariantRules = {
	/** Cell count; throws `invalidBinarySize` for a binary board of a size it never makes. */
	cells(shape: VariantShape): number;
	/** The largest digit a cell may hold; 0 is empty. */
	maxDigit: number;
	/** Cells whose digits break the row, column and box (or binary) rules. Cage sums are not checked. */
	conflicts(grid: number[], shape: VariantShape): Set<number>;
	solved(grid: number[], shape: VariantShape): boolean;
	/**
	 * Throws when the shape cannot hold a puzzle, or when `solution` breaks a
	 * rule the grid checks above do not cover (killer cage sums).
	 */
	validate(shape: VariantShape, solution: number[] | undefined): void;
	/** What this variant stores beside the grids; nothing of another variant's. */
	stored(shape: VariantShape): VariantShape;
	generate(difficulty: SudokuDifficulty, rng: Rng): VariantPuzzle;
};

export const SUDOKU_VARIANT_RULES: Record<SudokuVariant, VariantRules> = {
	classic: {
		cells: () => SUDOKU_CELL_COUNT,
		maxDigit: 9,
		conflicts: (grid) => findConflicts(grid),
		solved: (grid) => isGridSolved(grid),
		validate: () => {},
		stored: () => ({}),
		generate: (difficulty, rng) => {
			const { givens, solution } = generatePuzzle(difficulty, rng);
			return { variant: "classic", givens, solution };
		},
	},
	killer: {
		cells: () => SUDOKU_CELL_COUNT,
		maxDigit: 9,
		conflicts: (grid) => findConflicts(grid),
		solved: (grid, { cages }) => isKillerSolved(grid, cages ?? []),
		validate: ({ cages }, solution) => {
			if (!cages || !validateKillerCages(cages)) {
				throw new GameRuleError("invalidKillerCages");
			}
			if (solution && findKillerConflicts(solution, cages).size > 0) {
				throw new GameRuleError("cagesUnsatisfied");
			}
		},
		stored: ({ cages }) => ({ cages }),
		generate: (difficulty, rng) => {
			const { givens, solution, cages } = generateKillerPuzzle(difficulty, rng);
			return { variant: "killer", givens, solution, cages };
		},
	},
	binary: {
		cells: ({ size }) => {
			const side = size ?? 0;
			if (!BINARY_ACCEPTED_SIZES.includes(side)) {
				throw new GameRuleError("invalidBinarySize");
			}
			return side * side;
		},
		maxDigit: 2,
		conflicts: (grid, { size }) => findBinaryConflicts(grid, size ?? 0),
		solved: (grid, { size }) => isBinarySolved(grid, size ?? 0),
		validate: () => {},
		stored: ({ size }) => ({ size }),
		generate: (difficulty, rng) => {
			const { givens, solution, size } = generateBinaryPuzzle(difficulty, rng);
			return { variant: "binary", givens, solution, size };
		},
	},
};

/**
 * Whether `text` is a whole grid of this puzzle in the one-digit-per-cell
 * format: the right length, every digit in range.
 */
export function isVariantGridString(
	variant: SudokuVariant,
	shape: VariantShape,
	text: string,
) {
	const rules = SUDOKU_VARIANT_RULES[variant];
	const cells = rules.cells(shape);
	return new RegExp(`^[0-${rules.maxDigit}]{${cells}}$`).test(text);
}

/** A new puzzle of `variant`, from the shared generators. */
export function generateVariantPuzzle(
	variant: SudokuVariant,
	difficulty: SudokuDifficulty,
	rng: Rng = Math.random,
): VariantPuzzle {
	return SUDOKU_VARIANT_RULES[variant].generate(difficulty, rng);
}
