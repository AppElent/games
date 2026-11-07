/** Round by round, plus the total. Rounds scroll sideways in a long match. */
import type { RummyView } from "@arcadeclub/core/cards/rummy";
import { seatName } from "@arcadeclub/core/cards/table-view";
import { ScrollView, StyleSheet, View } from "react-native";
import { useI18n } from "../../../i18n";
import { cardColors, spacing, useTokens } from "../../../theme";
import { AppText } from "../../../ui/text";
import type { CardTableBundle } from "./use-card-table";

export function ScoreBoard({
	table,
	view,
	onFelt = false,
}: {
	table: CardTableBundle;
	view: RummyView;
	/** On a table panel rather than the app's own surface. */
	onFelt?: boolean;
}) {
	const { t } = useI18n();
	const tokens = useTokens();
	const cards = t.games.cards;
	const ink = onFelt ? cardColors.ivory : tokens.text;
	const muted = onFelt ? cardColors.ivoryMuted : tokens.textMuted;
	const line = onFelt ? cardColors.line : tokens.border;
	if (view.scores.length === 0) {
		return (
			<AppText variant="secondary" style={{ color: muted }}>
				{cards.rummy.noScores}
			</AppText>
		);
	}
	const seats = table.seats.map((_, seat) => seat);
	const cell = [styles.cell, { borderBottomColor: line }];
	return (
		<View style={styles.table}>
			<View style={styles.names}>
				<View style={cell}>
					<AppText variant="caption" style={{ color: muted }}>
						{cards.table.playerHeading}
					</AppText>
				</View>
				{seats.map((seat) => (
					<View key={seat} style={cell}>
						<AppText
							variant="secondary"
							numberOfLines={1}
							style={{ color: ink }}
						>
							{seatName(cards, table, seat)}
						</AppText>
					</View>
				))}
			</View>
			<ScrollView
				horizontal
				style={styles.rounds}
				contentContainerStyle={styles.roundsContent}
			>
				{view.scores.map((round, index) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: rounds only ever append.
					<View key={index} style={styles.round}>
						<View style={[cell, styles.number]}>
							<AppText variant="caption" style={{ color: muted }}>
								{index + 1}
							</AppText>
						</View>
						{seats.map((seat) => (
							<View key={seat} style={[cell, styles.number]}>
								<AppText variant="secondary" style={{ color: ink }}>
									{round[seat]}
								</AppText>
							</View>
						))}
					</View>
				))}
			</ScrollView>
			<View>
				<View style={[cell, styles.number]}>
					<AppText variant="caption" style={{ color: muted }}>
						{cards.rummy.scoreTotal}
					</AppText>
				</View>
				{seats.map((seat) => (
					<View key={seat} style={[cell, styles.number]}>
						<AppText variant="body" style={{ color: ink }}>
							{view.totals[seat]}
						</AppText>
					</View>
				))}
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	table: { flexDirection: "row" },
	names: { flexBasis: "34%", flexShrink: 1 },
	rounds: { flex: 1 },
	roundsContent: { flexGrow: 1 },
	round: { flexGrow: 1, minWidth: 40 },
	cell: {
		minHeight: 34,
		justifyContent: "center",
		borderBottomWidth: StyleSheet.hairlineWidth,
	},
	number: { alignItems: "flex-end", paddingLeft: spacing.sm },
});
