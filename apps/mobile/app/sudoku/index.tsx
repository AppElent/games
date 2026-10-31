import { Stack } from "expo-router";
import { SudokuHomeScreen } from "../../src/features/sudoku/home/sudoku-home-screen";
import { useI18n } from "../../src/i18n";

export default function SudokuRoute() {
	const { t } = useI18n();
	return (
		<>
			<Stack.Screen options={{ title: t.sudoku.title }} />
			<SudokuHomeScreen />
		</>
	);
}
