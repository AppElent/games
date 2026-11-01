/** A binary (Takuzu) puzzle in play. */
import { useRouter } from "expo-router";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fmt, plural, useI18n } from "../../../i18n";
import { metrics, spacing, type Tokens, useThemedStyles } from "../../../theme";
import { Button } from "../../../ui/button";
import { AppText } from "../../../ui/text";
import { PausedOverlay } from "../components/paused-overlay";
import { PuzzleHeader } from "../components/puzzle-header";
import { PuzzleStatus } from "../components/puzzle-status";
import { useBoardSize } from "../components/use-board-size";
import type { BinarySave } from "../saves/sudoku-save-store";
import { BinaryBoard } from "./binary-board";
import { useBinaryGame } from "./use-binary-game";

export function BinaryGameScreen({ save }: { save: BinarySave }) {
	const router = useRouter();
	const { t, locale } = useI18n();
	const copy = t.games.sudoku;
	const styles = useThemedStyles(createStyles);
	const insets = useSafeAreaInsets();
	const game = useBinaryGame(save);
	const { size } = useBoardSize(300);
	const title = `${copy.variant.binary} · ${copy.difficulty[save.difficulty]}`;
	const detail = `${fmt(copy.binary.dimensions, { size: game.size })} · ${fmt(
		plural(locale, game.remaining, copy.binary.remainingCells),
		{ count: game.remaining },
	)}`;

	const confirmRestart = () =>
		Alert.alert(copy.game.restartTitle, copy.binary.restartBody, [
			{ text: t.common.actions.cancel, style: "cancel" },
			{
				text: t.common.gameShell.restart,
				style: "destructive",
				onPress: game.restart,
			},
		]);

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
					{ paddingBottom: insets.bottom + spacing.lg },
				]}
			>
				<View style={[styles.column, { width: size }]}>
					<PuzzleStatus
						status={game.status}
						elapsed={game.elapsed}
						detail={detail}
						onNewPuzzle={() => router.back()}
					/>
					<View>
						<BinaryBoard
							size={game.size}
							side={size}
							merged={game.merged}
							givens={game.givens}
							conflicts={game.conflicts}
							hidden={game.status === "paused"}
							onCycle={game.cycle}
						/>
						{game.status === "paused" ? (
							<PausedOverlay onResume={game.resume} />
						) : null}
					</View>
					{game.status === "completed" ? null : (
						<>
							<AppText variant="secondary">{copy.binary.instructions}</AppText>
							<View style={styles.actions}>
								<Button
									variant="secondary"
									compact
									label={copy.keypad.undo}
									onPress={game.undo}
									disabled={!game.canUndo || game.status !== "active"}
								/>
								<Button
									variant="plain"
									compact
									label={t.common.gameShell.restart}
									onPress={confirmRestart}
									disabled={game.status !== "active"}
								/>
							</View>
						</>
					)}
				</View>
			</ScrollView>
		</>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		root: { flex: 1, backgroundColor: colors.bg },
		content: {
			alignItems: "center",
			paddingHorizontal: metrics.screenGutter,
			paddingTop: spacing.sm,
		},
		column: { gap: spacing.lg },
		actions: { flexDirection: "row", justifyContent: "space-between" },
	});
