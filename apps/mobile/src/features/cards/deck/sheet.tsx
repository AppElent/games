/**
 * A native page sheet with a title and close action, swipe down to dismiss.
 * Its surface follows the app's scheme: it sits above the table, not on it.
 */
import type { ReactNode } from "react";
import { Modal, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useI18n } from "../../../i18n";
import { metrics, spacing, useTokens } from "../../../theme";
import { HeaderButton } from "../../../ui/button";
import { AppText } from "../../../ui/text";

export function Sheet({
	open,
	title,
	onClose,
	children,
}: {
	open: boolean;
	title: string;
	onClose: () => void;
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
						label={t.games.cards.table.close}
						onPress={onClose}
						testID="cards-sheet-close"
					/>
				</View>
				<ScrollView
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
