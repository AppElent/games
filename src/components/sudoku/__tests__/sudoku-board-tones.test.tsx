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
});
