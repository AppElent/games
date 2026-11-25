// @vitest-environment jsdom
import { DEFAULT_SUDOKU_INPUT_SETTINGS } from "@arcadeclub/core/sudoku-input";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	loadSudokuInputSettings,
	saveSudokuInputSettings,
} from "#/lib/games/sudoku-input-settings";

const KEY = "arcade-club.sudoku.input-settings";

/** A fresh localStorage per test; newer Node ships an empty global one that hides jsdom's. */
function memoryStorage(): Storage {
	const items = new Map<string, string>();
	return {
		get length() {
			return items.size;
		},
		clear: () => items.clear(),
		getItem: (key) => items.get(key) ?? null,
		key: (index) => [...items.keys()][index] ?? null,
		removeItem: (key) => {
			items.delete(key);
		},
		setItem: (key, value) => {
			items.set(key, value);
		},
	};
}

describe("sudoku input settings store", () => {
	beforeEach(() => vi.stubGlobal("localStorage", memoryStorage()));
	afterEach(() => vi.unstubAllGlobals());

	it("starts from the defaults", () => {
		expect(loadSudokuInputSettings()).toEqual(DEFAULT_SUDOKU_INPUT_SETTINGS);
	});

	it("reads back what was saved", () => {
		const settings = {
			tapCycle: { corner: true, center: false, color: false },
			cornerLayout: "topRight" as const,
			hintsUpTo: "intermediate" as const,
			showHintLevel: false,
		};
		saveSudokuInputSettings(settings);
		expect(loadSudokuInputSettings()).toEqual(settings);
	});

	it("falls back to the defaults for a corrupt value", () => {
		window.localStorage.setItem(KEY, "{not json");
		expect(loadSudokuInputSettings()).toEqual(DEFAULT_SUDOKU_INPUT_SETTINGS);
	});

	it("fills in fields an older value lacks", () => {
		window.localStorage.setItem(
			KEY,
			JSON.stringify({ cornerLayout: "topRight" }),
		);
		expect(loadSudokuInputSettings()).toEqual({
			...DEFAULT_SUDOKU_INPUT_SETTINGS,
			cornerLayout: "topRight",
		});
	});
});
