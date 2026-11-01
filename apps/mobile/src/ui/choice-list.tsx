/**
 * A vertical list of mutually exclusive choices with a line of detail each,
 * for options too wordy for a segmented control (game modes, packs).
 */
import { Pressable, StyleSheet, View } from "react-native";
import {
	metrics,
	opacity,
	radius,
	spacing,
	type Tokens,
	useThemedStyles,
	useTokens,
} from "../theme";
import { Icon } from "./icon";
import { AppText } from "./text";

type Choice<T extends string> = { value: T; label: string; detail?: string };

type Props<T extends string> = {
	choices: readonly Choice<T>[];
	value: T;
	onChange: (value: T) => void;
	accessibilityLabel: string;
	testID?: string;
};

export function ChoiceList<T extends string>({
	choices,
	value,
	onChange,
	accessibilityLabel,
	testID,
}: Props<T>) {
	const tokens = useTokens();
	const styles = useThemedStyles(createStyles);
	return (
		<View
			accessibilityRole="radiogroup"
			accessibilityLabel={accessibilityLabel}
			style={styles.list}
			testID={testID}
		>
			{choices.map((choice) => {
				const selected = choice.value === value;
				return (
					<Pressable
						key={choice.value}
						accessibilityRole="radio"
						accessibilityState={{ selected }}
						accessibilityLabel={
							choice.detail ? `${choice.label}, ${choice.detail}` : choice.label
						}
						onPress={() => onChange(choice.value)}
						testID={testID ? `${testID}-${choice.value}` : undefined}
						style={({ pressed }) => [
							styles.row,
							selected && styles.selected,
							pressed && styles.pressed,
						]}
					>
						<View style={styles.text}>
							<AppText variant="body">{choice.label}</AppText>
							{choice.detail ? (
								<AppText variant="caption">{choice.detail}</AppText>
							) : null}
						</View>
						{selected ? (
							<Icon
								ios="checkmark.circle.fill"
								android="check_circle"
								size={22}
								color={tokens.accent}
							/>
						) : null}
					</Pressable>
				);
			})}
		</View>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		list: { gap: spacing.sm },
		row: {
			minHeight: metrics.hitTarget,
			flexDirection: "row",
			alignItems: "center",
			gap: spacing.md,
			paddingHorizontal: spacing.lg,
			paddingVertical: spacing.md,
			borderRadius: radius.md,
			backgroundColor: colors.surface,
			borderWidth: StyleSheet.hairlineWidth,
			borderColor: colors.border,
		},
		selected: { borderColor: colors.accent, backgroundColor: colors.accentDim },
		pressed: { opacity: opacity.pressed },
		text: { flex: 1, gap: spacing.xxs },
	});
