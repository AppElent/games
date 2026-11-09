/** Standings by cards on each timeline, or the team's progress in co-op. */
import { getHitsterModeConfig } from "@arcadeclub/core/hitster";
import { StyleSheet, View } from "react-native";
import { fmt, plural, useI18n } from "../../../i18n";
import { spacing, useTokens } from "../../../theme";
import { AppText } from "../../../ui/text";
import {
	type HitsterBundle,
	type HitsterState,
	participantName,
} from "./room-view";

export function Scoreboard({
	bundle,
	state,
}: {
	bundle: HitsterBundle;
	state: HitsterState;
}) {
	const { t, locale } = useI18n();
	const copy = t.games.hitster.bits.scoreboard;
	const tokens = useTokens();
	if (getHitsterModeConfig(state.mode).shared) {
		return (
			<View style={styles.list}>
				<AppText variant="label">{copy.teamProgress.toUpperCase()}</AppText>
				<AppText variant="body">
					{fmt(copy.cardsProgress, {
						cards: state.timelines[0]?.cardIds.length ?? 0,
						target: state.targetCards,
					})}
				</AppText>
			</View>
		);
	}
	const rows = [...state.timelines].sort(
		(a, b) => b.cardIds.length - a.cardIds.length,
	);
	return (
		<View style={styles.list}>
			<AppText variant="label">
				{fmt(copy.standingsHeading, {
					target: state.targetCards,
				}).toUpperCase()}
			</AppText>
			{rows.map((row) => {
				const winner = row.participantId === state.winnerParticipantId;
				return (
					<View key={row.participantId ?? "team"} style={styles.row}>
						<AppText
							variant="body"
							style={[styles.grow, winner && { color: tokens.green }]}
						>
							{participantName(
								bundle,
								row.participantId,
								t.games.hitster.bits.participantFallbackPlayer,
							)}
							{winner ? ` · ${copy.winner}` : ""}
						</AppText>
						<AppText variant="secondary">
							{plural(locale, row.cardIds.length, copy.cardsCount)}
						</AppText>
					</View>
				);
			})}
		</View>
	);
}

const styles = StyleSheet.create({
	list: { gap: spacing.sm },
	row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
	grow: { flex: 1 },
});
