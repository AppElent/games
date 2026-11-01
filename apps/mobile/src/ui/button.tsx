/**
 * The app's buttons. `primary` is the one main action on a screen;
 * `secondary` sits beside it; `plain` is a text link; `danger` confirms a
 * destructive step. Every button has a 44pt minimum hit target.
 */
import type { ReactNode } from "react";
import {
	ActivityIndicator,
	Pressable,
	type StyleProp,
	StyleSheet,
	View,
	type ViewStyle,
} from "react-native";
import {
	metrics,
	opacity,
	radius,
	spacing,
	type Tokens,
	useThemedStyles,
	useTokens,
} from "../theme";
import { AppText } from "./text";

type Variant = "primary" | "secondary" | "plain" | "danger";

type Props = {
	label: string;
	onPress: () => void;
	variant?: Variant;
	disabled?: boolean;
	busy?: boolean;
	icon?: ReactNode;
	accessibilityLabel?: string;
	accessibilityHint?: string;
	testID?: string;
	style?: StyleProp<ViewStyle>;
	compact?: boolean;
	/** Largest system text-size multiplier the label follows. */
	maxFontSizeMultiplier?: number;
};

/**
 * Native header bars keep their actions at a fixed size (iOS bar buttons
 * ignore Dynamic Type), so the screen title still fits beside them.
 */
const HEADER_TEXT_SCALE = 1.25;

export function Button({
	label,
	onPress,
	variant = "primary",
	disabled = false,
	busy = false,
	icon,
	accessibilityLabel,
	accessibilityHint,
	testID,
	style,
	compact = false,
	maxFontSizeMultiplier,
}: Props) {
	const tokens = useTokens();
	const styles = useThemedStyles(createStyles);
	const inactive = disabled || busy;
	const ink =
		variant === "primary"
			? tokens.onAccent
			: variant === "danger"
				? tokens.danger
				: tokens.accent;
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={accessibilityLabel ?? label}
			accessibilityHint={accessibilityHint}
			accessibilityState={{ disabled: inactive, busy }}
			disabled={inactive}
			onPress={onPress}
			testID={testID}
			hitSlop={variant === "plain" ? 8 : 0}
			style={({ pressed }) => [
				styles.base,
				compact && styles.compact,
				styles[variant],
				pressed && variant === "primary" && styles.primaryPressed,
				pressed && variant !== "primary" && styles.pressed,
				inactive && styles.disabled,
				style,
			]}
		>
			<View style={styles.content}>
				{busy ? <ActivityIndicator color={ink} /> : icon}
				<AppText
					variant="control"
					style={{ color: ink }}
					maxFontSizeMultiplier={maxFontSizeMultiplier}
				>
					{label}
				</AppText>
			</View>
		</Pressable>
	);
}

/** A text action in a navigation header bar. */
export function HeaderButton(
	props: Omit<Props, "variant" | "compact" | "maxFontSizeMultiplier">,
) {
	return (
		<Button
			{...props}
			variant="plain"
			compact
			maxFontSizeMultiplier={HEADER_TEXT_SCALE}
		/>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		base: {
			minHeight: metrics.controlHeight,
			borderRadius: radius.pill,
			paddingHorizontal: spacing.xl,
			justifyContent: "center",
			alignItems: "center",
		},
		compact: {
			minHeight: metrics.hitTarget,
			paddingHorizontal: spacing.lg,
		},
		content: {
			flexDirection: "row",
			alignItems: "center",
			gap: spacing.sm,
		},
		primary: { backgroundColor: colors.accent },
		primaryPressed: { backgroundColor: colors.accentPressed },
		secondary: {
			backgroundColor: colors.accentDim,
			borderWidth: StyleSheet.hairlineWidth,
			borderColor: colors.borderStrong,
		},
		plain: {
			minHeight: metrics.hitTarget,
			paddingHorizontal: spacing.sm,
			backgroundColor: "transparent",
		},
		danger: { backgroundColor: colors.dangerDim },
		pressed: { opacity: opacity.pressed },
		disabled: { opacity: opacity.disabled },
	});
