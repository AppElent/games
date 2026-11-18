/**
 * Fixes one recognized cell: what kind of cell it is, its digit or its
 * notes, or clear it. The corrections are the web verifier's, from
 * `@arcadeclub/core/sudoku-scan`.
 */
import { digitMask } from "@arcadeclub/core/sudoku";
import {
	clearScanCell,
	isLowConfidence,
	type ScanCell,
	type ScanCellType,
	setScanCellDigit,
	setScanCellType,
	toggleScanCellNote,
} from "@arcadeclub/core/sudoku-scan";
import { Pressable, StyleSheet, View } from "react-native";
import { haptics } from "../../../feedback/haptics";
import { fmt, useI18n } from "../../../i18n";
import {
	opacity,
	radius,
	spacing,
	type Tokens,
	useThemedStyles,
	useTokens,
} from "../../../theme";
import { Button } from "../../../ui/button";
import { Card } from "../../../ui/card";
import { AppText } from "../../../ui/text";

type Props = {
	cells: ScanCell[];
	index: number;
	onChange: (cells: ScanCell[]) => void;
};

const CELL_TYPES: readonly ScanCellType[] = [
	"given",
	"userDigit",
	"cornerNotes",
	"centerNotes",
	"empty",
];
const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export function ScanCellEditor({ cells, index, onChange }: Props) {
	const styles = useThemedStyles(createStyles);
	const tokens = useTokens();
	const { t } = useI18n();
	const copy = t.games.sudoku.scan;
	const cell = cells[index];
	const typeLabels: Record<ScanCellType, string> = {
		given: copy.cellTypeGiven,
		userDigit: copy.cellTypeUserDigit,
		cornerNotes: copy.cellTypeCornerNotes,
		centerNotes: copy.cellTypeCenterNotes,
		empty: copy.cellTypeEmpty,
	};

	function change(next: ScanCell[]) {
		haptics.selectionChanged();
		onChange(next);
	}

	return (
		<Card>
			<View style={styles.root}>
				<View style={styles.header}>
					<AppText variant="heading" accessibilityRole="header">
						{fmt(copy.cellLabel, {
							row: Math.floor(index / 9) + 1,
							col: (index % 9) + 1,
						})}
					</AppText>
					{isLowConfidence(cell) ? (
						<View style={styles.badge}>
							<AppText variant="caption" style={{ color: tokens.amber }}>
								{copy.lowConfidenceBadge}
							</AppText>
						</View>
					) : null}
				</View>
				<View style={styles.chips} accessibilityRole="radiogroup">
					{CELL_TYPES.map((type) => (
						<Toggle
							key={type}
							label={typeLabels[type]}
							active={cell.type === type}
							onPress={() => change(setScanCellType(cells, index, type))}
							testID={`scan-type-${type}`}
						/>
					))}
				</View>
				{cell.type === "given" || cell.type === "userDigit" ? (
					<View style={styles.keys}>
						{DIGITS.map((digit) => (
							<Key
								key={digit}
								digit={digit}
								active={cell.digit === digit}
								onPress={() => change(setScanCellDigit(cells, index, digit))}
							/>
						))}
					</View>
				) : null}
				{cell.type === "cornerNotes" || cell.type === "centerNotes"
					? (["corner", "center"] as const).map((kind) => {
							const mask =
								kind === "corner" ? cell.cornerMask : cell.centerMask;
							return (
								<View key={kind} style={styles.noteRow}>
									<AppText variant="label">
										{t.games.sudoku.keypad.modes[kind].toUpperCase()}
									</AppText>
									<View style={styles.keys}>
										{DIGITS.map((digit) => (
											<Key
												key={digit}
												digit={digit}
												small
												active={(mask & digitMask(digit)) !== 0}
												onPress={() =>
													change(toggleScanCellNote(cells, index, kind, digit))
												}
											/>
										))}
									</View>
								</View>
							);
						})
					: null}
				<Button
					label={copy.clearCell}
					variant="plain"
					compact
					onPress={() => change(clearScanCell(cells, index))}
					style={styles.clear}
				/>
			</View>
		</Card>
	);
}

function Toggle({
	label,
	active,
	onPress,
	testID,
}: {
	label: string;
	active: boolean;
	onPress: () => void;
	testID?: string;
}) {
	const styles = useThemedStyles(createStyles);
	const tokens = useTokens();
	return (
		<Pressable
			accessibilityRole="radio"
			accessibilityState={{ checked: active }}
			onPress={onPress}
			testID={testID}
			style={({ pressed }) => [
				styles.chip,
				active && styles.active,
				pressed && { opacity: opacity.pressed },
			]}
		>
			<AppText
				variant="secondary"
				style={{ color: active ? tokens.onAccent : tokens.text }}
			>
				{label}
			</AppText>
		</Pressable>
	);
}

function Key({
	digit,
	active,
	small = false,
	onPress,
}: {
	digit: number;
	active: boolean;
	small?: boolean;
	onPress: () => void;
}) {
	const styles = useThemedStyles(createStyles);
	const tokens = useTokens();
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={String(digit)}
			accessibilityState={{ selected: active }}
			onPress={onPress}
			testID={`scan-key-${digit}`}
			style={({ pressed }) => [
				styles.key,
				small && styles.smallKey,
				active && styles.active,
				pressed && { opacity: opacity.pressed },
			]}
		>
			<AppText
				variant={small ? "cellMedium" : "keypad"}
				allowFontScaling={false}
				style={{ color: active ? tokens.onAccent : tokens.text }}
			>
				{digit}
			</AppText>
		</Pressable>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		root: { gap: spacing.md },
		header: {
			flexDirection: "row",
			alignItems: "center",
			gap: spacing.sm,
		},
		badge: {
			paddingHorizontal: spacing.sm,
			paddingVertical: spacing.xxs,
			borderRadius: radius.pill,
			backgroundColor: colors.amberDim,
		},
		chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
		chip: {
			minHeight: 36,
			justifyContent: "center",
			paddingHorizontal: spacing.md,
			borderRadius: radius.pill,
			borderWidth: StyleSheet.hairlineWidth,
			borderColor: colors.borderStrong,
			backgroundColor: colors.surface2,
		},
		active: { backgroundColor: colors.accent, borderColor: colors.accent },
		keys: { flexDirection: "row", gap: spacing.xs },
		noteRow: { gap: spacing.xs },
		key: {
			flex: 1,
			minHeight: 48,
			alignItems: "center",
			justifyContent: "center",
			borderRadius: radius.sm,
			borderWidth: StyleSheet.hairlineWidth,
			borderColor: colors.borderStrong,
			backgroundColor: colors.surface2,
		},
		smallKey: { minHeight: 40 },
		clear: { alignSelf: "flex-start" },
	});
