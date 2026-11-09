import type { sudoku as sudokuCopy } from "./i18n/en/games/sudoku";
import { fmt } from "./i18n/format";
import type { SudokuGrid } from "./sudoku";
import {
	boxOf,
	colOf,
	computeCandidates,
	digitMask,
	digitsInMask,
	findConflicts,
	maskHasDigit,
	maskSize,
	rowOf,
	SUDOKU_BOXES,
	SUDOKU_COLS,
	SUDOKU_ROWS,
} from "./sudoku";

type HintTechniqueLevel = "beginner" | "intermediate" | "advanced";

type UnitKind = "row" | "column" | "box";
type HintUnit = { kind: UnitKind; index: number };

/**
 * What a hint is about. `describeHint` turns it into localized text; the
 * engine itself has no prose.
 */
type HintTechnique =
	| "mistake"
	| "naked-single"
	| "hidden-single"
	| "pointing"
	| "box-line-reduction"
	| "naked-pair"
	| "naked-triple"
	| "hidden-pair"
	| "hidden-triple"
	| "snyder-pair";

export type SudokuHint = {
	technique: HintTechnique;
	level: HintTechniqueLevel;
	/** Cells the technique reasons about. */
	cells: number[];
	/** Digits involved in the pattern. */
	candidateDigits: number[];
	/** Candidate eliminations the technique justifies. */
	eliminations: { cell: number; digits: number[] }[];
	/** Direct placements the technique justifies. */
	placements: { cell: number; digit: number }[];
	/** The region the text names; `line` and `box` for the box/line techniques. */
	unit?: HintUnit;
	line?: HintUnit;
	box?: number;
};

type TechniqueDetector = {
	id: string;
	name: string;
	level: HintTechniqueLevel;
	detect: (grid: SudokuGrid, candidates: number[]) => SudokuHint | null;
};

type UnitRef = HintUnit & { cells: readonly number[] };

function allUnits(): UnitRef[] {
	const units: UnitRef[] = [];
	for (let i = 0; i < 9; i += 1) {
		units.push({ kind: "row", index: i, cells: SUDOKU_ROWS[i] });
		units.push({ kind: "column", index: i, cells: SUDOKU_COLS[i] });
		units.push({ kind: "box", index: i, cells: SUDOKU_BOXES[i] });
	}
	return units;
}

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
				level: "beginner",
				cells: [cell],
				candidateDigits: [digit],
				eliminations: [],
				placements: [{ cell, digit }],
				unit: { kind: "row", index: rowOf(cell) },
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
				return {
					technique: "hidden-single",
					level: "beginner",
					cells: [cell],
					candidateDigits: [digit],
					eliminations: [],
					placements: [{ cell, digit }],
					unit: { kind: unit.kind, index: unit.index },
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
			return {
				technique: "pointing",
				level: "intermediate",
				cells: spots,
				candidateDigits: [digit],
				eliminations,
				placements: [],
				line: sameRow
					? { kind: "row", index: rowOf(spots[0]) }
					: { kind: "column", index: colOf(spots[0]) },
				box,
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
					level: "intermediate",
					cells: spots,
					candidateDigits: [digit],
					eliminations,
					placements: [],
					line: { kind: line.kind, index: line.index },
					box,
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
				level: "intermediate",
				cells: combo,
				candidateDigits: digits,
				eliminations,
				placements: [],
				unit: { kind: unit.kind, index: unit.index },
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
				level: "intermediate",
				cells,
				candidateDigits: combo,
				eliminations,
				placements: [],
				unit: { kind: unit.kind, index: unit.index },
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
					level: "beginner",
					cells: spots,
					candidateDigits: [digit],
					eliminations: [],
					placements: [],
					box,
				};
			}
		}
		return null;
	},
};

/** Tried in order; the first detector that finds something wins. */
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

/**
 * A digit the player placed that is wrong: one that differs from the
 * solution when it is known, else one that clashes with another digit.
 * Every technique assumes a correct grid, so this comes first.
 */
function findMistake(
	grid: SudokuGrid,
	{ solution, givens }: HintOptions,
): SudokuHint | null {
	const placed = (cell: number) => grid[cell] !== 0 && !givens?.[cell];
	const wrong = solution
		? grid.findIndex((value, cell) => placed(cell) && value !== solution[cell])
		: [...findConflicts(grid)].sort((a, b) => a - b).find(placed);
	if (wrong === undefined || wrong < 0) {
		return null;
	}
	return {
		technique: "mistake",
		level: "beginner",
		cells: [wrong],
		candidateDigits: [grid[wrong]],
		eliminations: [],
		placements: [],
		unit: { kind: "row", index: rowOf(wrong) },
	};
}

type HintOptions = {
	/** The solved grid, when the client has it. */
	solution?: SudokuGrid;
	/** Non-zero for the puzzle's own digits, which are never the mistake. */
	givens?: SudokuGrid;
};

export function findHint(
	grid: SudokuGrid,
	options: HintOptions = {},
): SudokuHint | null {
	const mistake = findMistake(grid, options);
	if (mistake) {
		return mistake;
	}
	const candidates = computeCandidates(grid);
	for (const detector of SUDOKU_TECHNIQUES) {
		const hint = detector.detect(grid, candidates);
		if (hint) {
			return hint;
		}
	}
	return null;
}

type SudokuHintCopy = typeof sudokuCopy.hints;

/**
 * A hint's title and the text for a level: 1 says where to look, 2 names the
 * technique and region, 3 explains it cell by cell.
 */
export function describeHint(
	hint: SudokuHint,
	level: 1 | 2 | 3,
	copy: SudokuHintCopy,
) {
	const cell = (index: number) =>
		fmt(copy.cell, { row: rowOf(index) + 1, col: colOf(index) + 1 });
	const unit = (ref: HintUnit) => fmt(copy[ref.kind], { n: ref.index + 1 });
	const size = hint.technique === "mistake" ? 1 : hint.cells.length;
	const values = {
		cell: cell(hint.cells[0]),
		cells: hint.cells.map(cell).join(", "),
		digit: hint.candidateDigits[0],
		digits: hint.candidateDigits.join(", "),
		eliminated: hint.eliminations.map((entry) => cell(entry.cell)).join(", "),
		unit: hint.unit ? unit(hint.unit) : "",
		line: hint.line ? unit(hint.line) : "",
		box: hint.box === undefined ? "" : unit({ kind: "box", index: hint.box }),
		set: size === 2 ? copy.pair : copy.triple,
		size,
	};
	const text = techniqueCopy(hint, copy);
	const body =
		level === 1 ? text.nudge : level === 2 ? text.direction : text.explanation;
	const crossHatch =
		level === 3 &&
		hint.technique === "hidden-single" &&
		hint.unit?.kind === "box"
			? copy.hiddenSingle.crossHatch
			: "";
	return {
		title: fmt(text.title, values),
		text: fmt(body, values) + crossHatch,
	};
}

function techniqueCopy(hint: SudokuHint, copy: SudokuHintCopy) {
	switch (hint.technique) {
		case "mistake":
			return copy.mistake;
		case "naked-single":
			return copy.nakedSingle;
		case "hidden-single":
			return copy.hiddenSingle;
		case "pointing":
			return copy.pointing;
		case "box-line-reduction":
			return copy.boxLine;
		case "naked-pair":
		case "naked-triple":
			return copy.nakedSet;
		case "hidden-pair":
		case "hidden-triple":
			return copy.hiddenSet;
		case "snyder-pair":
			return copy.snyder;
	}
}
