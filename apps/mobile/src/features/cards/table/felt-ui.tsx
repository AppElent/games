/** The small things that sit on the felt: text, gold and ghost buttons, pills. */
import type { ReactNode } from "react";
import {
	ActivityIndicator,
	Pressable,
	StyleSheet,
	type TextProps,
	View,
} from "react-native";
import Animated, { FadeIn, useReducedMotion } from "react-native-reanimated";
import { cardColors, metrics, opacity, radius, spacing } from "../../../theme";
import { AppText, type TextVariant } from "../../../ui/text";

/** The table's geometry is fixed, so its text may grow only so far. */
export const TABLE_TEXT_SCALE = 1.3;

export function FeltText({
	variant = "secondary",
	muted = false,
	style,
	...rest
}: TextProps & { variant?: TextVariant; muted?: boolean }) {
	return (
		<AppText
			variant={variant}
			maxFontSizeMultiplier={TABLE_TEXT_SCALE}
			style={[
				{ color: muted ? cardColors.ivoryMuted : cardColors.ivory },
				style,
			]}
			{...rest}
		/>
	);
}

export function TableButton({
	label,
	onPress,
	ghost = false,
	selected = false,
	disabled = false,
	busy = false,
	accessibilityHint,
	testID,
}: {
	label: string;
	onPress: () => void;
	ghost?: boolean;
	selected?: boolean;
	disabled?: boolean;
	busy?: boolean;
	accessibilityHint?: string;
	testID?: string;
}) {
	const inactive = disabled || busy;
	const ink = ghost ? cardColors.ivory : cardColors.onGold;
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={label}
			accessibilityHint={accessibilityHint}
			accessibilityState={{ disabled: inactive, busy, selected }}
			disabled={inactive}
			onPress={onPress}
			testID={testID}
			style={({ pressed }) => [
				styles.button,
				ghost ? styles.ghost : styles.gold,
				selected && styles.ghostOn,
				pressed && styles.pressed,
				inactive && styles.inactive,
			]}
		>
			{busy ? (
				<ActivityIndicator color={ink} />
			) : (
				<AppText
					variant="control"
					maxFontSizeMultiplier={TABLE_TEXT_SCALE}
					numberOfLines={1}
					adjustsFontSizeToFit
					style={{ color: ink }}
				>
					{label}
				</AppText>
			)}
		</Pressable>
	);
}

export function Pill({
	tone = "plain",
	icon,
	children,
}: {
	tone?: "plain" | "alert";
	icon?: ReactNode;
	children: string;
}) {
	const quiet = useReducedMotion();
	return (
		<Animated.View
			entering={quiet ? undefined : FadeIn.duration(180)}
			style={[styles.pill, tone === "alert" && styles.pillAlert]}
		>
			{icon}
			<FeltText
				variant="caption"
				style={tone === "alert" ? styles.alertText : null}
			>
				{children}
			</FeltText>
		</Animated.View>
	);
}

export function PillRow({ children }: { children: ReactNode }) {
	return <View style={styles.pills}>{children}</View>;
}

const styles = StyleSheet.create({
	button: {
		minHeight: metrics.hitTarget,
		flexShrink: 1,
		paddingHorizontal: spacing.lg,
		alignItems: "center",
		justifyContent: "center",
		borderRadius: radius.pill,
		overflow: "hidden",
	},
	gold: {
		backgroundImage: `linear-gradient(${cardColors.goldTop}, ${cardColors.goldBottom})`,
	},
	ghost: {
		backgroundColor: cardColors.chip,
		borderWidth: 1,
		borderColor: cardColors.ivoryLine,
	},
	ghostOn: { borderColor: cardColors.gold },
	pressed: { opacity: opacity.pressed },
	inactive: { opacity: opacity.disabled },
	pill: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.xs,
		minHeight: 26,
		paddingHorizontal: spacing.md,
		borderRadius: radius.pill,
		backgroundColor: cardColors.chip,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: cardColors.goldSoft,
	},
	pillAlert: {
		backgroundColor: cardColors.alertFill,
		borderColor: cardColors.alert,
	},
	alertText: { color: cardColors.alert, fontWeight: "800" },
	pills: {
		flexDirection: "row",
		flexWrap: "wrap",
		justifyContent: "center",
		gap: spacing.xs,
		minHeight: 26,
	},
});
