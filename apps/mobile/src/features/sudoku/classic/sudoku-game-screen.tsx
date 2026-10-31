/**
 * A Classic or Killer puzzle in play.
 */
import { hintTextForLevel } from "@games/core/sudoku-hints";
import { useRouter } from "expo-router";
import { Alert, ScrollView, StyleSheet, Switch, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useI18n } from "../../../i18n";
import {
	metrics,
	radius,
	spacing,
	type Tokens,
	useThemedStyles,
	useTokens,
} from "../../../theme";
import { Button } from "../../../ui/button";
import { AppText } from "../../../ui/text";
import { PausedOverlay } from "../components/paused-overlay";
import { PuzzleHeader } from "../components/puzzle-header";
import { PuzzleStatus } from "../components/puzzle-status";
import { useBoardSize } from "../components/use-board-size";
import type { GridSave } from "../saves/sudoku-save-store";
import { SudokuBoard } from "./sudoku-board";
import { SudokuKeypad } from "./sudoku-keypad";
import { useSudokuGame } from "./use-sudoku-game";

export function SudokuGameScreen({ save }: { save: GridSave }) {
	const router = useRouter();
	const { t } = useI18n();
	const copy = t.sudoku;
	const tokens = useTokens();
	const styles = useThemedStyles(createStyles);
	const insets = useSafeAreaInsets();
	const game = useSudokuGame(save);
	const { size, wide } = useBoardSize(400);
	const title = `${copy.variant[save.variant]} · ${copy.difficulty[save.difficulty]}`;

	const confirmRestart = () =>
		Alert.alert(copy.game.restartTitle, copy.game.restartBody, [
			{ text: t.common.actions.cancel, style: "cancel" },
			{ text: copy.game.restart, style: "destructive", onPress: game.restart },
		]);

	const controls =
		game.status === "completed" ? null : (
			<View style={styles.controls}>
				{game.hint || game.noHint ? (
					<View style={styles.hint} accessibilityLiveRegion="polite">
						<View style={styles.hintHead}>
							<AppText variant="label" style={{ color: tokens.orange }}>
								{(game.hint && game.hintLevel >= 2
									? game.hint.title
									: copy.game.hintTitle
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
									{hintTextForLevel(game.hint, game.hintLevel)}
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
					disabled={game.status !== "active"}
				/>
				<View style={styles.options}>
					<View style={styles.toggle}>
						<Switch
							value={game.autoCleanup}
							onValueChange={game.setAutoCleanup}
							trackColor={{ true: tokens.accent, false: tokens.surface2 }}
							accessibilityLabel={copy.game.autoCleanup}
						/>
						<AppText variant="caption" style={styles.grow}>
							{copy.game.autoCleanup}
						</AppText>
					</View>
					<Button
						variant="plain"
						compact
						label={copy.game.restart}
						onPress={confirmRestart}
					/>
				</View>
			</View>
		);

	return (
		<>
			<PuzzleHeader
				title={title}
				status={game.status}
				onPause={game.pause}
				onResume={game.resume}
			/>
			<ScrollView
				style={styles.root}
				contentInsetAdjustmentBehavior="automatic"
				contentContainerStyle={[
					styles.content,
					wide && styles.wideContent,
					{ paddingBottom: insets.bottom + spacing.lg },
				]}
			>
				<View style={[styles.boardColumn, { width: size }]}>
					<PuzzleStatus
						status={game.status}
						elapsed={game.elapsed}
						onNewPuzzle={() => router.back()}
					/>
					<View>
						<SudokuBoard
							board={game.board}
							size={size}
							selectedCell={game.selectedCell}
							onSelectCell={game.selectCell}
							conflicts={game.conflicts}
							hintCells={game.hintCells}
							cages={game.cages}
							hidden={game.status === "paused"}
						/>
						{game.status === "paused" ? (
							<PausedOverlay onResume={game.resume} />
						) : null}
					</View>
				</View>
				{controls ? (
					<View style={[styles.controlColumn, { width: wide ? 360 : size }]}>
						{controls}
					</View>
				) : null}
			</ScrollView>
		</>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		root: { flex: 1, backgroundColor: colors.bg },
		content: {
			alignItems: "center",
			gap: spacing.lg,
			paddingHorizontal: metrics.screenGutter,
			paddingTop: spacing.sm,
		},
		wideContent: {
			flexDirection: "row",
			alignItems: "flex-start",
			justifyContent: "center",
		},
		boardColumn: { gap: spacing.md },
		controlColumn: {},
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
