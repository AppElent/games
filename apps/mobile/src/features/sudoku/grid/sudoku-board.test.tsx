import { createBoardState } from "@arcadeclub/core/sudoku-board";
import { screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { renderScreen } from "../../../../test/render-screen";
import { darkColors, lightColors } from "../../../theme/tokens";
import { SudokuBoard } from "./sudoku-board";

/** A board whose first cell carries colour mark 2. */
function markedBoard() {
	const colors = new Array(81).fill(0);
	colors[0] = 2;
	return createBoardState(new Array(81).fill(0), { colors });
}

/** The styles of a cell's descendants, flattened. */
function stylesIn(label: RegExp) {
	const out: Record<string, unknown>[] = [];
	const walk = (node: unknown) => {
		if (!node || typeof node !== "object") return;
		const element = node as {
			props?: { style?: unknown };
			children?: unknown[];
		};
		out.push(StyleSheet.flatten(element.props?.style as never) ?? {});
		for (const child of element.children ?? []) walk(child);
	};
	walk(screen.getByLabelText(label));
	return out;
}

/** Whether a style uses a token in whichever theme the test renders. */
function uses(
	styles: Record<string, unknown>[],
	prop: string,
	key: "green" | "greenDim" | "pinkDim",
	extra: Record<string, unknown> = {},
) {
	return styles.some(
		(style) =>
			(style[prop] === darkColors[key] || style[prop] === lightColors[key]) &&
			Object.entries(extra).every(([name, value]) => style[name] === value),
	);
}

describe("SudokuBoard chain tones", () => {
	it("keeps the colour mark and rings the tone on a marked chain cell", async () => {
		await renderScreen(
			<SudokuBoard
				board={markedBoard()}
				size={360}
				selectedCell={null}
				onSelectCell={() => {}}
				onDeselect={() => {}}
				conflicts={new Set()}
				hintCells={undefined}
				hintTones={[new Set([0]), new Set([1])]}
				hidden={false}
				mode="digit"
				cornerLayout="spread"
				canCycle={false}
			/>,
		);
		const marked = stylesIn(/^Row 1, column 1,/);
		expect(uses(marked, "borderColor", "green", { borderWidth: 3 })).toBe(true);
		expect(uses(marked, "backgroundColor", "greenDim")).toBe(false);
		// An unmarked chain cell keeps the tone as its fill, with no ring.
		const plain = stylesIn(/^Row 1, column 2,/);
		expect(uses(plain, "backgroundColor", "pinkDim")).toBe(true);
		expect(plain.some((style) => style.borderWidth === 3)).toBe(false);
	});
});
