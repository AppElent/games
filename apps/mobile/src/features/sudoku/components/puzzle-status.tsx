/**
 * Above the board: the clock and a one-line status, and the solved banner
 * once the puzzle is done.
 */
import { StyleSheet, View } from "react-native";
import { fmt, useI18n } from "../../../i18n";
import {
	radius,
	spacing,
	type Tokens,
	useThemedStyles,
	useTokens,
} from "../../../theme";
import { Button } from "../../../ui/button";
import { Icon } from "../../../ui/icon";
import { AppText } from "../../../ui/text";
import type { SudokuStatus } from "../saves/sudoku-save-store";
import { formatElapsed } from "./game-clock";

export function PuzzleStatus({
	status,
	elapsed,
	detail,
	onNewPuzzle,
}: {
	status: SudokuStatus;
	elapsed: number;
	detail?: string;
	onNewPuzzle: () => void;
}) {
	const { t } = useI18n();
	const copy = t.games.sudoku.game;
	const tokens = useTokens();
	const styles = useThemedStyles(createStyles);
	const time = formatElapsed(elapsed);

	if (status === "completed") {
		return (
			<View style={styles.solved} accessibilityLiveRegion="polite">
				<View style={styles.row}>
					<Icon
						ios="checkmark.seal.fill"
						android="verified"
						size={24}
						color={tokens.green}
					/>
					<View style={styles.grow}>
						<AppText variant="heading" accessibilityRole="header">
							{copy.solvedTitle}
						</AppText>
						<AppText variant="secondary">
							{fmt(copy.completedIn, { time })}
						</AppText>
					</View>
				</View>
				<Button label={copy.startAnotherPuzzle} onPress={onNewPuzzle} compact />
			</View>
		);
	}

	return (
		<View style={styles.row}>
			<View
				style={styles.clock}
				accessible
				accessibilityLabel={fmt(copy.timer, { time })}
			>
				<Icon ios="timer" android="timer" size={16} color={tokens.textMuted} />
				<AppText variant="control" style={styles.digits}>
					{time}
				</AppText>
			</View>
			{detail ? (
				<AppText variant="caption" style={styles.grow}>
					{detail}
				</AppText>
			) : null}
		</View>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
		grow: { flex: 1 },
		clock: {
			flexDirection: "row",
			alignItems: "center",
			gap: spacing.xs,
			paddingHorizontal: spacing.md,
			paddingVertical: spacing.xs,
			borderRadius: radius.pill,
			backgroundColor: colors.surface,
		},
		digits: { fontVariant: ["tabular-nums"] },
		solved: {
			gap: spacing.md,
			padding: spacing.lg,
			borderRadius: radius.lg,
			backgroundColor: colors.greenDim,
		},
	});
