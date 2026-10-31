/**
 * A scrolling screen body with the standard gutter, a max content width for
 * tablets, and keyboard-aware insets. Native headers own the top inset, so
 * this applies the bottom one only when there is no tab bar beneath it.
 */
import type { ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { metrics, spacing, type Tokens, useThemedStyles } from "../theme";

type Props = {
	children: ReactNode;
	/** Screens under a tab bar let the bar own the bottom inset. */
	inTabs?: boolean;
	testID?: string;
};

export function Screen({ children, inTabs = false, testID }: Props) {
	const styles = useThemedStyles(createStyles);
	const insets = useSafeAreaInsets();
	return (
		<ScrollView
			style={styles.root}
			contentInsetAdjustmentBehavior="automatic"
			keyboardShouldPersistTaps="handled"
			automaticallyAdjustKeyboardInsets
			contentContainerStyle={[
				styles.content,
				{ paddingBottom: (inTabs ? 0 : insets.bottom) + spacing.xxl },
			]}
			testID={testID}
		>
			<View style={styles.column}>{children}</View>
		</ScrollView>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		root: { flex: 1, backgroundColor: colors.bg },
		content: {
			paddingHorizontal: metrics.screenGutter,
			paddingTop: spacing.lg,
		},
		column: {
			width: "100%",
			maxWidth: metrics.contentMaxWidth,
			alignSelf: "center",
			gap: spacing.lg,
		},
	});
