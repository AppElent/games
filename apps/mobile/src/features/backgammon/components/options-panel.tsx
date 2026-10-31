/**
 * Toggles for the board helpers. Local play offers all four; online play
 * leaves out auto-roll, since a roll is a server action.
 */
import { StyleSheet, Switch, View } from "react-native";
import { useI18n } from "../../../i18n";
import { metrics, spacing, useTokens } from "../../../theme";
import { AppText } from "../../../ui/text";
import type { BackgammonOptions } from "../local/local-match";

type Key = keyof BackgammonOptions;

export function OptionsPanel({
	options,
	keys,
	onChange,
}: {
	options: BackgammonOptions;
	keys: readonly Key[];
	onChange: (key: Key, value: boolean) => void;
}) {
	const { t } = useI18n();
	const tokens = useTokens();
	const copy = t.backgammon.game;
	return (
		<View style={styles.list}>
			<AppText variant="label">{copy.options.toUpperCase()}</AppText>
			{keys.map((key) => (
				<View key={key} style={styles.row}>
					<AppText variant="secondary" tone="default" style={styles.grow}>
						{copy[key]}
					</AppText>
					<Switch
						value={options[key]}
						onValueChange={(value) => onChange(key, value)}
						trackColor={{ true: tokens.accent, false: tokens.surface2 }}
						accessibilityLabel={copy[key]}
						testID={`bg-option-${key}`}
					/>
				</View>
			))}
		</View>
	);
}

const styles = StyleSheet.create({
	list: { gap: spacing.sm },
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.md,
		minHeight: metrics.hitTarget,
	},
	grow: { flex: 1 },
});
