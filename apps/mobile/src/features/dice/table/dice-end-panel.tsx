/** The end of any dice game: who won, everyone's final standing, and what next. */
import { diceSeatName } from "@arcadeclub/core/dice/table-view";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { AccessibilityInfo, StyleSheet, View } from "react-native";
import { haptics } from "../../../feedback/haptics";
import { fmt, useI18n } from "../../../i18n";
import { metrics, spacing } from "../../../theme";
import { Button } from "../../../ui/button";
import { Card } from "../../../ui/card";
import { AppText } from "../../../ui/text";
import type { DiceTableBundle, DiceTableControls } from "./use-dice-table";

export function DiceEndPanel({
	table,
	winners,
	rows,
	controls,
}: {
	table: DiceTableBundle;
	winners: readonly number[];
	/** Best first: each seat with what it finished on, in words. */
	rows: ReadonlyArray<{ seat: number; value: string }>;
	controls: DiceTableControls;
}) {
	const router = useRouter();
	const { t } = useI18n();
	const dice = t.games.dice;
	const you = table.you;
	const won = you !== null && winners.includes(you);
	const title =
		winners.length > 1
			? dice.table.tie
			: won
				? dice.table.youWin
				: fmt(dice.table.winner, {
						name: diceSeatName(dice, table, winners[0]),
					});

	useEffect(() => {
		AccessibilityInfo.announceForAccessibility(title);
		if (won) haptics.gameWon();
	}, [title, won]);

	return (
		<Card testID="dice-end">
			<AppText variant="title" accessibilityRole="header">
				{title}
			</AppText>
			<AppText variant="label">{dice.table.standings.toUpperCase()}</AppText>
			{rows.map(({ seat, value }) => (
				<View key={seat} style={styles.standing}>
					<AppText variant="body" numberOfLines={1} style={styles.flex}>
						{diceSeatName(dice, table, seat)}
					</AppText>
					<AppText variant="heading">{value}</AppText>
				</View>
			))}
			{you !== null ? (
				<Button
					label={dice.table.playAgain}
					busy={controls.pending}
					onPress={controls.rematch}
					testID="dice-rematch"
				/>
			) : (
				<AppText variant="secondary">{dice.table.waitingRematch}</AppText>
			)}
			<Button
				variant="secondary"
				label={dice.table.newGame}
				onPress={() => router.dismissTo("/dice")}
				testID="dice-new-game"
			/>
		</Card>
	);
}

const styles = StyleSheet.create({
	standing: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.md,
		minHeight: metrics.hitTarget,
	},
	flex: { flex: 1 },
});
