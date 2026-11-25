import { DEFAULT_SUDOKU_INPUT_SETTINGS } from "@arcadeclub/core/sudoku-input";
import {
	remove,
	STORAGE_KEYS,
	writeJson,
	writeText,
} from "../../../storage/local-store";
import { readSudokuInputSettings } from "./use-sudoku-input-settings";

describe("sudoku input settings", () => {
	beforeEach(() => remove(STORAGE_KEYS.sudokuInputSettings));

	it("starts from the defaults", () => {
		expect(readSudokuInputSettings()).toEqual(DEFAULT_SUDOKU_INPUT_SETTINGS);
	});

	it("reads back what was stored", () => {
		const settings = {
			tapCycle: { corner: false, center: true, color: false },
			cornerLayout: "topRight" as const,
			hintsUpTo: "intermediate" as const,
			showHintLevel: false,
		};
		writeJson(STORAGE_KEYS.sudokuInputSettings, settings);
		expect(readSudokuInputSettings()).toEqual(settings);
	});

	it("falls back to the defaults for a corrupt value", () => {
		writeText(STORAGE_KEYS.sudokuInputSettings, "{not json");
		expect(readSudokuInputSettings()).toEqual(DEFAULT_SUDOKU_INPUT_SETTINGS);
	});
});
