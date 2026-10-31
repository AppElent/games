/** An inline message: an error under a form, or a calm informational note. */
import { StyleSheet, View } from "react-native";
import { radius, spacing, type Tokens, useThemedStyles } from "../theme";
import { AppText } from "./text";

type Props = {
	message: string | null | undefined;
	tone?: "error" | "info";
};

export function Notice({ message, tone = "error" }: Props) {
	const styles = useThemedStyles(createStyles);
	if (!message) return null;
	return (
		<View
			accessibilityLiveRegion="polite"
			accessibilityRole={tone === "error" ? "alert" : "text"}
			style={[styles.root, tone === "error" ? styles.error : styles.info]}
		>
			<AppText variant="secondary" tone="default">
				{message}
			</AppText>
		</View>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		root: {
			borderRadius: radius.md,
			paddingHorizontal: spacing.lg,
			paddingVertical: spacing.md,
		},
		error: { backgroundColor: colors.dangerDim },
		info: { backgroundColor: colors.accentDim },
	});
