// @vitest-environment jsdom
import { createBoardState } from "@arcadeclub/core/sudoku-board";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LocaleProvider } from "#/lib/i18n";
import { SudokuBoard } from "../SudokuBoard";

/** A board whose first cell carries colour mark 2 (emerald). */
function markedBoard() {
	const colors = new Array(81).fill(0);
	colors[0] = 2;
	return createBoardState(new Array(81).fill(0), { colors });
}

function cellAt(col: number) {
	return screen.getByRole("button", { name: `Row 1, column ${col}` });
}

describe("SudokuBoard chain tones", () => {
	afterEach(cleanup);

	it("keeps the colour mark and rings the tone on a marked chain cell", () => {
		render(
			<LocaleProvider initialLocale="en">
				<SudokuBoard
					board={markedBoard()}
					selectedCell={null}
					hintTones={[new Set([0]), new Set([1])]}
				/>
			</LocaleProvider>,
		);
		const marked = cellAt(1).className;
		expect(marked).toContain("bg-emerald-500/40");
		expect(marked).toContain("inset-ring-emerald-700");
		expect(marked).not.toContain("bg-emerald-300/50");
		expect(marked).not.toContain("inset-ring-slate-600");
		// An unmarked chain cell keeps the tone as its fill.
		const plain = cellAt(2).className;
		expect(plain).toContain("bg-pink-300/50");
		expect(plain).not.toContain("inset-ring-pink-700");
	});

	it("keeps the colour mark and rings a marked hint cell and hint line", () => {
		const colors = new Array(81).fill(0);
		colors[0] = 2;
		colors[1] = 2;
		render(
			<LocaleProvider initialLocale="en">
				<SudokuBoard
					board={createBoardState(new Array(81).fill(0), { colors })}
					selectedCell={null}
					hintCells={new Set([0, 2])}
					hintLines={new Set([1, 3])}
				/>
			</LocaleProvider>,
		);
		const hint = cellAt(1).className;
		expect(hint).toContain("bg-emerald-500/40");
		expect(hint).toContain("inset-ring-amber-700");
		expect(hint).not.toContain("bg-amber-300");
		const line = cellAt(2).className;
		expect(line).toContain("bg-emerald-500/40");
		expect(line).toContain("inset-ring-amber-600");
		expect(line).not.toContain("bg-amber-300");
		// Unmarked hint cells and hint lines keep their fills, with no ring.
		expect(cellAt(3).className).toContain("bg-amber-300/50");
		expect(cellAt(3).className).not.toContain("inset-ring-amber");
		expect(cellAt(4).className).toContain("bg-amber-300/20");
		expect(cellAt(4).className).not.toContain("inset-ring-amber");
	});
});
