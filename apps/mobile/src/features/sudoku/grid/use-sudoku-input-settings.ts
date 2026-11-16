/**
 * This phone's Sudoku input settings (tap cycle, corner-note layout). They
 * are a player's habit rather than part of a puzzle, so they live in their
 * own store entry instead of each save.
 */
import {
	DEFAULT_SUDOKU_INPUT_SETTINGS,
	normalizeSudokuInputSettings,
	type SudokuInputSettings,
} from "@arcadeclub/core/sudoku-input";
import { useCallback, useState } from "react";
import {
	readJson,
	STORAGE_KEYS,
	writeJson,
} from "../../../storage/local-store";

export function readSudokuInputSettings(): SudokuInputSettings {
	return (
		readJson(STORAGE_KEYS.sudokuInputSettings, normalizeSudokuInputSettings) ??
		DEFAULT_SUDOKU_INPUT_SETTINGS
	);
}

export function useSudokuInputSettings() {
	const [settings, setSettings] = useState(readSudokuInputSettings);
	const change = useCallback((next: SudokuInputSettings) => {
		setSettings(next);
		writeJson(STORAGE_KEYS.sudokuInputSettings, next);
	}, []);
	return [settings, change] as const;
}
