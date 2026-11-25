/**
 * How a player enters things on a Sudoku board, beyond the board itself:
 * which entry modes a second tap on the selected cell steps through, where
 * corner notes sit in a cell, and how far hints go. The web and the phone app keep these per
 * device and read them back through `normalizeSudokuInputSettings`.
 */
import { digitsInMask } from "./sudoku";
import type { SudokuInputMode } from "./sudoku-board";
import { HINT_LEVELS, type HintTechniqueLevel } from "./sudoku-hints";

/** Every entry mode, in toolbar and tap-cycle order. */
export const SUDOKU_INPUT_MODES = [
	"digit",
	"corner",
	"center",
	"color",
] as const satisfies readonly SudokuInputMode[];

/** The modes a player can leave out of the tap cycle; digit is always in. */
export type SudokuCycleMode = Exclude<SudokuInputMode, "digit">;

export const SUDOKU_CYCLE_MODES = [
	"corner",
	"center",
	"color",
] as const satisfies readonly SudokuCycleMode[];

/**
 * `spread`: one digit per corner, then the edge midpoints.
 * `topRight`: every digit together in the top-right corner.
 */
export type CornerNoteLayout = "spread" | "topRight";

export const CORNER_NOTE_LAYOUTS = [
	"spread",
	"topRight",
] as const satisfies readonly CornerNoteLayout[];

export type SudokuInputSettings = {
	/** Whether each optional mode is part of the tap cycle. */
	tapCycle: Record<SudokuCycleMode, boolean>;
	cornerLayout: CornerNoteLayout;
	/** The hardest technique a hint may use before it asks first. */
	hintsUpTo: HintTechniqueLevel;
	/** Whether each hint card shows its level. */
	showHintLevel: boolean;
};

export const DEFAULT_SUDOKU_INPUT_SETTINGS: SudokuInputSettings = {
	tapCycle: { corner: true, center: true, color: true },
	cornerLayout: "spread",
	hintsUpTo: "advanced",
	showHintLevel: true,
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Settings from whatever storage held, field by field: an unknown or missing
 * field takes its default, so an old or corrupt value still yields usable
 * settings.
 */
export function normalizeSudokuInputSettings(
	value: unknown,
): SudokuInputSettings {
	const stored = isRecord(value) ? value : {};
	const cycle = isRecord(stored.tapCycle) ? stored.tapCycle : {};
	const tapCycle = { ...DEFAULT_SUDOKU_INPUT_SETTINGS.tapCycle };
	for (const mode of SUDOKU_CYCLE_MODES) {
		const flag = cycle[mode];
		if (typeof flag === "boolean") {
			tapCycle[mode] = flag;
		}
	}
	const cornerLayout = CORNER_NOTE_LAYOUTS.find(
		(layout) => layout === stored.cornerLayout,
	);
	const hintsUpTo = HINT_LEVELS.find((level) => level === stored.hintsUpTo);
	return {
		tapCycle,
		cornerLayout: cornerLayout ?? DEFAULT_SUDOKU_INPUT_SETTINGS.cornerLayout,
		hintsUpTo: hintsUpTo ?? DEFAULT_SUDOKU_INPUT_SETTINGS.hintsUpTo,
		showHintLevel:
			typeof stored.showHintLevel === "boolean"
				? stored.showHintLevel
				: DEFAULT_SUDOKU_INPUT_SETTINGS.showHintLevel,
	};
}

/** The modes a second tap steps through, in order; always starts with digit. */
export function tapCycleModes(
	settings: SudokuInputSettings,
): SudokuInputMode[] {
	return SUDOKU_INPUT_MODES.filter(
		(mode) => mode === "digit" || settings.tapCycle[mode],
	);
}

/**
 * The mode after `current` in the tap cycle, wrapping back to digit. A mode
 * picked from the toolbar but left out of the cycle moves on to the next
 * mode that is in it. With only digit in the cycle, digit stays digit.
 */
export function nextTapMode(
	current: SudokuInputMode,
	settings: SudokuInputSettings,
): SudokuInputMode {
	const start = SUDOKU_INPUT_MODES.indexOf(current);
	for (let step = 1; step <= SUDOKU_INPUT_MODES.length; step += 1) {
		const mode = SUDOKU_INPUT_MODES[(start + step) % SUDOKU_INPUT_MODES.length];
		if (mode === "digit" || settings.tapCycle[mode]) {
			return mode;
		}
	}
	return "digit";
}

/** Where a group of corner notes sits in its cell. */
export type CornerNoteSlot =
	| "topLeft"
	| "topRight"
	| "bottomLeft"
	| "bottomRight"
	| "top"
	| "bottom"
	| "left"
	| "right";

/** The spread layout fills corners first, then the edge midpoints. */
const SPREAD_SLOTS: readonly CornerNoteSlot[] = [
	"topLeft",
	"topRight",
	"bottomLeft",
	"bottomRight",
	"top",
	"bottom",
	"left",
	"right",
];

export type CornerNoteGroup = { slot: CornerNoteSlot; digits: number[] };

/**
 * A cell's corner notes (a digit bitmask) as groups to draw, in ascending
 * digit order. Spread gives each digit its own slot; nine notes share the
 * last slot so none is drawn over another. Top-right puts them all in one
 * group, which a board draws as one line that shrinks to fit the cell.
 */
export function cornerNoteGroups(
	mask: number,
	layout: CornerNoteLayout,
): CornerNoteGroup[] {
	const digits = digitsInMask(mask);
	if (digits.length === 0) {
		return [];
	}
	if (layout === "topRight") {
		return [{ slot: "topRight", digits }];
	}
	const last = SPREAD_SLOTS.length - 1;
	return SPREAD_SLOTS.slice(
		0,
		Math.min(digits.length, SPREAD_SLOTS.length),
	).map((slot, index) => ({
		slot,
		digits: index === last ? digits.slice(last) : [digits[index]],
	}));
}

/**
 * A second tap this soon after a cell became selected, or after a tap on it
 * switched mode, is the second half of one double tap, not another request to
 * switch mode: a quick double tap on a new cell never leaves the next digit
 * entered as a note, and a double-click never switches mode twice. The caller
 * stamps `selectedAt` on both.
 */
export const RETAP_GRACE_MS = 300;

/** Whether a tap on `cell` should step to the next entry mode. */
export function isModeCycleTap(
	cell: number,
	selection: { cell: number | null; selectedAt: number },
	now: number,
): boolean {
	return (
		cell === selection.cell && now - selection.selectedAt >= RETAP_GRACE_MS
	);
}

/** The selected cell and when it was last picked or switched mode. */
export type CellSelection = { cell: number | null; selectedAt: number };

/**
 * What a tap on `cell` does and the selection after it: `select` moves the
 * selection to the cell, `cycle` steps to the next entry mode, `none` is the
 * second half of a double tap or a tap on a cell that is already selected.
 * Both clients keep the returned selection (the phone updates it in place, as
 * a second tap can land before a re-render), so a double tap does one thing.
 */
export function tapCell(
	selection: CellSelection,
	cell: number,
	now: number,
): { action: "select" | "cycle" | "none"; selection: CellSelection } {
	if (cell !== selection.cell) {
		return { action: "select", selection: { cell, selectedAt: now } };
	}
	if (isModeCycleTap(cell, selection, now)) {
		return { action: "cycle", selection: { cell, selectedAt: now } };
	}
	return { action: "none", selection };
}
