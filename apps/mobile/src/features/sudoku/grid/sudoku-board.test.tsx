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
	key: keyof typeof darkColors,
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

	it("keeps the colour mark and rings a marked hint cell and hint line", async () => {
		const colors = new Array(81).fill(0);
		colors[0] = 2;
		colors[1] = 2;
		await renderScreen(
			<SudokuBoard
				board={createBoardState(new Array(81).fill(0), { colors })}
				size={360}
				selectedCell={null}
				onSelectCell={() => {}}
				onDeselect={() => {}}
				conflicts={new Set()}
				hintCells={new Set([0, 2])}
				hintLines={new Set([1, 3])}
				hidden={false}
				mode="digit"
				cornerLayout="spread"
				canCycle={false}
			/>,
		);
		const hint = stylesIn(/^Row 1, column 1,/);
		expect(uses(hint, "borderColor", "orange", { borderWidth: 3 })).toBe(true);
		expect(uses(hint, "backgroundColor", "orangeDim")).toBe(false);
		const line = stylesIn(/^Row 1, column 2,/);
		expect(uses(line, "borderColor", "amberMark", { borderWidth: 2 })).toBe(
			true,
		);
		expect(uses(line, "backgroundColor", "amberDim")).toBe(false);
		// Unmarked hint cells and hint lines keep their fills, with no ring.
		const plainHint = stylesIn(/^Row 1, column 3,/);
		expect(uses(plainHint, "backgroundColor", "orangeDim")).toBe(true);
		expect(uses(plainHint, "borderColor", "orange")).toBe(false);
		const plainLine = stylesIn(/^Row 1, column 4,/);
		expect(uses(plainLine, "backgroundColor", "amberDim")).toBe(true);
		expect(uses(plainLine, "borderColor", "amberMark")).toBe(false);
	});
});
