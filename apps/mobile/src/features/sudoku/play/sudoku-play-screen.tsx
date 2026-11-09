/**
 * Opens a saved puzzle by id and hands it to the screen for its variant.
 * The save is read once on mount; the game screens own it from there.
 */
import { useRouter } from "expo-router";
import { useState } from "react";
import { useI18n } from "../../../i18n";
import { CenteredState } from "../../../ui/centered-state";
import { BinaryGameScreen } from "../binary/binary-game-screen";
import { SudokuGameScreen } from "../grid/sudoku-game-screen";
import { readSudokuSave } from "../saves/sudoku-save-store";

export function SudokuPlayScreen({ id }: { id: string }) {
	const router = useRouter();
	const { t } = useI18n();
	const [save] = useState(() => readSudokuSave(id));
	if (!save) {
		return (
			<CenteredState
				title={t.games.sudoku.session.puzzleNotFound}
				action={{
					label: t.games.sudoku.game.startAnotherPuzzle,
					onPress: () => router.replace("/sudoku"),
				}}
			/>
		);
	}
	return save.variant === "binary" ? (
		<BinaryGameScreen save={save} />
	) : (
		<SudokuGameScreen save={save} />
	);
}
