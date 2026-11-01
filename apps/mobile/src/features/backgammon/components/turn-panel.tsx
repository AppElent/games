/**
 * Whose turn it is, the dice, what to do next and the turn's actions. Sits
 * under the board in portrait and beside it in landscape.
 */
import type { BackgammonColor } from "@arcadeclub/core/backgammon";
import { type ReactNode, useState } from "react";
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

const NARROW_WIDTH = 300;

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
	const [narrow, setNarrow] = useState(false);
	// Beside the heading, doubles (or any dice in a narrow column) would squeeze it onto two lines.
	const diceOwnRow = dice.length > 2 || (narrow && dice.length > 0);
	const diceRow = <DiceRow dice={dice} used={used} size={32} />;
	return (
		<View
			style={styles.panel}
			onLayout={(event) =>
				setNarrow(event.nativeEvent.layout.width < NARROW_WIDTH)
			}
		>
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
				{diceOwnRow ? null : diceRow}
			</View>
			{diceOwnRow ? diceRow : null}
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
