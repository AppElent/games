import { sudoku } from "@arcadeclub/core/i18n/en/games/sudoku";
import {
	createBoardState,
	serializeBoard,
} from "@arcadeclub/core/sudoku-board";
import { describeHint, type SudokuHint } from "@arcadeclub/core/sudoku-hints";
import {
	DEFAULT_SUDOKU_INPUT_SETTINGS,
	type SudokuInputSettings,
} from "@arcadeclub/core/sudoku-input";
import { fireEvent, screen } from "@testing-library/react-native";
import { renderScreen } from "../../../../test/render-screen";
import { remove, STORAGE_KEYS, writeJson } from "../../../storage/local-store";
import type { GridSave } from "../saves/sudoku-save-store";
import { SudokuGameScreen } from "./sudoku-game-screen";

// What the next Hint press finds; null when no technique applies.
let mockFound: SudokuHint | null = null;
jest.mock("@arcadeclub/core/sudoku-hints", () => ({
	...jest.requireActual("@arcadeclub/core/sudoku-hints"),
	findHint: () => mockFound,
}));

const save: GridSave = {
	id: "hint-card",
	difficulty: "easy",
	updatedAt: 1,
	elapsedSeconds: 0,
	status: "active",
	variant: "classic",
	board: serializeBoard(createBoardState(new Array(81).fill(0))),
	solution: "1".repeat(81),
	autoCleanup: true,
};

const single: SudokuHint = {
	technique: "naked-single",
	level: "intermediate",
	cells: [0],
	candidateDigits: [5],
	eliminations: [],
	placements: [{ cell: 0, digit: 5 }],
};
const badge = sudoku.inputSettings.hintLevels.intermediate;

async function pressHint(settings?: Partial<SudokuInputSettings>) {
	if (settings) {
		writeJson(STORAGE_KEYS.sudokuInputSettings, {
			...DEFAULT_SUDOKU_INPUT_SETTINGS,
			...settings,
		});
	}
	await renderScreen(<SudokuGameScreen save={save} />);
	await fireEvent.press(screen.getByLabelText(sudoku.keypad.hint));
}

describe("sudoku hint card", () => {
	beforeEach(() => {
		mockFound = null;
		remove(STORAGE_KEYS.sudokuInputSettings);
	});

	it("shows the hint's level", async () => {
		mockFound = single;
		await pressHint();
		expect(
			screen.getByText(describeHint(single, 1, sudoku.hints).text),
		).toBeTruthy();
		expect(screen.getByText(badge)).toBeTruthy();
	});

	it("hides the level for a mistake", async () => {
		const mistake: SudokuHint = { ...single, technique: "mistake" };
		mockFound = mistake;
		await pressHint();
		expect(
			screen.getByText(describeHint(mistake, 1, sudoku.hints).text),
		).toBeTruthy();
		expect(screen.queryByText(badge)).toBeNull();
	});

	it("hides the level when the setting is off", async () => {
		mockFound = single;
		await pressHint({ showHintLevel: false });
		expect(
			screen.getByText(describeHint(single, 1, sudoku.hints).text),
		).toBeTruthy();
		expect(screen.queryByText(badge)).toBeNull();
	});

	it("says so when no step is found", async () => {
		await pressHint();
		expect(screen.getByText(sudoku.game.noHint)).toBeTruthy();
		expect(screen.queryByText(badge)).toBeNull();
	});
});
