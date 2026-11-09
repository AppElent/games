/** A binary (Takuzu) puzzle in play. */
import { StyleSheet, View } from "react-native";
import { fmt, plural, useI18n } from "../../../i18n";
import { spacing } from "../../../theme";
import { Button } from "../../../ui/button";
import { AppText } from "../../../ui/text";
import { PuzzleFrame } from "../components/puzzle-frame";
import { PuzzleRestartButton } from "../components/puzzle-restart-button";
import { puzzleTitle } from "../components/puzzle-title";
import { useBoardSize } from "../components/use-board-size";
import type { BinarySave } from "../saves/sudoku-save-store";
import { BinaryBoard } from "./binary-board";
import { useBinaryGame } from "./use-binary-game";

export function BinaryGameScreen({ save }: { save: BinarySave }) {
	const { t, locale } = useI18n();
	const copy = t.games.sudoku;
	const game = useBinaryGame(save);
	const { status } = game.session;
	const { size } = useBoardSize(300);
	const detail = `${fmt(copy.binary.dimensions, { size: game.size })} · ${plural(
		locale,
		game.remaining,
		copy.binary.remainingCells,
	)}`;

	return (
		<PuzzleFrame
			title={puzzleTitle(copy, save)}
			session={game.session}
			detail={detail}
			size={size}
			gap={spacing.lg}
			board={
				<BinaryBoard
					size={game.size}
					side={size}
					merged={game.merged}
					givens={game.givens}
					conflicts={game.conflicts}
					hidden={status === "paused"}
					onCycle={game.cycle}
				/>
			}
			below={
				status === "completed" ? null : (
					<>
						<AppText variant="secondary">{copy.binary.instructions}</AppText>
						<View style={styles.actions}>
							<Button
								variant="secondary"
								compact
								label={copy.keypad.undo}
								onPress={game.undo}
								disabled={!game.canUndo || status !== "active"}
							/>
							<PuzzleRestartButton
								body={copy.binary.restartBody}
								onRestart={game.restart}
								disabled={status !== "active"}
							/>
						</View>
					</>
				)
			}
		/>
	);
}

const styles = StyleSheet.create({
	actions: { flexDirection: "row", justifyContent: "space-between" },
});
