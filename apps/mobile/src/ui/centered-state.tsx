/** A full-screen loading, empty or error state with an optional action. */
import { ActivityIndicator, StyleSheet, View } from "react-native";
import {
	metrics,
	spacing,
	type Tokens,
	useThemedStyles,
	useTokens,
} from "../theme";
import { Button } from "./button";
import { AppText } from "./text";

type Props = {
	title?: string;
	message?: string;
	loading?: boolean;
	action?: { label: string; onPress: () => void };
};

export function CenteredState({ title, message, loading, action }: Props) {
	const tokens = useTokens();
	const styles = useThemedStyles(createStyles);
	return (
		<View style={styles.root}>
			{loading ? <ActivityIndicator color={tokens.accent} /> : null}
			{title ? (
				<AppText variant="heading" style={styles.center}>
					{title}
				</AppText>
			) : null}
			{message ? (
				<AppText variant="secondary" style={styles.center}>
					{message}
				</AppText>
			) : null}
			{action ? (
				<Button label={action.label} onPress={action.onPress} compact />
			) : null}
		</View>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		root: {
			flex: 1,
			backgroundColor: colors.bg,
			alignItems: "center",
			justifyContent: "center",
			gap: spacing.md,
			padding: metrics.screenGutter,
		},
		center: { textAlign: "center" },
	});
