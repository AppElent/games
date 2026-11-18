/**
 * Scan a paper sudoku: take or choose a photo, place the grid's corners,
 * let the phone read the cells, check the result, then play it as a classic
 * puzzle saved like any other. iOS only: the reading runs on Apple Vision.
 */
import { useAuth } from "@clerk/expo";
import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import {
	ActivityIndicator,
	Image,
	Linking,
	StyleSheet,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { haptics } from "../../../feedback/haptics";
import { fmt, useI18n } from "../../../i18n";
import { reportError } from "../../../observability/report";
import {
	metrics,
	radius,
	spacing,
	type Tokens,
	useThemedStyles,
	useTokens,
} from "../../../theme";
import { Button } from "../../../ui/button";
import { CenteredState } from "../../../ui/centered-state";
import { Icon } from "../../../ui/icon";
import { Notice } from "../../../ui/notice";
import { Screen } from "../../../ui/screen";
import { AppText } from "../../../ui/text";
import { sudokuSaveHref, writeSudokuSave } from "../saves/sudoku-save-store";
import { createScanSave } from "./create-scan-save";
import { ScanCornerEditor } from "./scan-corner-editor";
import { ScanVerifyStep } from "./scan-verify-step";
import { useSudokuScan } from "./use-sudoku-scan";

export function SudokuScanScreen() {
	const router = useRouter();
	const tokens = useTokens();
	const styles = useThemedStyles(createStyles);
	const insets = useSafeAreaInsets();
	const { t } = useI18n();
	const copy = t.games.sudoku.scan;
	const { isSignedIn, userId } = useAuth();
	const scan = useSudokuScan(copy);
	const { step } = scan;
	const [saveFailed, setSaveFailed] = useState(false);

	function play(cells: Parameters<typeof createScanSave>[0]) {
		try {
			const save = createScanSave(cells, isSignedIn && userId ? userId : null);
			writeSudokuSave(save);
			router.replace(sudokuSaveHref(save.id));
		} catch (error) {
			reportError(error);
			setSaveFailed(true);
			haptics.actionFailed();
		}
	}

	const title = <Stack.Screen options={{ title: copy.pageHeading }} />;
	const footer = { paddingBottom: insets.bottom + spacing.lg };

	if (step.id === "preparing") {
		return (
			<>
				{title}
				<CenteredState loading message={copy.preparingImage} />
			</>
		);
	}

	if (step.id === "reading") {
		return (
			<>
				{title}
				<View style={styles.fill}>
					<View style={styles.reading}>
						{step.gridUri ? (
							<Image
								source={{ uri: step.gridUri }}
								style={styles.preview}
								accessibilityLabel={copy.correctedGridAlt}
								accessibilityIgnoresInvertColors
							/>
						) : null}
						<ActivityIndicator color={tokens.accent} />
						<AppText variant="secondary" accessibilityLiveRegion="polite">
							{step.gridUri
								? fmt(copy.readingCells, { done: step.done, total: 81 })
								: copy.preparingImage}
						</AppText>
					</View>
				</View>
			</>
		);
	}

	if (step.id === "corners") {
		return (
			<>
				{title}
				<View style={[styles.fill, styles.corners, footer]}>
					<AppText variant="secondary">{copy.dragCorners}</AppText>
					<ScanCornerEditor
						photo={step.photo}
						corners={step.corners}
						onChange={scan.moveCorners}
					/>
					<Notice message={scan.error} />
					<View style={styles.group}>
						<Button
							label={copy.readGrid}
							onPress={scan.read}
							testID="scan-read"
						/>
						<Button
							label={copy.startOver}
							variant="secondary"
							onPress={scan.startOver}
						/>
					</View>
				</View>
			</>
		);
	}

	if (step.id === "verify") {
		return (
			<>
				{title}
				<Screen>
					<ScanVerifyStep
						gridUri={step.gridUri}
						cells={step.cells}
						onChange={scan.editCells}
						onStartOver={scan.startOver}
						onConfirm={() => play(step.cells)}
						error={saveFailed ? copy.couldNotCreateSession : null}
					/>
				</Screen>
			</>
		);
	}

	return (
		<>
			{title}
			<Screen>
				<View style={styles.intro}>
					<View style={styles.mark}>
						<Icon
							ios="viewfinder"
							android="document_scanner"
							size={32}
							color={tokens.accent}
						/>
					</View>
					<AppText variant="secondary">{copy.photoInstructions}</AppText>
				</View>
				<View style={styles.group}>
					<Button
						label={copy.takePhoto}
						onPress={() => scan.pick("camera")}
						icon={
							<Icon
								ios="camera.fill"
								android="photo_camera"
								size={18}
								color={tokens.onAccent}
							/>
						}
						testID="scan-camera"
					/>
					<Button
						label={copy.choosePhoto}
						variant="secondary"
						onPress={() => scan.pick("library")}
						icon={
							<Icon
								ios="photo.on.rectangle"
								android="photo_library"
								size={18}
								color={tokens.accent}
							/>
						}
						testID="scan-library"
					/>
					<Notice message={scan.error} />
					{scan.cameraBlocked ? (
						<Button
							label={t.common.joinPanel.openSettings}
							variant="plain"
							onPress={() => Linking.openSettings()}
						/>
					) : null}
				</View>
			</Screen>
		</>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		fill: { flex: 1, backgroundColor: colors.bg },
		corners: {
			paddingHorizontal: metrics.screenGutter,
			paddingTop: spacing.lg,
			gap: spacing.md,
		},
		reading: {
			flex: 1,
			alignItems: "center",
			justifyContent: "center",
			gap: spacing.lg,
			padding: metrics.screenGutter,
		},
		preview: {
			width: 220,
			height: 220,
			borderRadius: radius.sm,
			borderWidth: StyleSheet.hairlineWidth,
			borderColor: colors.borderStrong,
		},
		intro: { alignItems: "center", gap: spacing.md },
		mark: {
			width: 72,
			height: 72,
			borderRadius: radius.lg,
			backgroundColor: colors.accentDim,
			alignItems: "center",
			justifyContent: "center",
		},
		group: { gap: spacing.md },
	});
