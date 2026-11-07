import type { BackgammonOptions } from "@arcadeclub/core/backgammon-local";
/**
 * Toggles for the board helpers. Local play offers all four; online play
 * leaves out auto-roll, since a roll is a server action.
 */
import { StyleSheet, Switch, View } from "react-native";
import { useI18n } from "../../../i18n";
import { metrics, spacing, useTokens } from "../../../theme";
import { Card } from "../../../ui/card";
import { AppText } from "../../../ui/text";

type Key = keyof BackgammonOptions;

const OPTION_MESSAGE = {
	showNumbers: "optionShowNumbers",
	autoRoll: "optionAutoRoll",
	autoSwitchTurn: "optionAutoSwitchTurn",
	autoCombine: "optionAutoCombine",
} as const satisfies Record<Key, string>;

export function OptionsPanel<K extends Key>({
	options,
	keys,
	onChange,
}: {
	options: Pick<BackgammonOptions, K>;
	keys: readonly K[];
	onChange: (key: K, value: boolean) => void;
}) {
	const { t } = useI18n();
	const tokens = useTokens();
	const copy = t.games.backgammon.board;
	return (
		<Card>
			<AppText variant="label">{copy.optionsHeading.toUpperCase()}</AppText>
			{keys.map((key) => (
				<View key={key} style={styles.row}>
					<AppText variant="secondary" tone="default" style={styles.grow}>
						{copy[OPTION_MESSAGE[key]]}
					</AppText>
					<Switch
						value={options[key]}
						onValueChange={(value) => onChange(key, value)}
						trackColor={{ true: tokens.accent, false: tokens.surface2 }}
						accessibilityLabel={copy[OPTION_MESSAGE[key]]}
						testID={`bg-option-${key}`}
					/>
				</View>
			))}
		</Card>
	);
}

const styles = StyleSheet.create({
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.md,
		minHeight: metrics.hitTarget,
	},
	grow: { flex: 1 },
});
