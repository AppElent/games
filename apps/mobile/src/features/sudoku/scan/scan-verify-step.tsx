/**
 * Check the recognized grid before playing: doubtful cells are amber and the
 * first one starts selected, conflicts are red, and the puzzle starts only
 * once its givens make a solvable sudoku.
 */
import {
	describeScanErrors,
	isLowConfidence,
	type ScanCell,
	validateScanResult,
} from "@arcadeclub/core/sudoku-scan";
import { useMemo, useState } from "react";
import { Image, StyleSheet, useWindowDimensions, View } from "react-native";
import { plural, useI18n } from "../../../i18n";
import {
	metrics,
	radius,
	spacing,
	type Tokens,
	useThemedStyles,
} from "../../../theme";
import { Button } from "../../../ui/button";
import { Notice } from "../../../ui/notice";
import { AppText } from "../../../ui/text";
import { ScanCellEditor } from "./scan-cell-editor";
import { ScanResultGrid } from "./scan-result-grid";

type Props = {
	gridUri: string;
	cells: ScanCell[];
	onChange: (cells: ScanCell[]) => void;
	onStartOver: () => void;
	onConfirm: () => void;
	error: string | null;
};

/** The grid's largest side, so it stays a comfortable size on a tablet. */
const MAX_GRID = 440;

export function ScanVerifyStep({
	gridUri,
	cells,
	onChange,
	onStartOver,
	onConfirm,
	error,
}: Props) {
	const styles = useThemedStyles(createStyles);
	const { t, locale } = useI18n();
	const copy = t.games.sudoku.scan;
	const { width } = useWindowDimensions();
	const size = Math.min(width - metrics.screenGutter * 2, MAX_GRID);
	const [selected, setSelected] = useState<number | null>(() => {
		const first = cells.findIndex(isLowConfidence);
		return first >= 0 ? first : null;
	});
	const validation = useMemo(() => validateScanResult(cells), [cells]);
	const conflicts = useMemo(
		() => new Set(validation.conflictCells),
		[validation],
	);
	const doubtful = cells.filter(isLowConfidence).length;

	return (
		<>
			<View style={styles.group}>
				<AppText variant="label" accessibilityRole="header">
					{copy.recognizedGridLabel.toUpperCase()}
				</AppText>
				<ScanResultGrid
					cells={cells}
					conflicts={conflicts}
					selected={selected}
					onSelect={setSelected}
					size={size}
				/>
				<View style={styles.summary}>
					<Image
						source={{ uri: gridUri }}
						style={styles.thumbnail}
						accessibilityLabel={copy.correctedGridAlt}
						accessibilityIgnoresInvertColors
					/>
					<AppText variant="secondary" style={styles.grow}>
						{doubtful > 0
							? plural(locale, doubtful, copy.lowConfidenceHighlighted)
							: copy.allConfident}
					</AppText>
				</View>
			</View>
			{selected !== null ? (
				<ScanCellEditor cells={cells} index={selected} onChange={onChange} />
			) : null}
			<View style={styles.group}>
				<Notice
					message={
						describeScanErrors(validation, copy.validation, locale).join(
							"\n",
						) || null
					}
				/>
				<Notice
					tone="info"
					message={
						validation.ok
							? validation.givensUnique
								? copy.uniqueSolution
								: copy.multipleSolutionsWarning
							: null
					}
				/>
				<Notice message={error} />
				<Button
					label={copy.confirmAndPlay}
					onPress={onConfirm}
					disabled={!validation.ok}
					testID="scan-confirm"
				/>
				<Button
					label={copy.startOver}
					variant="secondary"
					onPress={onStartOver}
				/>
			</View>
		</>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		group: { gap: spacing.md },
		summary: { flexDirection: "row", alignItems: "center", gap: spacing.md },
		thumbnail: {
			width: 72,
			height: 72,
			borderRadius: radius.sm,
			borderWidth: StyleSheet.hairlineWidth,
			borderColor: colors.borderStrong,
		},
		grow: { flex: 1 },
	});
