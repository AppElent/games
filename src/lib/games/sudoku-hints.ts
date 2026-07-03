import type { SudokuGrid } from "./sudoku";
import {
	boxOf,
	colOf,
	computeCandidates,
	digitMask,
	digitsInMask,
	maskHasDigit,
	maskSize,
	rowOf,
	SUDOKU_BOXES,
	SUDOKU_COLS,
	SUDOKU_ROWS,
} from "./sudoku";

export type HintTechniqueLevel = "beginner" | "intermediate" | "advanced";

export type SudokuHint = {
	technique: string;
	title: string;
	level: HintTechniqueLevel;
	/** Cells the technique reasons about. */
	cells: number[];
	/** Digits involved in the pattern. */
	candidateDigits: number[];
	/** Candidate eliminations the technique justifies. */
	eliminations: { cell: number; digits: number[] }[];
	/** Direct placements the technique justifies. */
	placements: { cell: number; digit: number }[];
	/** Level 1: subtle nudge — where to look, no technique named. */
	nudge: string;
	/** Level 2: names the technique and the region. */
	direction: string;
	/** Level 3: full explanation with explicit cells/candidates. */
	explanation: string;
};

export type TechniqueDetector = {
	id: string;
	name: string;
	level: HintTechniqueLevel;
	detect: (grid: SudokuGrid, candidates: number[]) => SudokuHint | null;
};

function cellName(cell: number) {
	return `R${rowOf(cell) + 1}C${colOf(cell) + 1}`;
}

function listCells(cells: number[]) {
	return cells.map(cellName).join(", ");
}

function listDigits(digits: number[]) {
	return digits.join(", ");
}

type UnitRef = {
	kind: "row" | "column" | "box";
	index: number;
	cells: readonly number[];
};

function allUnits(): UnitRef[] {
	const units: UnitRef[] = [];
	for (let i = 0; i < 9; i += 1) {
		units.push({ kind: "row", index: i, cells: SUDOKU_ROWS[i] });
		units.push({ kind: "column", index: i, cells: SUDOKU_COLS[i] });
		units.push({ kind: "box", index: i, cells: SUDOKU_BOXES[i] });
	}
	return units;
}

function unitName(unit: UnitRef) {
	return `${unit.kind} ${unit.index + 1}`;
}

// --- detectors ---

const nakedSingle: TechniqueDetector = {
	id: "naked-single",
	name: "Naked single",
	level: "beginner",
	detect: (grid, candidates) => {
		for (let cell = 0; cell < 81; cell += 1) {
			if (grid[cell] !== 0 || maskSize(candidates[cell]) !== 1) {
				continue;
			}
			const digit = digitsInMask(candidates[cell])[0];
			return {
				technique: "naked-single",
				title: "Naked single",
				level: "beginner",
				cells: [cell],
				candidateDigits: [digit],
				eliminations: [],
				placements: [{ cell, digit }],
				nudge: `Take a close look at ${cellName(cell)} — how many digits can still go there?`,
				direction: `There is a naked single in row ${rowOf(cell) + 1}: a cell where every digit but one is ruled out.`,
				explanation: `${cellName(cell)} has only one remaining candidate: ${digit}. Every other digit already appears in its row, column, or box, so ${digit} must go there.`,
			};
		}
		return null;
	},
};

const hiddenSingle: TechniqueDetector = {
	id: "hidden-single",
	name: "Hidden single",
	level: "beginner",
	detect: (grid, candidates) => {
		for (const unit of allUnits()) {
			for (let digit = 1; digit <= 9; digit += 1) {
				const spots = unit.cells.filter(
					(cell) => grid[cell] === 0 && maskHasDigit(candidates[cell], digit),
				);
				if (spots.length !== 1) {
					continue;
				}
				const cell = spots[0];
				if (maskSize(candidates[cell]) === 1) {
					continue; // covered by naked single
				}
				const crossHatch =
					unit.kind === "box"
						? " Cross-hatching the box (scanning the rows and columns that pass through it) shows this."
						: "";
				return {
					technique: "hidden-single",
					title: "Hidden single",
					level: "beginner",
					cells: [cell],
					candidateDigits: [digit],
					eliminations: [],
					placements: [{ cell, digit }],
					nudge: `Scan ${unitName(unit)} — one digit has only a single home left there.`,
					direction: `There is a hidden single for ${digit} in ${unitName(unit)}. Cross-hatch to find the only cell that can take it.`,
					explanation: `Within ${unitName(unit)}, the digit ${digit} can only be placed in ${cellName(cell)} — every other cell is blocked by an existing ${digit} in its row, column, or box.${crossHatch}`,
				};
			}
		}
		return null;
	},
};

function findPointing(
	grid: SudokuGrid,
	candidates: number[],
): SudokuHint | null {
	for (let box = 0; box < 9; box += 1) {
		for (let digit = 1; digit <= 9; digit += 1) {
			const spots = SUDOKU_BOXES[box].filter(
				(cell) => grid[cell] === 0 && maskHasDigit(candidates[cell], digit),
			);
			if (spots.length < 2 || spots.length > 3) {
				continue;
			}
			const sameRow = spots.every((cell) => rowOf(cell) === rowOf(spots[0]));
			const sameCol = spots.every((cell) => colOf(cell) === colOf(spots[0]));
			if (!sameRow && !sameCol) {
				continue;
			}
			const line = sameRow
				? SUDOKU_ROWS[rowOf(spots[0])]
				: SUDOKU_COLS[colOf(spots[0])];
			const lineLabel = sameRow
				? `row ${rowOf(spots[0]) + 1}`
				: `column ${colOf(spots[0]) + 1}`;
			const eliminations = line
				.filter(
					(cell) =>
						boxOf(cell) !== box &&
						grid[cell] === 0 &&
						maskHasDigit(candidates[cell], digit),
				)
				.map((cell) => ({ cell, digits: [digit] }));
			if (eliminations.length === 0) {
				continue;
			}
			const kind = spots.length === 2 ? "pair" : "triple";
			return {
				technique: "pointing",
				title: `Pointing ${kind}`,
				level: "intermediate",
				cells: spots,
				candidateDigits: [digit],
				eliminations,
				placements: [],
				nudge: `Look at where ${digit} can go inside box ${box + 1} — notice anything about the shape?`,
				direction: `Box ${box + 1} has a pointing ${kind}: all its ${digit} candidates share ${lineLabel}, which constrains the rest of that line.`,
				explanation: `In box ${box + 1}, the digit ${digit} is confined to ${listCells(spots)}, all in ${lineLabel}. Wherever it lands, ${lineLabel} gets its ${digit} from this box — so ${digit} can be removed from ${listCells(eliminations.map((e) => e.cell))}.`,
			};
		}
	}
	return null;
}

const pointing: TechniqueDetector = {
	id: "pointing",
	name: "Pointing pair/triple",
	level: "intermediate",
	detect: findPointing,
};

const boxLineReduction: TechniqueDetector = {
	id: "box-line-reduction",
	name: "Box-line reduction",
	level: "intermediate",
	detect: (grid, candidates) => {
		const lines: UnitRef[] = [];
		for (let i = 0; i < 9; i += 1) {
			lines.push({ kind: "row", index: i, cells: SUDOKU_ROWS[i] });
			lines.push({ kind: "column", index: i, cells: SUDOKU_COLS[i] });
		}
		for (const line of lines) {
			for (let digit = 1; digit <= 9; digit += 1) {
				const spots = line.cells.filter(
					(cell) => grid[cell] === 0 && maskHasDigit(candidates[cell], digit),
				);
				if (spots.length < 2 || spots.length > 3) {
					continue;
				}
				const box = boxOf(spots[0]);
				if (!spots.every((cell) => boxOf(cell) === box)) {
					continue;
				}
				const eliminations = SUDOKU_BOXES[box]
					.filter(
						(cell) =>
							!spots.includes(cell) &&
							grid[cell] === 0 &&
							maskHasDigit(candidates[cell], digit),
					)
					.map((cell) => ({ cell, digits: [digit] }));
				if (eliminations.length === 0) {
					continue;
				}
				return {
					technique: "box-line-reduction",
					title: "Box-line reduction",
					level: "intermediate",
					cells: spots,
					candidateDigits: [digit],
					eliminations,
					placements: [],
					nudge: `Check where ${digit} can go in ${unitName(line)} — the options cluster together.`,
					direction: `${unitName(line)} allows box-line reduction: its ${digit} candidates all sit in box ${box + 1}.`,
					explanation: `In ${unitName(line)}, the digit ${digit} can only go in ${listCells(spots)}, all inside box ${box + 1}. The box must take its ${digit} from that line, so ${digit} can be removed from ${listCells(eliminations.map((e) => e.cell))}.`,
				};
			}
		}
		return null;
	},
};

function combinations<T>(items: readonly T[], size: number): T[][] {
	if (size === 0) {
		return [[]];
	}
	const result: T[][] = [];
	items.forEach((item, index) => {
		for (const rest of combinations(items.slice(index + 1), size - 1)) {
			result.push([item, ...rest]);
		}
	});
	return result;
}

function findNakedSet(
	grid: SudokuGrid,
	candidates: number[],
	size: 2 | 3,
): SudokuHint | null {
	const label = size === 2 ? "pair" : "triple";
	for (const unit of allUnits()) {
		const open = unit.cells.filter(
			(cell) => grid[cell] === 0 && maskSize(candidates[cell]) <= size,
		);
		for (const combo of combinations(open, size)) {
			const union = combo.reduce((mask, cell) => mask | candidates[cell], 0);
			if (maskSize(union) !== size) {
				continue;
			}
			const digits = digitsInMask(union);
			const eliminations = unit.cells
				.filter((cell) => grid[cell] === 0 && !combo.includes(cell))
				.map((cell) => ({
					cell,
					digits: digits.filter((digit) =>
						maskHasDigit(candidates[cell], digit),
					),
				}))
				.filter((entry) => entry.digits.length > 0);
			if (eliminations.length === 0) {
				continue;
			}
			return {
				technique: `naked-${label}`,
				title: `Naked ${label}`,
				level: "intermediate",
				cells: combo,
				candidateDigits: digits,
				eliminations,
				placements: [],
				nudge: `Compare the candidate lists in ${unitName(unit)} — some cells share exactly the same few digits.`,
				direction: `${unitName(unit)} contains a naked ${label}: ${size} cells that only allow the same ${size} digits.`,
				explanation: `In ${unitName(unit)}, the cells ${listCells(combo)} only allow the digits ${listDigits(digits)}. Those digits must occupy exactly those cells, so they can be removed from every other cell in the ${unit.kind}.`,
			};
		}
	}
	return null;
}

function findHiddenSet(
	grid: SudokuGrid,
	candidates: number[],
	size: 2 | 3,
): SudokuHint | null {
	const label = size === 2 ? "pair" : "triple";
	for (const unit of allUnits()) {
		const open = unit.cells.filter((cell) => grid[cell] === 0);
		const digitSpots = new Map<number, number[]>();
		for (let digit = 1; digit <= 9; digit += 1) {
			const spots = open.filter((cell) =>
				maskHasDigit(candidates[cell], digit),
			);
			if (spots.length >= 2 && spots.length <= size) {
				digitSpots.set(digit, spots);
			}
		}
		for (const combo of combinations([...digitSpots.keys()], size)) {
			const cells = [
				...new Set(combo.flatMap((digit) => digitSpots.get(digit) ?? [])),
			];
			if (cells.length !== size) {
				continue;
			}
			const comboMask = combo.reduce(
				(mask, digit) => mask | digitMask(digit),
				0,
			);
			const eliminations = cells
				.map((cell) => ({
					cell,
					digits: digitsInMask(candidates[cell] & ~comboMask),
				}))
				.filter((entry) => entry.digits.length > 0);
			if (eliminations.length === 0) {
				continue;
			}
			return {
				technique: `hidden-${label}`,
				title: `Hidden ${label}`,
				level: "intermediate",
				cells,
				candidateDigits: combo,
				eliminations,
				placements: [],
				nudge: `In ${unitName(unit)}, track where ${listDigits(combo)} can still go — the options overlap.`,
				direction: `${unitName(unit)} hides a ${label}: the digits ${listDigits(combo)} fit only in the same ${size} cells.`,
				explanation: `In ${unitName(unit)}, the digits ${listDigits(combo)} can only be placed in ${listCells(cells)}. Those cells are reserved for them, so all other candidates can be removed from those cells.`,
			};
		}
	}
	return null;
}

const nakedPair: TechniqueDetector = {
	id: "naked-pair",
	name: "Naked pair",
	level: "intermediate",
	detect: (grid, candidates) => findNakedSet(grid, candidates, 2),
};

const nakedTriple: TechniqueDetector = {
	id: "naked-triple",
	name: "Naked triple",
	level: "intermediate",
	detect: (grid, candidates) => findNakedSet(grid, candidates, 3),
};

const hiddenPair: TechniqueDetector = {
	id: "hidden-pair",
	name: "Hidden pair",
	level: "intermediate",
	detect: (grid, candidates) => findHiddenSet(grid, candidates, 2),
};

const hiddenTriple: TechniqueDetector = {
	id: "hidden-triple",
	name: "Hidden triple",
	level: "intermediate",
	detect: (grid, candidates) => findHiddenSet(grid, candidates, 3),
};

/**
 * Snyder-notation suggestion: a digit restricted to two cells of a box is
 * worth marking with corner notes. Fallback guidance when no direct
 * progress technique fires.
 */
const snyderSuggestion: TechniqueDetector = {
	id: "snyder-pair",
	name: "Snyder notation",
	level: "beginner",
	detect: (grid, candidates) => {
		for (let box = 0; box < 9; box += 1) {
			for (let digit = 1; digit <= 9; digit += 1) {
				const spots = SUDOKU_BOXES[box].filter(
					(cell) => grid[cell] === 0 && maskHasDigit(candidates[cell], digit),
				);
				if (spots.length !== 2) {
					continue;
				}
				return {
					technique: "snyder-pair",
					title: "Snyder notation",
					level: "beginner",
					cells: spots,
					candidateDigits: [digit],
					eliminations: [],
					placements: [],
					nudge: `Box ${box + 1} is worth annotating — one digit is down to two spots.`,
					direction: `Use Snyder notation in box ${box + 1}: mark the two possible cells for ${digit} with corner notes.`,
					explanation: `In box ${box + 1}, the digit ${digit} can only go in ${listCells(spots)}. Mark both with a corner note ${digit} — when one is ruled out later, the other becomes a certain placement.`,
				};
			}
		}
		return null;
	},
};

/**
 * Ordered registry. Advanced techniques (X-Wing, Swordfish, XY-Wing,
 * coloring, chains) plug in here later as additional detectors.
 */
export const SUDOKU_TECHNIQUES: readonly TechniqueDetector[] = [
	nakedSingle,
	hiddenSingle,
	pointing,
	boxLineReduction,
	nakedPair,
	hiddenPair,
	nakedTriple,
	hiddenTriple,
	snyderSuggestion,
];

export function findHint(
	grid: SudokuGrid,
	detectors: readonly TechniqueDetector[] = SUDOKU_TECHNIQUES,
): SudokuHint | null {
	const candidates = computeCandidates(grid);
	for (const detector of detectors) {
		const hint = detector.detect(grid, candidates);
		if (hint) {
			return hint;
		}
	}
	return null;
}

export function hintTextForLevel(hint: SudokuHint, level: 1 | 2 | 3) {
	if (level === 1) {
		return hint.nudge;
	}
	if (level === 2) {
		return hint.direction;
	}
	return hint.explanation;
}
