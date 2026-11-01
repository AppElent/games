/**
 * Whose turn it is, the dice, what to do next and the turn's actions. Sits
 * under the board in both local and online play.
 */
import type { BackgammonColor } from "@arcadeclub/core/backgammon";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import {
	backgammonColors as board,
	radius,
	spacing,
	type Tokens,
	useThemedStyles,
} from "../../../theme";
import { AppText } from "../../../ui/text";
import { DiceRow } from "../board/dice-row";

export function TurnPanel({
	color,
	heading,
	message,
	dice,
	used,
	children,
}: {
	color: BackgammonColor;
	heading: string;
	message: string | null;
	dice: number[];
	used: boolean[];
	children?: ReactNode;
}) {
	const styles = useThemedStyles(createStyles);
	return (
		<View style={styles.panel}>
			<View style={styles.head}>
				<View
					style={[
						styles.swatch,
						color === "white" ? styles.white : styles.black,
					]}
				/>
				<AppText
					variant="heading"
					style={styles.grow}
					accessibilityRole="header"
					accessibilityLiveRegion="polite"
					testID="bg-turn"
				>
					{heading}
				</AppText>
				<DiceRow dice={dice} used={used} size={32} />
			</View>
			{message ? (
				<AppText variant="secondary" accessibilityLiveRegion="polite">
					{message}
				</AppText>
			) : null}
			{children ? <View style={styles.actions}>{children}</View> : null}
		</View>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		panel: {
			gap: spacing.md,
			padding: spacing.lg,
			borderRadius: radius.lg,
			backgroundColor: colors.surface,
			borderWidth: StyleSheet.hairlineWidth,
			borderColor: colors.border,
		},
		head: { flexDirection: "row", alignItems: "center", gap: spacing.md },
		swatch: { width: 22, height: 22, borderRadius: 11, borderWidth: 1 },
		white: {
			backgroundColor: board.checkerWhite,
			borderColor: board.checkerWhiteEdge,
		},
		black: {
			backgroundColor: board.checkerBlack,
			borderColor: colors.borderStrong,
		},
		grow: { flex: 1 },
		actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
	});
