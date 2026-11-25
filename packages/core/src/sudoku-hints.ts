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
	solveSudoku,
} from "./sudoku";
import { ADVANCED_TECHNIQUES, combinations } from "./sudoku-hints-advanced";
import { EXPERT_TECHNIQUES } from "./sudoku-hints-expert";

/** Hint levels from simplest to hardest; the settings name them "Basic" up. */
export const HINT_LEVELS = [
	"beginner",
	"intermediate",
	"advanced",
	"expert",
] as const;
export type HintTechniqueLevel = (typeof HINT_LEVELS)[number];

function levelRank(level: HintTechniqueLevel) {
	return HINT_LEVELS.indexOf(level);
}

type UnitKind = "row" | "column" | "box";
export type HintUnit = { kind: UnitKind; index: number };

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
	| "naked-quad"
	| "hidden-quad"
	| "x-wing"
	| "swordfish"
	| "skyscraper"
	| "two-string-kite"
	| "xy-wing"
	| "xyz-wing"
	| "w-wing"
	| "unique-rectangle"
	| "bug-plus-one"
	| "jellyfish"
	| "simple-coloring"
	| "x-chain"
	| "xy-chain"
	| "als-xz"
	| "reveal-cell"
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
	/** The lines a fish or single-digit pattern stands on. */
	baseLines?: HintUnit[];
	/** The lines a fish clears outside its base lines. */
	coverLines?: HintUnit[];
	/**
	 * Two groups the board shows in two tones once the hint is explained: the
	 * colours of Simple Coloring (the wrong colour first when they wrap), the
	 * alternating cells of a chain, or the two sets of an ALS-XZ.
	 */
	colors?: [number[], number[]];
	/** How Simple Coloring concludes: a colour wraps, or traps a cell. */
	coloring?: "wrap" | "trap";
	/**
	 * True when the pattern only shows once candidates removed by earlier
	 * hints are gone too.
	 */
	usesEarlierHints?: boolean;
	/**
	 * True when the next step needs a harder technique than the player's
	 * maximum hint level: the client offers it instead of showing it.
	 */
	aboveMaxLevel?: boolean;
};

export type TechniqueDetector = {
	id: string;
	level: HintTechniqueLevel;
	/** Only sound when the puzzle has exactly one solution. */
	needsUniqueness?: boolean;
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
	level: "intermediate",
	detect: findPointing,
};

const boxLineReduction: TechniqueDetector = {
	id: "box-line-reduction",
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

type SetSize = 2 | 3 | 4;
const SET_LABELS = { 2: "pair", 3: "triple", 4: "quad" } as const;
const setLevel = (size: SetSize) => (size === 4 ? "advanced" : "intermediate");

function findNakedSet(
	grid: SudokuGrid,
	candidates: number[],
	size: SetSize,
): SudokuHint | null {
	const label = SET_LABELS[size];
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
				level: setLevel(size),
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
	size: SetSize,
): SudokuHint | null {
	const label = SET_LABELS[size];
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
				level: setLevel(size),
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
	level: "intermediate",
	detect: (grid, candidates) => findNakedSet(grid, candidates, 2),
};

const nakedTriple: TechniqueDetector = {
	id: "naked-triple",
	level: "intermediate",
	detect: (grid, candidates) => findNakedSet(grid, candidates, 3),
};

const hiddenPair: TechniqueDetector = {
	id: "hidden-pair",
	level: "intermediate",
	detect: (grid, candidates) => findHiddenSet(grid, candidates, 2),
};

const hiddenTriple: TechniqueDetector = {
	id: "hidden-triple",
	level: "intermediate",
	detect: (grid, candidates) => findHiddenSet(grid, candidates, 3),
};

const nakedQuad: TechniqueDetector = {
	id: "naked-quad",
	level: "advanced",
	detect: (grid, candidates) => findNakedSet(grid, candidates, 4),
};

const hiddenQuad: TechniqueDetector = {
	id: "hidden-quad",
	level: "advanced",
	detect: (grid, candidates) => findHiddenSet(grid, candidates, 4),
};

/**
 * Snyder-notation suggestion: a digit restricted to two cells of a box is
 * worth marking with corner notes. Fallback guidance when no direct
 * progress technique fires.
 */
const snyderSuggestion: TechniqueDetector = {
	id: "snyder-pair",
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
	nakedQuad,
	hiddenQuad,
	...ADVANCED_TECHNIQUES,
	...EXPERT_TECHNIQUES,
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

/**
 * Candidates earlier hints removed, with the board they were found on. An
 * entry holds while every digit of that board is still in place.
 */
export type HintHistory = readonly {
	grid: SudokuGrid;
	eliminations: SudokuHint["eliminations"];
}[];

export type HintOptions = {
	/** The solved grid, when the client has it. */
	solution?: SudokuGrid;
	/** Non-zero for the puzzle's own digits, which are never the mistake. */
	givens?: SudokuGrid;
	/** Earlier hints in this game, so the next one moves on from them. */
	history?: HintHistory;
	/**
	 * Killer cages, when the puzzle has them: its solution is then unique only
	 * with the cages, so the uniqueness techniques stay off.
	 */
	cages?: readonly unknown[];
	/** The hardest technique the player wants hints for. */
	maxLevel?: HintTechniqueLevel;
};

/** Adds a hint's eliminations to the history, tied to the board it saw. */
export function rememberHint(
	history: HintHistory,
	grid: SudokuGrid,
	hint: SudokuHint | null,
): HintHistory {
	if (!hint || hint.eliminations.length === 0) {
		return history;
	}
	return [...history, { grid: [...grid], eliminations: hint.eliminations }];
}

function stillHolds(entryGrid: SudokuGrid, grid: SudokuGrid) {
	return entryGrid.every((value, cell) => value === 0 || grid[cell] === value);
}

/** The candidates for `grid` once earlier hints' eliminations are applied. */
function candidatesAfter(grid: SudokuGrid, history: HintHistory = []) {
	const candidates = computeCandidates(grid);
	for (const entry of history) {
		if (!stillHolds(entry.grid, grid)) {
			continue;
		}
		for (const { cell, digits } of entry.eliminations) {
			for (const digit of digits) {
				candidates[cell] &= ~digitMask(digit);
			}
		}
	}
	return candidates;
}

/** The last puzzle checked: hints come many times for the same one. */
let uniqueCheck: {
	key: string;
	unique: boolean;
	solution?: SudokuGrid;
} | null = null;

function checkGivens(givens: SudokuGrid) {
	const key = givens.join("");
	if (uniqueCheck?.key !== key) {
		const solution = solveSudoku(givens) ?? undefined;
		uniqueCheck = { key, unique: solution !== undefined, solution };
	}
	return uniqueCheck;
}

function hasUniqueSolution(givens: SudokuGrid) {
	return checkGivens(givens).unique;
}

/**
 * The last resort once no technique applies: one open cell from the
 * solution, the one with the fewest candidates left.
 */
function revealCell(
	grid: SudokuGrid,
	candidates: number[],
	solution: SudokuGrid | undefined,
): SudokuHint | null {
	if (!solution) {
		return null;
	}
	let best = -1;
	for (let cell = 0; cell < 81; cell += 1) {
		if (
			grid[cell] === 0 &&
			(best < 0 || maskSize(candidates[cell]) < maskSize(candidates[best]))
		) {
			best = cell;
		}
	}
	if (best < 0) {
		return null;
	}
	return {
		technique: "reveal-cell",
		level: "expert",
		cells: [best],
		candidateDigits: [solution[best]],
		eliminations: [],
		placements: [{ cell: best, digit: solution[best] }],
		unit: { kind: "row", index: rowOf(best) },
	};
}

export function findHint(
	grid: SudokuGrid,
	options: HintOptions = {},
): SudokuHint | null {
	const mistake = findMistake(grid, options);
	if (mistake) {
		return mistake;
	}
	const plain = computeCandidates(grid);
	const candidates = candidatesAfter(grid, options.history);
	// A cell with nothing left means a wrong digit somewhere: no technique
	// can be trusted then.
	if (grid.some((value, cell) => value === 0 && candidates[cell] === 0)) {
		return null;
	}
	const unique =
		!options.cages?.length &&
		options.givens !== undefined &&
		hasUniqueSolution(options.givens);
	// Killer givens are rarely unique without their cages, so only a
	// solution the client passes is trusted there.
	const solution =
		options.solution ??
		(!options.cages?.length && options.givens
			? checkGivens(options.givens).solution
			: undefined);
	for (const detector of SUDOKU_TECHNIQUES) {
		if (detector.needsUniqueness && !unique) {
			continue;
		}
		// Revealing a cell beats only suggesting notes.
		const hint =
			(detector.id === "snyder-pair"
				? revealCell(grid, candidates, solution)
				: null) ?? detector.detect(grid, candidates);
		if (hint) {
			const touched = [
				...hint.cells,
				...hint.eliminations.map((entry) => entry.cell),
			];
			const marked = touched.some((cell) => plain[cell] !== candidates[cell])
				? { ...hint, usesEarlierHints: true }
				: hint;
			// Detectors run simplest first, so a step above the maximum means
			// no progress step within it exists. The Snyder fallback, which
			// only suggests notes, does not count as one.
			return options.maxLevel &&
				levelRank(hint.level) > levelRank(options.maxLevel)
				? { ...marked, aboveMaxLevel: true }
				: marked;
		}
	}
	return null;
}

type SudokuHintCopy = typeof sudokuCopy.hints;

/** "rows 2 and 7", or "row 3 and column 5" when the kinds differ. */
function unitList(units: HintUnit[], copy: SudokuHintCopy) {
	const join = (items: (string | number)[]) =>
		items.length < 2
			? items.join("")
			: `${items.slice(0, -1).join(", ")}${copy.and}${items[items.length - 1]}`;
	const kinds = new Set(units.map((unit) => unit.kind));
	if (units.length > 1 && kinds.size === 1) {
		const kind = units[0].kind;
		const numbers = join(units.map((unit) => unit.index + 1));
		if (kind === "row" || kind === "column") {
			return fmt(kind === "row" ? copy.rows : copy.columns, { list: numbers });
		}
	}
	return join(units.map((unit) => fmt(copy[unit.kind], { n: unit.index + 1 })));
}

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
	const cellList = (cells: number[]) => cells.map(cell).join(", ");
	const unit = (ref: HintUnit) => fmt(copy[ref.kind], { n: ref.index + 1 });
	const size = hint.technique === "mistake" ? 1 : hint.cells.length;
	const [first, second, third, fourth] = hint.cells;
	const [x, y, z] = hint.candidateDigits;
	const values = {
		cell: cell(first),
		cells: cellList(hint.cells),
		digit: x,
		digits: hint.candidateDigits.join(", "),
		eliminated: cellList(hint.eliminations.map((entry) => entry.cell)),
		unit: hint.unit ? unit(hint.unit) : "",
		line: hint.line ? unit(hint.line) : "",
		box: hint.box === undefined ? "" : unit({ kind: "box", index: hint.box }),
		set: size === 2 ? copy.pair : size === 3 ? copy.triple : copy.quad,
		size,
		...patternValues(),
	};
	function patternValues(): Record<string, string | number> {
		const base = unitList(hint.baseLines ?? [], copy);
		const cover = unitList(hint.coverLines ?? [], copy);
		switch (hint.technique) {
			case "x-wing":
			case "swordfish":
			case "jellyfish": {
				const names = {
					"x-wing": [copy.fish.xWing, copy.fish.anXWing],
					swordfish: [copy.fish.swordfish, copy.fish.aSwordfish],
					jellyfish: [copy.fish.jellyfish, copy.fish.aJellyfish],
				}[hint.technique];
				return { base, cover, fish: names[0], aFish: names[1] };
			}
			case "simple-coloring": {
				const [wrong, right] = hint.colors ?? [[], []];
				return {
					clash: cellList([first, second]),
					colorA: cellList(wrong),
					colorB: cellList(right),
				};
			}
			case "x-chain":
			case "xy-chain":
				return {
					start: cell(first),
					end: cell(hint.cells[hint.cells.length - 1]),
					chain: cellList(hint.cells),
				};
			case "als-xz": {
				const [setA, setB] = hint.colors ?? [[], []];
				return { alsA: cellList(setA), alsB: cellList(setB), x, z: y };
			}
			case "skyscraper":
			case "two-string-kite":
				// Cells: the two linked ends, then the two free ends.
				return {
					base,
					shared: cellList([first, third]),
					ends: cellList([second, fourth]),
				};
			case "xy-wing":
				return {
					pivot: cell(first),
					wingX: cell(second),
					wingY: cell(third),
					x,
					y,
					z,
				};
			case "xyz-wing":
				return {
					pivot: cell(first),
					wings: cellList([second, third]),
					x,
					y,
					z,
				};
			case "w-wing":
				return {
					base,
					wings: cellList([first, second]),
					link: cellList([third, fourth]),
					x,
					y,
				};
			case "unique-rectangle":
				return {
					floor: cellList([first, second, third]),
					target: cell(fourth),
					x,
					y,
				};
			default:
				return {};
		}
	}
	const text = techniqueCopy(hint, copy);
	const body =
		level === 1 ? text.nudge : level === 2 ? text.direction : text.explanation;
	const crossHatch =
		level === 3 &&
		hint.technique === "hidden-single" &&
		hint.unit?.kind === "box"
			? copy.hiddenSingle.crossHatch
			: "";
	const earlier =
		level === 3 && hint.usesEarlierHints ? copy.afterEarlierHints : "";
	return {
		title: fmt(text.title, values),
		text: fmt(body, values) + crossHatch + earlier,
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
		case "naked-quad":
			return copy.nakedSet;
		case "hidden-pair":
		case "hidden-triple":
		case "hidden-quad":
			return copy.hiddenSet;
		case "x-wing":
		case "swordfish":
			return copy.fish;
		case "skyscraper":
			return copy.skyscraper;
		case "two-string-kite":
			return copy.twoStringKite;
		case "xy-wing":
			return copy.xyWing;
		case "xyz-wing":
			return copy.xyzWing;
		case "w-wing":
			return copy.wWing;
		case "unique-rectangle":
			return copy.uniqueRectangle;
		case "bug-plus-one":
			return copy.bugPlusOne;
		case "jellyfish":
			return copy.fish;
		case "simple-coloring":
			return hint.coloring === "wrap" ? copy.colorWrap : copy.colorTrap;
		case "x-chain":
			return copy.xChain;
		case "xy-chain":
			return copy.xyChain;
		case "als-xz":
			return copy.alsXz;
		case "reveal-cell":
			return copy.revealCell;
		case "snyder-pair":
			return copy.snyder;
	}
}

function unitCells(ref: HintUnit) {
	const units =
		ref.kind === "row"
			? SUDOKU_ROWS
			: ref.kind === "column"
				? SUDOKU_COLS
				: SUDOKU_BOXES;
	return units[ref.index];
}

export type HintHighlights = {
	cells: Set<number>;
	lines: Set<number>;
	/** Two-tone groups at level 3: colours, a chain's links or ALS sets. */
	tones?: [Set<number>, Set<number>];
};

/**
 * What the board marks for a hint at a disclosure level: nothing at 1 (text
 * only), the pattern's cells at 2, and at 3 also the cells it changes and the
 * base and cover lines of a fish or single-digit pattern. At 3 a pattern
 * with two groups shows them in two tones instead of the hint fill.
 */
export function hintHighlights(
	hint: SudokuHint | null,
	level: 1 | 2 | 3,
): HintHighlights | undefined {
	if (!hint || level === 1) {
		return undefined;
	}
	const cells = new Set(hint.cells);
	const lines = new Set<number>();
	if (level === 3 && hint.colors) {
		const tones: [Set<number>, Set<number>] = [
			new Set(hint.colors[0]),
			new Set(hint.colors[1]),
		];
		const toned = (cell: number) => tones[0].has(cell) || tones[1].has(cell);
		const changed = [
			...hint.eliminations.map((entry) => entry.cell),
			...hint.placements.map((entry) => entry.cell),
		];
		return {
			cells: new Set(changed.filter((cell) => !toned(cell))),
			lines,
			tones,
		};
	}
	if (level === 3) {
		for (const entry of hint.eliminations) {
			cells.add(entry.cell);
		}
		for (const entry of hint.placements) {
			cells.add(entry.cell);
		}
		for (const ref of [...(hint.baseLines ?? []), ...(hint.coverLines ?? [])]) {
			for (const cell of unitCells(ref)) {
				if (!cells.has(cell)) {
					lines.add(cell);
				}
			}
		}
	}
	return { cells, lines };
}
