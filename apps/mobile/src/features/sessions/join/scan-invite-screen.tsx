/**
 * Scan the invite QR code a host shows (web lobby or share sheet). A valid
 * code opens the Join tab filled in, exactly as tapping the invite link
 * would, so the player still confirms their name before joining.
 */
import { type Invite, parseInvite } from "@arcadeclub/core/sessions";
import {
	type BarcodeScanningResult,
	CameraView,
	useCameraPermissions,
} from "expo-camera";
import { Stack, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Linking, Platform, StyleSheet, View } from "react-native";
import { haptics } from "../../../feedback/haptics";
import { useI18n } from "../../../i18n";
import { radius, spacing, type Tokens, useThemedStyles } from "../../../theme";
import { Button, HeaderButton } from "../../../ui/button";
import { Notice } from "../../../ui/notice";
import { AppText } from "../../../ui/text";

export function ScanInviteScreen() {
	const router = useRouter();
	const { t } = useI18n();
	const copy = t.common.joinPanel;
	const styles = useThemedStyles(createStyles);
	const [permission, requestPermission] = useCameraPermissions();
	const [rejected, setRejected] = useState<string | null>(null);
	// The camera keeps reporting the same code until the screen closes.
	const opened = useRef(false);

	useEffect(() => {
		if (permission && !permission.granted && permission.canAskAgain) {
			requestPermission();
		}
	}, [permission, requestPermission]);

	function open(invite: Invite) {
		opened.current = true;
		haptics.valueEntered();
		router.dismissTo({ pathname: "/join", params: invite });
	}

	function scanned({ data }: BarcodeScanningResult) {
		if (opened.current) return;
		const invite = parseInvite(data);
		if (invite) return open(invite);
		if (data !== rejected) {
			setRejected(data);
			haptics.moveRejected();
		}
	}

	const denied = permission && !permission.granted && !permission.canAskAgain;

	return (
		<View style={styles.root}>
			<Stack.Screen
				options={{
					title: copy.scan,
					headerRight:
						Platform.OS === "ios"
							? () => (
									<HeaderButton
										label={t.common.actions.close}
										onPress={() => router.back()}
									/>
								)
							: undefined,
				}}
			/>
			{denied ? (
				<View style={styles.denied}>
					<AppText variant="secondary" tone="default">
						{copy.cameraDenied}
					</AppText>
					<Button
						variant="secondary"
						label={copy.openSettings}
						onPress={() => Linking.openSettings()}
					/>
				</View>
			) : (
				<>
					<View style={styles.viewfinder}>
						{permission?.granted ? (
							<CameraView
								style={StyleSheet.absoluteFill}
								facing="back"
								barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
								onBarcodeScanned={scanned}
								testID="scan-camera"
							/>
						) : null}
					</View>
					<AppText variant="secondary" style={styles.hint}>
						{copy.scanHint}
					</AppText>
					<Notice message={rejected ? copy.scanInvalid : null} />
				</>
			)}
		</View>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		root: {
			flex: 1,
			backgroundColor: colors.bg,
			padding: spacing.lg,
			gap: spacing.lg,
		},
		viewfinder: {
			width: "100%",
			maxWidth: 480,
			aspectRatio: 1,
			alignSelf: "center",
			borderRadius: radius.lg,
			borderCurve: "continuous",
			overflow: "hidden",
			backgroundColor: colors.surface,
		},
		hint: { textAlign: "center" },
		denied: { gap: spacing.lg, paddingTop: spacing.xl },
	});
