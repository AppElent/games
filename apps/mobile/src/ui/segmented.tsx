/**
 * A small set of mutually exclusive choices. Built from pressables rather than
 * a native segmented control so it can host game-specific labels (digits,
 * colours) with the same accessibility semantics on both platforms.
 */
import { Pressable, StyleSheet, View } from "react-native";
import {
	metrics,
	radius,
	spacing,
	type Tokens,
	useThemedStyles,
	useTokens,
} from "../theme";
import { AppText } from "./text";

type Option<T extends string> = { value: T; label: string };

type Props<T extends string> = {
	options: readonly Option<T>[];
	value: T;
	onChange: (value: T) => void;
	accessibilityLabel: string;
	testID?: string;
};

export function Segmented<T extends string>({
	options,
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
			style={styles.root}
			testID={testID}
		>
			{options.map((option) => {
				const selected = option.value === value;
				return (
					<Pressable
						key={option.value}
						accessibilityRole="radio"
						accessibilityLabel={option.label}
						accessibilityState={{ selected }}
						onPress={() => onChange(option.value)}
						style={[styles.segment, selected && styles.selected]}
					>
						<AppText
							variant="control"
							numberOfLines={1}
							adjustsFontSizeToFit
							style={{ color: selected ? tokens.onAccent : tokens.text }}
						>
							{option.label}
						</AppText>
					</Pressable>
				);
			})}
		</View>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		root: {
			flexDirection: "row",
			padding: spacing.xxs,
			gap: spacing.xxs,
			borderRadius: radius.md,
			backgroundColor: colors.surface2,
		},
		segment: {
			flex: 1,
			minHeight: metrics.hitTarget - 4,
			paddingHorizontal: spacing.sm,
			alignItems: "center",
			justifyContent: "center",
			borderRadius: radius.sm,
		},
		selected: { backgroundColor: colors.accent },
	});
