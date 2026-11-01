/**
 * Shown in place of a "host" action when nobody is signed in: hosting needs
 * an account, joining does not.
 */
import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";
import { useI18n } from "../../../i18n";
import { spacing } from "../../../theme";
import { Button } from "../../../ui/button";
import { AppText } from "../../../ui/text";

export function HostGate() {
	const router = useRouter();
	const { t } = useI18n();
	return (
		<View style={styles.gate}>
			<AppText variant="body">{t.common.hostGate.heading}</AppText>
			<AppText variant="secondary">{t.common.hostGate.body}</AppText>
			<Button
				variant="secondary"
				label={t.common.actions.signIn}
				onPress={() => router.push("/sign-in")}
				testID="host-gate-sign-in"
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	gate: { gap: spacing.sm },
});
