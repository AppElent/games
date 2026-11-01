/** What happened in the round just revealed: the card, who got what. */
import { StyleSheet, View } from "react-native";
import { fmt, useI18n } from "../../../i18n";
import { spacing } from "../../../theme";
import { AppText } from "../../../ui/text";
import {
	type HitsterBundle,
	type HitsterState,
	participantName,
	timelineCards,
} from "./room-view";

export function RecapPanel({
	bundle,
	state,
}: {
	bundle: HitsterBundle;
	state: HitsterState;
}) {
	const { t } = useI18n();
	const copy = t.games.hitster.bits.recap;
	const recap = state.lastRecap;
	if (!recap) return null;
	const [card] = timelineCards(state, [recap.cardId]);
	const name = (id?: string) =>
		participantName(bundle, id, t.games.hitster.bits.participantFallbackPlayer);
	const result = (correct: boolean) =>
		correct ? copy.correctWord : copy.wrongWord;
	const lines = [
		fmt(copy.placementLine, {
			name: name(recap.activeParticipantId),
			result: result(recap.placementCorrect),
		}),
		recap.artistCorrect !== undefined
			? fmt(copy.artistLine, { result: result(recap.artistCorrect) })
			: null,
		recap.titleCorrect !== undefined
			? fmt(copy.titleLine, { result: result(recap.titleCorrect) })
			: null,
		recap.yearCorrect !== undefined
			? fmt(copy.yearLine, { result: result(recap.yearCorrect) })
			: null,
		recap.cardWonByTeam !== undefined
			? recap.cardWonByTeam
				? copy.cardStaysTeam
				: copy.cardDiscardedTeam
			: recap.cardWonByParticipantId
				? fmt(copy.wonByName, { name: name(recap.cardWonByParticipantId) })
				: copy.nobodyWins,
		...recap.stealResults.map((steal) =>
			fmt(copy.stealByLine, {
				name: name(steal.participantId),
				result: steal.wonCard
					? copy.stealWonCard
					: steal.correct
						? copy.stealCorrectTooLate
						: copy.stealMissed,
			}),
		),
	].filter((line): line is string => Boolean(line));

	return (
		<View style={styles.panel} accessibilityLiveRegion="polite">
			<AppText variant="label">
				{fmt(copy.heading, { round: recap.roundNumber }).toUpperCase()}
			</AppText>
			{card ? (
				<View style={styles.card} testID="hitster-revealed-card">
					<AppText variant="display">{card.releaseYear}</AppText>
					<AppText variant="heading">{card.title}</AppText>
					<AppText variant="secondary">{card.artistNames.join(", ")}</AppText>
				</View>
			) : null}
			{lines.map((line) => (
				<AppText key={line} variant="secondary" tone="default">
					{line}
				</AppText>
			))}
		</View>
	);
}

const styles = StyleSheet.create({
	panel: { gap: spacing.sm },
	card: { gap: spacing.xxs, paddingVertical: spacing.sm },
});
