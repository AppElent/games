import type { SudokuGrid } from "./sudoku";
import {
	digitMask,
	emptyGrid,
	findConflicts,
	isGridSolved,
	SUDOKU_CELL_COUNT,
	SUDOKU_PEERS,
	toggleDigitInMask,
} from "./sudoku";

/**
 * Board state for one Sudoku game. Notes are bitmasks (bit 0 = digit 1).
 * `colors` stores a palette index per cell, 0 = no highlight.
 */
export type SudokuBoardState = {
	givens: SudokuGrid;
	digits: SudokuGrid;
	corner: number[];
	center: number[];
	colors: number[];
};

export type SudokuInputMode = "digit" | "corner" | "center" | "color";

export type SudokuAction =
	| { type: "setDigit"; cell: number; digit: number }
	| { type: "toggleCorner"; cell: number; digit: number }
	| { type: "toggleCenter"; cell: number; digit: number }
	| { type: "setColor"; cell: number; color: number }
	| { type: "erase"; cell: number }
	| { type: "restart" };

export type SudokuHistory = {
	current: SudokuBoardState;
	past: SudokuBoardState[];
	future: SudokuBoardState[];
};

export const SUDOKU_COLOR_COUNT = 8;

export function createBoardState(
	givens: SudokuGrid,
	initial?: Partial<Omit<SudokuBoardState, "givens">>,
): SudokuBoardState {
	return {
		givens: [...givens],
		digits: initial?.digits ? [...initial.digits] : emptyGrid(),
		corner: initial?.corner
			? [...initial.corner]
			: new Array(SUDOKU_CELL_COUNT).fill(0),
		center: initial?.center
			? [...initial.center]
			: new Array(SUDOKU_CELL_COUNT).fill(0),
		colors: initial?.colors
			? [...initial.colors]
			: new Array(SUDOKU_CELL_COUNT).fill(0),
	};
}

export function createHistory(state: SudokuBoardState): SudokuHistory {
	return { current: state, past: [], future: [] };
}

function cloneState(state: SudokuBoardState): SudokuBoardState {
	return {
		givens: state.givens,
		digits: [...state.digits],
		corner: [...state.corner],
		center: [...state.center],
		colors: [...state.colors],
	};
}

/** Merged view: givens where present, otherwise user digits. */
export function effectiveGrid(state: SudokuBoardState): SudokuGrid {
	return state.givens.map((value, cell) =>
		value !== 0 ? value : state.digits[cell],
	);
}

export function boardConflicts(state: SudokuBoardState) {
	return findConflicts(effectiveGrid(state));
}

export function isBoardComplete(state: SudokuBoardState) {
	return isGridSolved(effectiveGrid(state));
}

export type SudokuActionOptions = {
	/** Strip the placed digit from peer notes after a digit entry. */
	autoCleanup?: boolean;
};

function reduceState(
	state: SudokuBoardState,
	action: SudokuAction,
	options: SudokuActionOptions,
): SudokuBoardState | null {
	switch (action.type) {
		case "setDigit": {
			if (state.givens[action.cell] !== 0) {
				return null;
			}
			const next = cloneState(state);
			const toggledOff = next.digits[action.cell] === action.digit;
			next.digits[action.cell] = toggledOff ? 0 : action.digit;
			if (!toggledOff) {
				next.corner[action.cell] = 0;
				next.center[action.cell] = 0;
				if (options.autoCleanup) {
					const mask = ~digitMask(action.digit);
					for (const peer of SUDOKU_PEERS[action.cell]) {
						next.corner[peer] &= mask;
						next.center[peer] &= mask;
					}
				}
			}
			return next;
		}
		case "toggleCorner":
		case "toggleCenter": {
			if (state.givens[action.cell] !== 0 || state.digits[action.cell] !== 0) {
				return null;
			}
			const next = cloneState(state);
			const target = action.type === "toggleCorner" ? next.corner : next.center;
			target[action.cell] = toggleDigitInMask(
				target[action.cell],
				action.digit,
			);
			return next;
		}
		case "setColor": {
			const next = cloneState(state);
			next.colors[action.cell] =
				next.colors[action.cell] === action.color ? 0 : action.color;
			return next;
		}
		case "erase": {
			if (state.givens[action.cell] !== 0) {
				return null;
			}
			const next = cloneState(state);
			if (next.digits[action.cell] !== 0) {
				next.digits[action.cell] = 0;
			} else if (
				next.corner[action.cell] !== 0 ||
				next.center[action.cell] !== 0
			) {
				next.corner[action.cell] = 0;
				next.center[action.cell] = 0;
			} else if (next.colors[action.cell] !== 0) {
				next.colors[action.cell] = 0;
			} else {
				return null;
			}
			return next;
		}
		case "restart": {
			return createBoardState(state.givens);
		}
	}
}

export function applyAction(
	history: SudokuHistory,
	action: SudokuAction,
	options: SudokuActionOptions = {},
): SudokuHistory {
	const next = reduceState(history.current, action, options);
	if (!next) {
		return history;
	}
	return {
		current: next,
		past: [...history.past, history.current],
		future: [],
	};
}

export function undo(history: SudokuHistory): SudokuHistory {
	const previous = history.past.at(-1);
	if (!previous) {
		return history;
	}
	return {
		current: previous,
		past: history.past.slice(0, -1),
		future: [history.current, ...history.future],
	};
}

export function redo(history: SudokuHistory): SudokuHistory {
	const [next, ...rest] = history.future;
	if (!next) {
		return history;
	}
	return {
		current: next,
		past: [...history.past, history.current],
		future: rest,
	};
}

export function canUndo(history: SudokuHistory) {
	return history.past.length > 0;
}

export function canRedo(history: SudokuHistory) {
	return history.future.length > 0;
}

// --- persistence (Convex-friendly compact shape) ---

export type SerializedSudokuBoard = {
	givens: string;
	digits: string;
	corner: number[];
	center: number[];
	colors: number[];
};

export function serializeBoard(state: SudokuBoardState): SerializedSudokuBoard {
	return {
		givens: state.givens.join(""),
		digits: state.digits.join(""),
		corner: [...state.corner],
		center: [...state.center],
		colors: [...state.colors],
	};
}

function parseDigitString(text: string): SudokuGrid {
	if (text.length !== SUDOKU_CELL_COUNT) {
		throw new Error(`Expected 81 characters, got ${text.length}`);
	}
	return [...text].map(Number);
}

export function deserializeBoard(
	data: SerializedSudokuBoard,
): SudokuBoardState {
	return {
		givens: parseDigitString(data.givens),
		digits: parseDigitString(data.digits),
		corner: [...data.corner],
		center: [...data.center],
		colors: [...data.colors],
	};
}
