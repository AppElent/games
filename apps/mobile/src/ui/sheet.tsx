/**
 * A native page sheet with a title and close action, swipe down to dismiss.
 * Its surface follows the app's scheme, also over a table. A form in it keeps
 * its focused field above the keyboard.
 */
import type { ReactNode } from "react";
import { Modal, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useI18n } from "../i18n";
import { metrics, spacing, useTokens } from "../theme";
import { HeaderButton } from "./button";
import { AppText } from "./text";

export function Sheet({
	open,
	title,
	onClose,
	closeLabel,
	closeTestID = "sheet-close",
	children,
}: {
	open: boolean;
	title: string;
	onClose: () => void;
	/** The close action's name when it does more than close, such as Cancel. */
	closeLabel?: string;
	closeTestID?: string;
	children: ReactNode;
}) {
	const { t } = useI18n();
	const tokens = useTokens();
	const insets = useSafeAreaInsets();
	return (
		<Modal
			visible={open}
			presentationStyle="pageSheet"
			animationType="slide"
			allowSwipeDismissal
			onRequestClose={onClose}
		>
			<View style={[styles.root, { backgroundColor: tokens.bg }]}>
				<View style={styles.header}>
					<AppText
						variant="heading"
						accessibilityRole="header"
						style={styles.title}
					>
						{title}
					</AppText>
					<HeaderButton
						label={closeLabel ?? t.common.actions.close}
						onPress={onClose}
						testID={closeTestID}
					/>
				</View>
				<ScrollView
					automaticallyAdjustKeyboardInsets
					keyboardShouldPersistTaps="handled"
					contentContainerStyle={[
						styles.content,
						{ paddingBottom: insets.bottom + spacing.xxl },
					]}
				>
					{children}
				</ScrollView>
			</View>
		</Modal>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1 },
	header: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.md,
		paddingLeft: metrics.screenGutter,
		paddingRight: spacing.md,
		paddingTop: spacing.md,
		paddingBottom: spacing.sm,
	},
	title: { flex: 1 },
	content: {
		paddingHorizontal: metrics.screenGutter,
		paddingTop: spacing.sm,
		gap: spacing.xl,
	},
});
