/** A raised surface for grouping content; pressable when given `onPress`. */
import type { ReactNode } from "react";
import {
	type AccessibilityActionInfo,
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
	onLongPress?: () => void;
	/** Extra VoiceOver/TalkBack actions, such as the long-press action. */
	accessibilityActions?: (AccessibilityActionInfo & { onAction: () => void })[];
	accessibilityLabel?: string;
	accessibilityHint?: string;
	style?: StyleProp<ViewStyle>;
	testID?: string;
};

export function Card({
	children,
	onPress,
	onLongPress,
	accessibilityActions,
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
			onLongPress={onLongPress}
			accessibilityActions={accessibilityActions?.map(({ name, label }) => ({
				name,
				label,
			}))}
			onAccessibilityAction={(event) =>
				accessibilityActions
					?.find((action) => action.name === event.nativeEvent.actionName)
					?.onAction()
			}
			testID={testID}
			style={({ pressed }) => [
				styles.card,
				styles.pressable,
				pressed && styles.pressed,
				style,
			]}
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
		pressable: { borderColor: colors.borderStrong },
		pressed: { backgroundColor: colors.surfacePressed },
	});
