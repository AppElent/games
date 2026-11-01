/** How the chosen mode plays, shown in the lobby. */
import type { HitsterModeConfig } from "@arcadeclub/core/hitster";
import { StyleSheet, View } from "react-native";
import { fmt, useI18n } from "../../../i18n";
import { spacing } from "../../../theme";
import { AppText } from "../../../ui/text";

export function RulesPanel({
	config,
	target,
}: {
	config: HitsterModeConfig;
	target: number;
}) {
	const { t } = useI18n();
	const copy = t.games.hitster.bits.rules;
	const rules: Array<[string, string]> = [
		[copy.listenTogetherHeading, copy.listenTogetherBody],
		[
			copy.placeInTimeHeading,
			config.shared ? copy.placeInTimeBodyShared : copy.placeInTimeBodySolo,
		],
		[
			copy.revealScoreHeading,
			fmt(
				config.shared ? copy.revealScoreBodyShared : copy.revealScoreBodySolo,
				{
					target,
					tokens: config.startTokens,
				},
			),
		],
	];
	if (config.earnTokens) {
		rules.push([
			copy.earnTokensHeading,
			fmt(copy.earnTokensBody, { cap: config.tokenCap }),
		]);
	}
	if (config.needsArtistTitle) {
		rules.push([
			copy.nameToClaimHeading,
			config.needsYear ? copy.nameToClaimBodyYear : copy.nameToClaimBodyNoYear,
		]);
	}
	return (
		<View style={styles.list}>
			{rules.map(([heading, body]) => (
				<View key={heading} style={styles.rule}>
					<AppText variant="body">{heading}</AppText>
					<AppText variant="secondary">{body}</AppText>
				</View>
			))}
		</View>
	);
}

const styles = StyleSheet.create({
	list: { gap: spacing.md },
	rule: { gap: spacing.xxs },
});
