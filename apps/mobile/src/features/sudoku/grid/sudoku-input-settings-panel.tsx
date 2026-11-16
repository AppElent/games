/**
 * Which modes a second tap on the selected cell cycles through, and where
 * corner notes sit. Folded away under the keypad until the player opens it.
 */
import {
	CORNER_NOTE_LAYOUTS,
	SUDOKU_CYCLE_MODES,
	type SudokuInputSettings,
} from "@arcadeclub/core/sudoku-input";
import { useState } from "react";
import { Pressable, StyleSheet, Switch, View } from "react-native";
import { fmt, useI18n } from "../../../i18n";
import {
	metrics,
	opacity,
	radius,
	spacing,
	type Tokens,
	useThemedStyles,
	useTokens,
} from "../../../theme";
import { Icon } from "../../../ui/icon";
import { Segmented } from "../../../ui/segmented";
import { AppText } from "../../../ui/text";

type Props = {
	settings: SudokuInputSettings;
	onChange: (settings: SudokuInputSettings) => void;
};

export function SudokuInputSettingsPanel({ settings, onChange }: Props) {
	const { t } = useI18n();
	const copy = t.games.sudoku.inputSettings;
	const tokens = useTokens();
	const styles = useThemedStyles(createStyles);
	const [open, setOpen] = useState(false);

	return (
		<View style={styles.root}>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={copy.title}
				accessibilityState={{ expanded: open }}
				onPress={() => setOpen((value) => !value)}
				style={({ pressed }) => [styles.header, pressed && styles.pressed]}
				testID="sudoku-input-settings"
			>
				<AppText variant="caption" tone="default" style={styles.grow}>
					{copy.title}
				</AppText>
				<Icon
					ios={open ? "chevron.up" : "chevron.down"}
					android={open ? "expand_less" : "expand_more"}
					size={16}
					color={tokens.textMuted}
				/>
			</Pressable>
			{open ? (
				<View style={styles.body}>
					<AppText variant="caption">{copy.tapCycleLabel}</AppText>
					{SUDOKU_CYCLE_MODES.map((mode) => (
						<View key={mode} style={styles.row}>
							<AppText variant="secondary" tone="default" style={styles.grow}>
								{copy.modes[mode]}
							</AppText>
							<Switch
								value={settings.tapCycle[mode]}
								onValueChange={(value) =>
									onChange({
										...settings,
										tapCycle: { ...settings.tapCycle, [mode]: value },
									})
								}
								trackColor={{ true: tokens.accent, false: tokens.surface2 }}
								accessibilityLabel={fmt(copy.tapCycleSwitchLabel, {
									mode: copy.modes[mode],
								})}
								testID={`sudoku-cycle-${mode}`}
							/>
						</View>
					))}
					<AppText variant="caption">{copy.tapCycleNote}</AppText>
					<AppText variant="caption" style={styles.section}>
						{copy.cornerLayoutLabel}
					</AppText>
					<Segmented
						accessibilityLabel={copy.cornerLayoutLabel}
						options={CORNER_NOTE_LAYOUTS.map((value) => ({
							value,
							label: copy.cornerLayouts[value],
						}))}
						value={settings.cornerLayout}
						onChange={(cornerLayout) => onChange({ ...settings, cornerLayout })}
						testID="sudoku-corner-layout"
					/>
				</View>
			) : null}
		</View>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		root: {
			borderRadius: radius.md,
			borderWidth: StyleSheet.hairlineWidth,
			borderColor: colors.border,
		},
		header: {
			minHeight: metrics.hitTarget,
			flexDirection: "row",
			alignItems: "center",
			gap: spacing.sm,
			paddingHorizontal: spacing.md,
			borderRadius: radius.md,
		},
		pressed: {
			backgroundColor: colors.surfacePressed,
			opacity: opacity.pressed,
		},
		body: {
			gap: spacing.sm,
			paddingHorizontal: spacing.md,
			paddingBottom: spacing.md,
		},
		row: {
			minHeight: metrics.hitTarget,
			flexDirection: "row",
			alignItems: "center",
			gap: spacing.sm,
		},
		section: { marginTop: spacing.sm },
		grow: { flex: 1 },
	});
