import { useLocalSearchParams } from "expo-router";
import { SudokuPlayScreen } from "../../src/features/sudoku/play/sudoku-play-screen";

export default function SudokuPlayRoute() {
	const { id } = useLocalSearchParams<{ id: string }>();
	return <SudokuPlayScreen key={id} id={id} />;
}
