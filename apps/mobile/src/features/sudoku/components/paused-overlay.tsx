/** Covers the board while the clock is stopped; tapping it resumes. */
import { Pressable, StyleSheet } from "react-native";
import { useI18n } from "../../../i18n";
import {
	radius,
	spacing,
	type Tokens,
	useThemedStyles,
	useTokens,
} from "../../../theme";
import { Icon } from "../../../ui/icon";
import { AppText } from "../../../ui/text";

export function PausedOverlay({ onResume }: { onResume: () => void }) {
	const { t } = useI18n();
	const copy = t.games.sudoku.game;
	const tokens = useTokens();
	const styles = useThemedStyles(createStyles);
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={`${t.common.gameShell.paused}. ${t.common.gameShell.resume}`}
			onPress={onResume}
			style={styles.overlay}
			testID="sudoku-resume"
		>
			<Icon
				ios="play.circle.fill"
				android="play_circle"
				size={48}
				color={tokens.accent}
			/>
			<AppText variant="heading">{t.common.gameShell.paused}</AppText>
			<AppText variant="secondary" style={styles.center}>
				{copy.pausedBody}
			</AppText>
		</Pressable>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		overlay: {
			...StyleSheet.absoluteFill,
			alignItems: "center",
			justifyContent: "center",
			gap: spacing.sm,
			padding: spacing.xl,
			borderRadius: radius.sm,
			backgroundColor: colors.surface,
		},
		center: { textAlign: "center" },
	});
