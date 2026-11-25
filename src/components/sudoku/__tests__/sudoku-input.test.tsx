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
		expect(groups[0].className).toContain("top-0");
		expect(groups[0].className).toContain("text-right");
		// One line that shrinks with the cell, so it stays clear of center notes.
		expect(groups[0].className).toContain("whitespace-nowrap");
		expect(groups[0].textContent).toBe("147");
	});

	it("frames the selected cell outside digit mode only", () => {
		const board = createBoardState(new Array(81).fill(0));
		const { rerender } = inEnglish(
			<SudokuBoard board={board} selectedCell={0} mode="digit" />,
		);
		expect(firstCell().className).not.toContain("inset-ring-2");
		rerender(
			<LocaleProvider initialLocale="en">
				<SudokuBoard board={board} selectedCell={0} mode="corner" />
			</LocaleProvider>,
		);
		expect(firstCell().className).toContain("inset-ring-2");
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

	it("sets how far hints go and hides the level badge", () => {
		const onChange = renderPanel();
		expect(
			(screen.getByRole("radio", { name: /^Advanced/ }) as HTMLInputElement)
				.checked,
		).toBe(true);
		fireEvent.click(screen.getByRole("radio", { name: /^Intermediate/ }));
		expect(onChange).toHaveBeenCalledWith({
			...DEFAULT_SUDOKU_INPUT_SETTINGS,
			hintsUpTo: "intermediate",
		});
		fireEvent.click(
			screen.getByRole("checkbox", { name: "Show the level on each hint" }),
		);
		expect(onChange).toHaveBeenCalledWith({
			...DEFAULT_SUDOKU_INPUT_SETTINGS,
			showHintLevel: false,
		});
	});
});

describe("SudokuBoard edges and fills", () => {
	afterEach(cleanup);

	const cell = (row: number, col: number) =>
		screen.getByRole("button", { name: `Row ${row}, column ${col}` });
	const fills = (el: HTMLElement) =>
		el.className.split(/\s+/).filter((c) => /(^|:)bg-/.test(c));
	const empty = () => createBoardState(new Array(81).fill(0));

	it("leaves the outer edge to the board's own border", () => {
		inEnglish(<SudokuBoard board={empty()} selectedCell={null} />);
		const board = cell(1, 1).parentElement as HTMLElement;
		expect(board.className).toContain("border-2");
		for (const i of [1, 5, 9]) {
			expect(cell(1, i).className).not.toMatch(/\bborder-t/);
			expect(cell(i, 1).className).not.toMatch(/\bborder-l/);
			expect(cell(9, i).className).not.toMatch(/\bborder-b/);
			expect(cell(i, 9).className).not.toMatch(/\bborder-r/);
		}
		// Box and cell lines inside are still drawn.
		expect(cell(4, 4).className).toContain("border-l-2");
		expect(cell(4, 4).className).toContain("border-t-2");
		expect(cell(5, 5).className).toContain("border-l-[var(--puzzle-line)]");
	});

	it("keeps a selected marked cell distinguishable from a marked one in digit mode", () => {
		const board = empty();
		board.colors[0] = 1;
		board.colors[1] = 1;
		inEnglish(<SudokuBoard board={board} selectedCell={0} mode="digit" />);
		// Same mark, but the selected cell carries the selected fill, not the mark's.
		expect(fills(cell(1, 1))).toEqual(["bg-sky-300/60", "dark:bg-sky-400/30"]);
		expect(fills(cell(1, 2))).toEqual(["bg-sky-500/40"]);
		expect(fills(cell(1, 1))).not.toEqual(fills(cell(1, 2)));
	});

	it("gives a cell one fill: a mark beats hint, same-digit and peer", () => {
		const board = empty();
		board.colors[1] = 2; // hinted and marked
		board.colors[2] = 3; // a peer of the selected cell, marked
		inEnglish(
			<SudokuBoard board={board} selectedCell={0} hintCells={new Set([1])} />,
		);
		expect(fills(cell(1, 2))).toEqual(["bg-emerald-500/40"]);
		expect(fills(cell(1, 3))).toEqual(["bg-amber-500/40"]);
		// A peer with no mark keeps the peer fill.
		expect(fills(cell(1, 4))).toEqual(["bg-slate-200", "dark:bg-slate-700/40"]);
	});

	it("keeps the selected state's fill on an unmarked cell", () => {
		inEnglish(<SudokuBoard board={empty()} selectedCell={0} />);
		expect(fills(cell(1, 1))).toEqual(["bg-sky-300/60", "dark:bg-sky-400/30"]);
	});
});
