import { sudoku } from "@arcadeclub/core/i18n/en/games/sudoku";
import {
	DEFAULT_SUDOKU_INPUT_SETTINGS,
	type SudokuInputSettings,
} from "@arcadeclub/core/sudoku-input";
import { fireEvent, screen } from "@testing-library/react-native";
import { renderScreen } from "../../../../test/render-screen";
import { SudokuInputSettingsPanel } from "./sudoku-input-settings-panel";

const copy = sudoku.inputSettings;

async function openPanel(settings: SudokuInputSettings) {
	const onChange = jest.fn();
	await renderScreen(
		<SudokuInputSettingsPanel settings={settings} onChange={onChange} />,
	);
	await fireEvent.press(screen.getByTestId("sudoku-input-settings"));
	return onChange;
}

describe("sudoku hint settings", () => {
	it("lists every level, with the current maximum selected", async () => {
		await openPanel({
			...DEFAULT_SUDOKU_INPUT_SETTINGS,
			hintsUpTo: "advanced",
		});
		for (const level of ["beginner", "intermediate", "advanced", "expert"]) {
			const choice = screen.getByTestId(`sudoku-hints-up-to-${level}`);
			expect(choice.props.accessibilityState).toEqual({
				selected: level === "advanced",
			});
		}
		expect(screen.getByLabelText(copy.hintsUpToLabel)).toBeTruthy();
	});

	it("sets how far hints go", async () => {
		const onChange = await openPanel(DEFAULT_SUDOKU_INPUT_SETTINGS);
		await fireEvent.press(
			screen.getByTestId("sudoku-hints-up-to-intermediate"),
		);
		expect(onChange).toHaveBeenCalledWith({
			...DEFAULT_SUDOKU_INPUT_SETTINGS,
			hintsUpTo: "intermediate",
		});
	});

	it("switches the level on each hint", async () => {
		const onChange = await openPanel(DEFAULT_SUDOKU_INPUT_SETTINGS);
		const toggle = screen.getByTestId("sudoku-show-hint-level");
		expect(toggle.props.value).toBe(true);
		expect(screen.getByLabelText(copy.showHintLevel)).toBe(toggle);
		await fireEvent(toggle, "valueChange", false);
		expect(onChange).toHaveBeenCalledWith({
			...DEFAULT_SUDOKU_INPUT_SETTINGS,
			showHintLevel: false,
		});
	});
});
