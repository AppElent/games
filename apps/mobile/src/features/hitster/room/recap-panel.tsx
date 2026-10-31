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
	const copy = t.hitster.recap;
	const recap = state.lastRecap;
	if (!recap) return null;
	const [card] = timelineCards(state, [recap.cardId]);
	const name = (id?: string) =>
		participantName(bundle, id, t.hitster.fallback.player);
	const result = (correct: boolean) => (correct ? copy.correct : copy.wrong);
	const lines = [
		fmt(copy.placement, {
			name: name(recap.activeParticipantId),
			result: result(recap.placementCorrect),
		}),
		recap.artistCorrect !== undefined
			? fmt(copy.artist, { result: result(recap.artistCorrect) })
			: null,
		recap.titleCorrect !== undefined
			? fmt(copy.title, { result: result(recap.titleCorrect) })
			: null,
		recap.yearCorrect !== undefined
			? fmt(copy.year, { result: result(recap.yearCorrect) })
			: null,
		recap.cardWonByTeam !== undefined
			? recap.cardWonByTeam
				? copy.teamKeeps
				: copy.teamLoses
			: recap.cardWonByParticipantId
				? fmt(copy.wonBy, { name: name(recap.cardWonByParticipantId) })
				: copy.nobody,
		...recap.stealResults.map((steal) =>
			fmt(copy.steal, {
				name: name(steal.participantId),
				result: steal.wonCard
					? copy.stealWon
					: steal.correct
						? copy.stealLate
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
