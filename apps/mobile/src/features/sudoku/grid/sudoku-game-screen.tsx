/**
 * A Classic or Killer puzzle in play.
 */
import { describeHint } from "@arcadeclub/core/sudoku-hints";
import { StyleSheet, Switch, View } from "react-native";
import { useI18n } from "../../../i18n";
import {
	radius,
	spacing,
	type Tokens,
	useThemedStyles,
	useTokens,
} from "../../../theme";
import { Button } from "../../../ui/button";
import { AppText } from "../../../ui/text";
import { PuzzleFrame } from "../components/puzzle-frame";
import { PuzzleRestartButton } from "../components/puzzle-restart-button";
import { puzzleTitle } from "../components/puzzle-title";
import { useBoardSize } from "../components/use-board-size";
import type { GridSave } from "../saves/sudoku-save-store";
import { SudokuBoard } from "./sudoku-board";
import { SudokuKeypad } from "./sudoku-keypad";
import { useSudokuGame } from "./use-sudoku-game";

export function SudokuGameScreen({ save }: { save: GridSave }) {
	const { t } = useI18n();
	const copy = t.games.sudoku;
	const tokens = useTokens();
	const styles = useThemedStyles(createStyles);
	const game = useSudokuGame(save);
	const { status } = game.session;
	const { size, wide } = useBoardSize(400);

	const controls =
		status === "completed" ? null : (
			<View style={styles.controls}>
				{game.hint || game.noHint ? (
					<View style={styles.hint} accessibilityLiveRegion="polite">
						<View style={styles.hintHead}>
							<AppText variant="label" style={{ color: tokens.orange }}>
								{(game.hint && game.hintLevel >= 2
									? describeHint(game.hint, game.hintLevel, copy.hints).title
									: copy.game.hintFallbackTitle
								).toUpperCase()}
							</AppText>
							<Button
								variant="plain"
								compact
								label={copy.game.dismissHint}
								onPress={game.dismissHint}
							/>
						</View>
						{game.hint ? (
							<>
								<AppText variant="secondary" tone="default">
									{describeHint(game.hint, game.hintLevel, copy.hints).text}
								</AppText>
								{game.hintLevel < 3 ? (
									<Button
										variant="secondary"
										compact
										label={copy.game.tellMeMore}
										onPress={game.requestHint}
										style={styles.start}
									/>
								) : null}
							</>
						) : (
							<AppText variant="secondary" tone="default">
								{copy.game.noHint}
							</AppText>
						)}
					</View>
				) : null}
				<SudokuKeypad
					mode={game.mode}
					onModeChange={game.setMode}
					onDigit={game.enter}
					onColor={game.mark}
					onErase={game.erase}
					onUndo={game.undo}
					onRedo={game.redo}
					onHint={game.requestHint}
					canUndo={game.canUndo}
					canRedo={game.canRedo}
					digitCounts={game.digitCounts}
					disabled={status !== "active"}
				/>
				<View style={styles.options}>
					<View style={styles.toggle}>
						<Switch
							value={game.autoCleanup}
							onValueChange={game.setAutoCleanup}
							trackColor={{ true: tokens.accent, false: tokens.surface2 }}
							accessibilityLabel={copy.game.autoCleanupLabel}
						/>
						<AppText variant="caption" style={styles.grow}>
							{copy.game.autoCleanupLabel}
						</AppText>
					</View>
					<PuzzleRestartButton
						body={copy.game.restartBody}
						onRestart={game.restart}
					/>
				</View>
			</View>
		);

	return (
		<PuzzleFrame
			title={puzzleTitle(copy, save)}
			session={game.session}
			size={size}
			wide={wide}
			gap={spacing.md}
			board={
				<SudokuBoard
					board={game.board}
					size={size}
					selectedCell={game.selectedCell}
					onSelectCell={game.selectCell}
					conflicts={game.conflicts}
					hintCells={game.hintCells}
					cages={game.cages}
					hidden={status === "paused"}
				/>
			}
			beside={controls}
		/>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		controls: { gap: spacing.md },
		hint: {
			gap: spacing.sm,
			padding: spacing.lg,
			borderRadius: radius.md,
			backgroundColor: colors.orangeDim,
		},
		hintHead: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
		},
		start: { alignSelf: "flex-start" },
		options: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
			gap: spacing.md,
		},
		toggle: {
			flex: 1,
			flexDirection: "row",
			alignItems: "center",
			gap: spacing.sm,
		},
		grow: { flex: 1 },
	});
