/** An invite as a QR code for another phone's camera. */
import { StyleSheet, View } from "react-native";
import { useI18n } from "../../../i18n";
import { radius } from "../../../theme";
import { QrCode } from "../../../ui/qr-code";

export function InviteQr({ value, size }: { value: string; size: number }) {
	const { t } = useI18n();
	return (
		<View style={styles.qr}>
			<QrCode
				value={value}
				size={size}
				accessibilityLabel={t.common.joinPanel.scanQrLabel}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	qr: { alignSelf: "center", borderRadius: radius.sm, overflow: "hidden" },
});
