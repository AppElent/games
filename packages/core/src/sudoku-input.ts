/**
 * How a player enters things on a Sudoku board, beyond the board itself:
 * which entry modes a second tap on the selected cell steps through, and
 * where corner notes sit in a cell. The web and the phone app keep these per
 * device and read them back through `normalizeSudokuInputSettings`.
 */
import { digitsInMask } from "./sudoku";
import type { SudokuInputMode } from "./sudoku-board";

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
};

export const DEFAULT_SUDOKU_INPUT_SETTINGS: SudokuInputSettings = {
	tapCycle: { corner: true, center: true, color: true },
	cornerLayout: "spread",
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
	return {
		tapCycle,
		cornerLayout: cornerLayout ?? DEFAULT_SUDOKU_INPUT_SETTINGS.cornerLayout,
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
 * group, which a board wraps onto a second line in a small cell.
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
