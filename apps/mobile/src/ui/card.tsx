/** A raised surface for grouping content; pressable when given `onPress`. */
import type { ReactNode } from "react";
import {
	Pressable,
	type StyleProp,
	StyleSheet,
	View,
	type ViewStyle,
} from "react-native";
import { radius, spacing, type Tokens, useThemedStyles } from "../theme";

type Props = {
	children: ReactNode;
	onPress?: () => void;
	accessibilityLabel?: string;
	accessibilityHint?: string;
	style?: StyleProp<ViewStyle>;
	testID?: string;
};

export function Card({
	children,
	onPress,
	accessibilityLabel,
	accessibilityHint,
	style,
	testID,
}: Props) {
	const styles = useThemedStyles(createStyles);
	if (!onPress) {
		return (
			<View style={[styles.card, style]} testID={testID}>
				{children}
			</View>
		);
	}
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={accessibilityLabel}
			accessibilityHint={accessibilityHint}
			onPress={onPress}
			testID={testID}
			style={({ pressed }) => [styles.card, pressed && styles.pressed, style]}
		>
			{children}
		</Pressable>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		card: {
			backgroundColor: colors.surface,
			borderRadius: radius.lg,
			borderWidth: StyleSheet.hairlineWidth,
			borderColor: colors.border,
			padding: spacing.lg,
			gap: spacing.sm,
		},
		pressed: { backgroundColor: colors.surfacePressed },
	});
