/**
 * The native header for a puzzle in play: its name as the title and a
 * pause/resume control on the right. The clock sits in the body, where it
 * can be read without competing with the title.
 */
import { Stack } from "expo-router";
import { useI18n } from "../../../i18n";
import { HeaderButton } from "../../../ui/button";
import type { SudokuStatus } from "../saves/sudoku-save-store";

export function PuzzleHeader({
	title,
	status,
	onPause,
	onResume,
}: {
	title: string;
	status: SudokuStatus;
	onPause: () => void;
	onResume: () => void;
}) {
	const { t } = useI18n();
	const copy = t.games.sudoku.game;
	return (
		<Stack.Screen
			options={{
				title,
				headerRight:
					status === "completed"
						? undefined
						: () => (
								<HeaderButton
									label={
										status === "active"
											? copy.pauseButton
											: t.common.gameShell.resume
									}
									onPress={status === "active" ? onPause : onResume}
									testID="sudoku-pause"
								/>
							),
			}}
		/>
	);
}
