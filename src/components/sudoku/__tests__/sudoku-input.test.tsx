// @vitest-environment jsdom
import { digitMask } from "@arcadeclub/core/sudoku";
import { createBoardState } from "@arcadeclub/core/sudoku-board";
import {
	DEFAULT_SUDOKU_INPUT_SETTINGS,
	type SudokuInputSettings,
} from "@arcadeclub/core/sudoku-input";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "#/lib/i18n";
import { SudokuBoard } from "../SudokuBoard";
import { SudokuInputSettingsPanel } from "../SudokuInputSettingsPanel";

function inEnglish(node: ReactNode) {
	return render(<LocaleProvider initialLocale="en">{node}</LocaleProvider>);
}

/** A board whose first cell holds corner notes 1, 4 and 7. */
function notedBoard() {
	const corner = new Array(81).fill(0);
	corner[0] = digitMask(1) | digitMask(4) | digitMask(7);
	return createBoardState(new Array(81).fill(0), { corner });
}

function firstCell() {
	return screen.getByRole("button", { name: "Row 1, column 1" });
}

describe("SudokuBoard corner notes", () => {
	afterEach(cleanup);

	it("spreads notes over the corners by default", () => {
		inEnglish(<SudokuBoard board={notedBoard()} selectedCell={null} />);
		const groups = firstCell().querySelectorAll(":scope > span");
		expect([...groups].map((group) => group.textContent)).toEqual([
			"1",
			"4",
			"7",
		]);
		expect(groups[0].className).toContain("left-0.5 top-0");
		expect(groups[1].className).toContain("right-0.5 top-0");
		expect(groups[2].className).toContain("left-0.5 bottom-0");
	});

	it("gathers every note in the top-right corner", () => {
		inEnglish(
			<SudokuBoard
				board={notedBoard()}
				selectedCell={null}
				cornerLayout="topRight"
			/>,
		);
		const groups = firstCell().querySelectorAll(":scope > span");
		expect(groups).toHaveLength(1);
		expect(groups[0].className).toContain("right-0.5 top-0");
		expect(groups[0].className).toContain("flex-wrap");
		expect(groups[0].textContent).toBe("147");
	});

	it("frames the selected cell outside digit mode only", () => {
		const board = createBoardState(new Array(81).fill(0));
		const { rerender } = inEnglish(
			<SudokuBoard board={board} selectedCell={0} mode="digit" />,
		);
		expect(firstCell().querySelector(".border-dashed")).toBeNull();
		rerender(
			<LocaleProvider initialLocale="en">
				<SudokuBoard board={board} selectedCell={0} mode="corner" />
			</LocaleProvider>,
		);
		expect(firstCell().querySelector(".border-dashed")).not.toBeNull();
	});
});

describe("SudokuInputSettingsPanel", () => {
	afterEach(cleanup);

	function renderPanel(
		settings: SudokuInputSettings = DEFAULT_SUDOKU_INPUT_SETTINGS,
	) {
		const onChange = vi.fn();
		inEnglish(
			<SudokuInputSettingsPanel settings={settings} onChange={onChange} />,
		);
		return onChange;
	}

	it("takes a mode out of the tap cycle", () => {
		const onChange = renderPanel();
		fireEvent.click(screen.getByRole("checkbox", { name: "Colors" }));
		expect(onChange).toHaveBeenCalledWith({
			...DEFAULT_SUDOKU_INPUT_SETTINGS,
			tapCycle: { corner: true, center: true, color: false },
		});
	});

	it("switches the corner-note layout", () => {
		const onChange = renderPanel();
		expect(
			(screen.getByRole("radio", { name: "All corners" }) as HTMLInputElement)
				.checked,
		).toBe(true);
		fireEvent.click(screen.getByRole("radio", { name: "Top right" }));
		expect(onChange).toHaveBeenCalledWith({
			...DEFAULT_SUDOKU_INPUT_SETTINGS,
			cornerLayout: "topRight",
		});
	});
});
