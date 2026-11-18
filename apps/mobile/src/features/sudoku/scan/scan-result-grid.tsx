/**
 * The recognized grid, as the verify step shows it: printed digits in the
 * text colour, the player's digits in the accent, notes small and muted.
 * Doubtful reads are amber, conflicting digits red; tap a cell to fix it.
 */
import { digitsInMask } from "@arcadeclub/core/sudoku";
import { isLowConfidence, type ScanCell } from "@arcadeclub/core/sudoku-scan";
import { Pressable, StyleSheet, View } from "react-native";
import Svg, { Line } from "react-native-svg";
import { fmt, useI18n } from "../../../i18n";
import {
	radius,
	type Tokens,
	useThemedStyles,
	useTokens,
} from "../../../theme";
import { AppText } from "../../../ui/text";

type Props = {
	cells: ScanCell[];
	conflicts: ReadonlySet<number>;
	selected: number | null;
	onSelect: (index: number) => void;
	size: number;
};

const BORDER = 2;
const LINES = Array.from({ length: 8 }, (_, i) => i + 1);

/** What a cell shows: its digit, "?" for a digit not read, or its notes. */
export function scanCellSummary(cell: ScanCell) {
	if (cell.type === "given" || cell.type === "userDigit") {
		return String(cell.digit || "?");
	}
	if (cell.type === "empty") return "";
	return [
		...digitsInMask(cell.cornerMask),
		...digitsInMask(cell.centerMask),
	].join("");
}

export function ScanResultGrid({
	cells,
	conflicts,
	selected,
	onSelect,
	size,
}: Props) {
	const tokens = useTokens();
	const styles = useThemedStyles(createStyles);
	const { t } = useI18n();
	const copy = t.games.sudoku.scan;
	const inner = size - BORDER * 2;
	const cell = inner / 9;

	return (
		<View style={[styles.board, { width: size, height: size }]}>
			{cells.map((entry, index) => {
				const row = Math.floor(index / 9);
				const col = index % 9;
				const doubtful = isLowConfidence(entry);
				const conflict = conflicts.has(index);
				const summary = scanCellSummary(entry);
				const notes =
					entry.type === "cornerNotes" || entry.type === "centerNotes";
				const typeLabel = {
					given: copy.cellTypeGiven,
					userDigit: copy.cellTypeUserDigit,
					cornerNotes: copy.cellTypeCornerNotes,
					centerNotes: copy.cellTypeCenterNotes,
					empty: copy.cellTypeEmpty,
				}[entry.type];
				return (
					<Pressable
						// biome-ignore lint/suspicious/noArrayIndexKey: fixed 81-cell grid
						key={index}
						accessibilityRole="button"
						accessibilityLabel={[
							fmt(copy.cellLabel, { row: row + 1, col: col + 1 }),
							typeLabel,
							summary,
							doubtful ? copy.lowConfidenceBadge : "",
						]
							.filter(Boolean)
							.join(", ")}
						accessibilityState={{ selected: selected === index }}
						onPress={() => onSelect(index)}
						testID={`scan-cell-${index}`}
						style={[
							styles.cell,
							{ left: col * cell, top: row * cell, width: cell, height: cell },
							conflict
								? { backgroundColor: tokens.dangerDim }
								: doubtful
									? { backgroundColor: tokens.amberDim }
									: null,
							selected === index && styles.selected,
						]}
					>
						<AppText
							variant={notes ? "cellNote" : "cellMedium"}
							allowFontScaling={false}
							numberOfLines={notes ? 2 : 1}
							style={[
								styles.digit,
								{
									color: conflict
										? tokens.danger
										: entry.type === "given"
											? tokens.text
											: entry.type === "userDigit"
												? tokens.accent
												: tokens.textMuted,
									fontWeight: entry.type === "given" ? "700" : "500",
								},
							]}
						>
							{summary}
						</AppText>
					</Pressable>
				);
			})}
			<Svg
				width={inner}
				height={inner}
				viewBox="0 0 9 9"
				style={StyleSheet.absoluteFill}
				pointerEvents="none"
			>
				{LINES.map((i) => {
					const thick = i % 3 === 0;
					const stroke = thick ? tokens.textMuted : tokens.borderStrong;
					const width = thick ? 0.045 : 0.018;
					return [
						<Line
							key={`v${i}`}
							x1={i}
							y1={0}
							x2={i}
							y2={9}
							stroke={stroke}
							strokeWidth={width}
						/>,
						<Line
							key={`h${i}`}
							x1={0}
							y1={i}
							x2={9}
							y2={i}
							stroke={stroke}
							strokeWidth={width}
						/>,
					];
				})}
			</Svg>
		</View>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		board: {
			alignSelf: "center",
			borderRadius: radius.sm,
			borderWidth: BORDER,
			borderColor: colors.textMuted,
			backgroundColor: colors.surface,
			overflow: "hidden",
		},
		cell: {
			position: "absolute",
			alignItems: "center",
			justifyContent: "center",
		},
		selected: {
			borderWidth: 2,
			borderColor: colors.accent,
			backgroundColor: colors.accentDim,
		},
		digit: { textAlign: "center" },
	});
