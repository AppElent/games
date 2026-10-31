/**
 * Sudoku hub: pick a game type and a difficulty to start, or pick up a
 * puzzle saved on this phone.
 */
import { SUDOKU_DIFFICULTIES, type SudokuDifficulty } from "@games/core/sudoku";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	Pressable,
	StyleSheet,
	View,
} from "react-native";
import { haptics } from "../../../feedback/haptics";
import { fmt, useI18n } from "../../../i18n";
import { relativeTime } from "../../../i18n/relative-time";
import { metrics, opacity, spacing, useTokens } from "../../../theme";
import { Card } from "../../../ui/card";
import { Icon } from "../../../ui/icon";
import { Notice } from "../../../ui/notice";
import { Screen } from "../../../ui/screen";
import { Segmented } from "../../../ui/segmented";
import { AppText } from "../../../ui/text";
import { formatElapsed } from "../components/game-clock";
import {
	deleteSudokuSave,
	listSudokuSaves,
	type SudokuSaveSummary,
	type SudokuVariant,
	writeSudokuSave,
} from "../saves/sudoku-save-store";
import { createSudokuSave } from "./create-sudoku-save";

const VARIANTS: readonly SudokuVariant[] = ["classic", "killer", "binary"];

export function SudokuHomeScreen() {
	const router = useRouter();
	const tokens = useTokens();
	const { t, locale } = useI18n();
	const copy = t.games.sudoku;
	const [variant, setVariant] = useState<SudokuVariant>("classic");
	const [busy, setBusy] = useState<SudokuDifficulty | null>(null);
	const [failed, setFailed] = useState(false);
	const [saves, setSaves] = useState<SudokuSaveSummary[]>([]);

	useFocusEffect(
		useCallback(() => {
			setSaves(listSudokuSaves());
		}, []),
	);

	function start(difficulty: SudokuDifficulty) {
		if (busy) return;
		setBusy(difficulty);
		setFailed(false);
		// Yield a frame so the spinner paints before the generator blocks.
		setTimeout(() => {
			try {
				const save = createSudokuSave(variant, difficulty);
				writeSudokuSave(save);
				router.push({ pathname: "/sudoku/[id]", params: { id: save.id } });
			} catch {
				setFailed(true);
				haptics.actionFailed();
			} finally {
				setBusy(null);
			}
		}, 32);
	}

	function confirmDelete(save: SudokuSaveSummary) {
		Alert.alert(copy.saved.deleteTitle, copy.saved.deleteBody, [
			{ text: t.common.actions.cancel, style: "cancel" },
			{
				text: t.common.actions.delete,
				style: "destructive",
				onPress: () => {
					deleteSudokuSave(save.id);
					setSaves(listSudokuSaves());
				},
			},
		]);
	}

	return (
		<Screen>
			<View style={styles.group}>
				<AppText variant="label" accessibilityRole="header">
					{copy.newGame.gameTypeLegend.toUpperCase()}
				</AppText>
				<Segmented
					accessibilityLabel={copy.newGame.gameTypeLegend}
					options={VARIANTS.map((value) => ({
						value,
						label: copy.variant[value],
					}))}
					value={variant}
					onChange={(next) => {
						haptics.selectionChanged();
						setVariant(next);
					}}
					testID="sudoku-variant"
				/>
				<AppText variant="secondary">
					{copy.newGame.variantBlurbs[variant]}
				</AppText>
			</View>
			<View style={styles.group}>
				{SUDOKU_DIFFICULTIES.map((difficulty) => (
					<Card
						key={difficulty}
						onPress={() => start(difficulty)}
						accessibilityLabel={`${copy.difficulty[difficulty]}, ${copy.newGame.difficultyBlurbs[difficulty][variant]}`}
						testID={`sudoku-start-${difficulty}`}
					>
						<View style={styles.row}>
							<View style={styles.grow}>
								<AppText variant="heading">
									{copy.difficulty[difficulty]}
								</AppText>
								<AppText variant="secondary">
									{copy.newGame.difficultyBlurbs[difficulty][variant]}
								</AppText>
							</View>
							{busy === difficulty ? (
								<ActivityIndicator color={tokens.accent} />
							) : (
								<Icon
									ios="play.fill"
									android="play_arrow"
									size={18}
									color={tokens.accent}
								/>
							)}
						</View>
					</Card>
				))}
				<Notice message={failed ? copy.newGame.couldNotStart : null} />
				<AppText variant="caption">{copy.newGame.offlineNote}</AppText>
			</View>
			<View style={styles.group}>
				<AppText variant="label" accessibilityRole="header">
					{copy.newGame.yourPuzzles.toUpperCase()}
				</AppText>
				{saves.length === 0 ? (
					<AppText variant="secondary">{copy.saved.empty}</AppText>
				) : (
					saves.map((save) => {
						const time = formatElapsed(save.elapsedSeconds);
						const progress =
							save.status === "completed"
								? fmt(copy.saved.solved, { time })
								: fmt(copy.saved.inProgress, { time });
						const title = `${copy.variant[save.variant]} · ${copy.difficulty[save.difficulty]}`;
						const detail = `${progress} · ${relativeTime(t, locale, save.updatedAt)}`;
						return (
							<Card key={save.id} style={styles.savedCard}>
								<View style={styles.row}>
									<Pressable
										accessibilityRole="button"
										accessibilityLabel={`${title}, ${detail}`}
										onPress={() =>
											router.push({
												pathname: "/sudoku/[id]",
												params: { id: save.id },
											})
										}
										style={({ pressed }) => [
											styles.savedMain,
											pressed && { opacity: opacity.pressed },
										]}
									>
										<View style={styles.grow}>
											<AppText variant="body">{title}</AppText>
											<AppText variant="caption">{detail}</AppText>
										</View>
										{save.status === "completed" ? (
											<Icon
												ios="checkmark.seal.fill"
												android="verified"
												size={20}
												color={tokens.green}
											/>
										) : null}
									</Pressable>
									<Pressable
										accessibilityRole="button"
										accessibilityLabel={`${t.common.actions.delete}: ${title}`}
										onPress={() => confirmDelete(save)}
										hitSlop={8}
										style={({ pressed }) => [
											styles.deleteButton,
											pressed && { opacity: opacity.pressed },
										]}
									>
										<Icon
											ios="trash"
											android="delete"
											size={18}
											color={tokens.textMuted}
										/>
									</Pressable>
								</View>
							</Card>
						);
					})
				)}
			</View>
		</Screen>
	);
}

const styles = StyleSheet.create({
	group: { gap: spacing.md },
	row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
	grow: { flex: 1, gap: spacing.xxs },
	savedCard: { paddingVertical: spacing.xs, paddingRight: spacing.xs },
	savedMain: {
		flex: 1,
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.md,
		paddingVertical: spacing.sm,
	},
	deleteButton: {
		width: metrics.hitTarget,
		height: metrics.hitTarget,
		alignItems: "center",
		justifyContent: "center",
	},
});
