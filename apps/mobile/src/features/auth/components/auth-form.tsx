/**
 * The frame every auth screen shares: a heading, a short reason, the fields,
 * one error slot, and a footer of secondary links.
 */
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { spacing } from "../../../theme";
import { Notice } from "../../../ui/notice";
import { Screen } from "../../../ui/screen";
import { AppText } from "../../../ui/text";

type Props = {
	title: string;
	subtitle?: string;
	error?: string | null;
	notice?: string | null;
	children: ReactNode;
	footer?: ReactNode;
};

export function AuthForm({
	title,
	subtitle,
	error,
	notice,
	children,
	footer,
}: Props) {
	return (
		<Screen>
			<View style={styles.heading}>
				<AppText variant="title" accessibilityRole="header">
					{title}
				</AppText>
				{subtitle ? <AppText variant="secondary">{subtitle}</AppText> : null}
			</View>
			<View style={styles.fields}>{children}</View>
			<Notice message={error} />
			<Notice message={notice} tone="info" />
			{footer ? <View style={styles.footer}>{footer}</View> : null}
		</Screen>
	);
}

const styles = StyleSheet.create({
	heading: { gap: spacing.xs, paddingTop: spacing.sm },
	fields: { gap: spacing.md },
	footer: { alignItems: "center", gap: spacing.xs },
});
