import {
	DEFAULT_SUDOKU_INPUT_SETTINGS,
	normalizeSudokuInputSettings,
	type SudokuInputSettings,
} from "@arcadeclub/core/sudoku-input";
import { readStored, writeJson } from "#/lib/games/local-store";

/**
 * This browser's Sudoku input settings (tap cycle, corner-note layout). They
 * are a player's habit rather than part of a puzzle, so they stay with the
 * device instead of each saved board.
 */
const KEY = "arcade-club.sudoku.input-settings";

export function loadSudokuInputSettings(): SudokuInputSettings {
	return readStored(
		KEY,
		(raw) => normalizeSudokuInputSettings(JSON.parse(raw)),
		DEFAULT_SUDOKU_INPUT_SETTINGS,
	);
}

export function saveSudokuInputSettings(settings: SudokuInputSettings) {
	writeJson(KEY, settings);
}
