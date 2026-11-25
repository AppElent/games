import {
	createBoardState,
	serializeBoard,
} from "@arcadeclub/core/sudoku-board";
import {
	DEFAULT_SUDOKU_INPUT_SETTINGS,
	RETAP_GRACE_MS,
	type SudokuInputSettings,
} from "@arcadeclub/core/sudoku-input";
import { act, renderHook } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { LocaleProvider } from "../../../i18n";
import { type GridSave, isSudokuSaveOpen } from "../saves/sudoku-save-store";
import { useSudokuGame } from "./use-sudoku-game";

const save: GridSave = {
	id: "tap-test",
	difficulty: "easy",
	updatedAt: 1,
	elapsedSeconds: 0,
	status: "active",
	variant: "classic",
	board: serializeBoard(createBoardState(new Array(81).fill(0))),
	solution: "1".repeat(81),
	autoCleanup: true,
};

function wrapper({ children }: { children: ReactNode }) {
	return <LocaleProvider>{children}</LocaleProvider>;
}

async function setup(
	settings: SudokuInputSettings = DEFAULT_SUDOKU_INPUT_SETTINGS,
) {
	return renderHook(() => useSudokuGame(save, settings), { wrapper });
}

type Hook = Awaited<ReturnType<typeof setup>>["result"];

describe("sudoku game screen", () => {
	it("counts its save as open while mounted", async () => {
		const { unmount } = await setup();
		expect(isSudokuSaveOpen(save.id)).toBe(true);
		await act(async () => unmount());
		expect(isSudokuSaveOpen(save.id)).toBe(false);
	});
});

describe("sudoku cell taps", () => {
	let now = 10_000;
	beforeEach(() => {
		now = 10_000;
		jest.spyOn(Date, "now").mockImplementation(() => now);
	});
	afterEach(() => jest.restoreAllMocks());

	/** A tap `later` ms after the previous one. */
	async function tap(result: Hook, cell: number, later = RETAP_GRACE_MS) {
		now += later;
		await act(async () => result.current.selectCell(cell));
	}

	it("selects a cell on the first tap", async () => {
		const { result } = await setup();
		await tap(result, 4);
		expect(result.current.selectedCell).toBe(4);
		expect(result.current.mode).toBe("digit");
	});

	it("steps to the next mode on a later tap on the selected cell", async () => {
		const { result } = await setup();
		await tap(result, 4);
		await tap(result, 4);
		expect(result.current.mode).toBe("corner");
		await tap(result, 4);
		expect(result.current.mode).toBe("center");
	});

	it("treats a quick second tap on a new cell as one double tap", async () => {
		const { result } = await setup();
		await tap(result, 4);
		await tap(result, 4, RETAP_GRACE_MS - 1);
		expect(result.current.selectedCell).toBe(4);
		expect(result.current.mode).toBe("digit");
	});

	it("switches mode once when a switching tap is double-tapped", async () => {
		const { result } = await setup();
		await tap(result, 4);
		await tap(result, 4);
		expect(result.current.mode).toBe("corner");
		await tap(result, 4, 50);
		expect(result.current.mode).toBe("corner");
	});

	it("moves the selection without changing mode when another cell is tapped", async () => {
		const { result } = await setup();
		await tap(result, 4);
		await tap(result, 4);
		await tap(result, 5);
		expect(result.current.selectedCell).toBe(5);
		expect(result.current.mode).toBe("corner");
	});

	it("leaves the mode alone when nothing but digit is in the cycle", async () => {
		const { result } = await setup({
			...DEFAULT_SUDOKU_INPUT_SETTINGS,
			tapCycle: { corner: false, center: false, color: false },
		});
		await tap(result, 4);
		await tap(result, 4);
		expect(result.current.mode).toBe("digit");
		expect(result.current.selectedCell).toBe(4);
	});

	it("deselects the selected cell on a press and hold", async () => {
		const { result } = await setup();
		await tap(result, 4);
		await act(async () => result.current.deselect());
		expect(result.current.selectedCell).toBeNull();
	});

	it("selects again after a deselect without switching mode", async () => {
		const { result } = await setup();
		await tap(result, 4);
		await act(async () => result.current.deselect());
		await tap(result, 4);
		expect(result.current.selectedCell).toBe(4);
		expect(result.current.mode).toBe("digit");
	});
});

describe("sudoku hints", () => {
	// A Classic board from a generated Expert puzzle where the next steps are
	// eliminations, not placements.
	const grid =
		"850760129962081057170295860347852916598617040621900785039106578086579031715008690";
	const hintSave: GridSave = {
		...save,
		id: "hint-test",
		board: serializeBoard(createBoardState([...grid].map(Number))),
		solution:
			"854763129962481357173295864347852916598617243621934785439126578286579431715348692",
	};

	it("moves on to a new hint once one was explained in full", async () => {
		const { result } = await renderHook(
			() => useSudokuGame(hintSave, DEFAULT_SUDOKU_INPUT_SETTINGS),
			{ wrapper },
		);
		await act(async () => result.current.requestHint());
		const first = result.current.hint;
		expect(first?.eliminations.length).toBeGreaterThan(0);
		await act(async () => result.current.requestHint());
		await act(async () => result.current.requestHint());
		expect(result.current.hintLevel).toBe(3);
		await act(async () => result.current.dismissHint());
		await act(async () => result.current.requestHint());
		expect(result.current.hint?.eliminations).not.toEqual(first?.eliminations);
	});

	it("repeats a hint that was dismissed before its explanation", async () => {
		const { result } = await renderHook(
			() => useSudokuGame(hintSave, DEFAULT_SUDOKU_INPUT_SETTINGS),
			{ wrapper },
		);
		await act(async () => result.current.requestHint());
		const first = result.current.hint;
		await act(async () => result.current.dismissHint());
		await act(async () => result.current.requestHint());
		expect(result.current.hint).toEqual(first);
	});
});
