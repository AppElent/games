import type { SUDOKU_STATUSES } from "@arcadeclub/core/sudoku";

/** Where a puzzle on this phone stands; the clock runs only while `active`. */
export type SudokuStatus = (typeof SUDOKU_STATUSES)[number];
