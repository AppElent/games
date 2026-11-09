/**
 * The 9×9 board. Cells are absolutely placed squares; grid lines and Killer
 * cage outlines are one SVG overlay that ignores touches, so the box borders
 * stay crisp at any size and cells never shift by a border width.
 *
 * Board glyphs do not follow Dynamic Type (`allowFontScaling={false}`): a
 * digit is sized to its cell, and the cell is sized to the screen.
 */
import { colOf, digitsInMask, rowOf } from "@arcadeclub/core/sudoku";
import {
	effectiveGrid,
	type SudokuBoardState,
} from "@arcadeclub/core/sudoku-board";
import {
	type KillerCage,
	type KillerCageLayout,
	killerCageLayout,
} from "@arcadeclub/core/sudoku-killer";
import { memo, useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Svg, { Line } from "react-native-svg";
import { fmt, useI18n } from "../../../i18n";
import {
	markerColors,
	type Tokens,
	useThemedStyles,
	useTokens,
} from "../../../theme";
import { AppText } from "../../../ui/text";

type Props = {
	board: SudokuBoardState;
	size: number;
	selectedCell: number | null;
	onSelectCell: (cell: number) => void;
	conflicts: ReadonlySet<number>;
	/** Cells a hint points at, once the player asks for more than its name. */
	hintCells: ReadonlySet<number> | undefined;
	cages?: KillerCage[];
	hidden: boolean;
};

const BOARD_BORDER = 2;
const CELLS = Array.from({ length: 81 }, (_, index) => index);

/** Cage outline segments, inset from the cell edge so sums and lines don't collide. */
function cageSegments(
	{ top, bottom, left, right }: KillerCageLayout["edges"][number],
	cell: number,
	inset: number,
) {
	const row = rowOf(cell);
	const col = colOf(cell);
	const x0 = col + (left ? inset : 0);
	const x1 = col + 1 - (right ? inset : 0);
	const y0 = row + (top ? inset : 0);
	const y1 = row + 1 - (bottom ? inset : 0);
	const segments: [number, number, number, number][] = [];
	if (top) segments.push([x0, row + inset, x1, row + inset]);
	if (bottom) segments.push([x0, row + 1 - inset, x1, row + 1 - inset]);
	if (left) segments.push([col + inset, y0, col + inset, y1]);
	if (right) segments.push([col + 1 - inset, y0, col + 1 - inset, y1]);
	return segments;
}

export function SudokuBoard({
	board,
	size,
	selectedCell,
	onSelectCell,
	conflicts,
	hintCells,
	cages,
	hidden,
}: Props) {
	const tokens = useTokens();
	const styles = useThemedStyles(createStyles);
	const grid = effectiveGrid(board);
	const inner = size - BOARD_BORDER * 2;
	const cell = inner / 9;
	const cageInfo = useMemo(() => killerCageLayout(cages), [cages]);

	const selectedDigit =
		selectedCell !== null && grid[selectedCell] !== 0 ? grid[selectedCell] : 0;
	const selRow = selectedCell !== null ? rowOf(selectedCell) : -1;
	const selCol = selectedCell !== null ? colOf(selectedCell) : -1;

	const lines = useMemo(() => {
		const out: {
			key: string;
			x1: number;
			y1: number;
			x2: number;
			y2: number;
			thick: boolean;
		}[] = [];
		for (let index = 1; index < 9; index += 1) {
			const thick = index % 3 === 0;
			out.push({ key: `v${index}`, x1: index, y1: 0, x2: index, y2: 9, thick });
			out.push({ key: `h${index}`, x1: 0, y1: index, x2: 9, y2: index, thick });
		}
		return out;
	}, []);

	const cageLines = useMemo(() => {
		if (!cageInfo) return [];
		const inset = 0.08;
		return Array.from({ length: 81 }, (_, index) =>
			cageSegments(cageInfo.edges[index], index, inset),
		).flat();
	}, [cageInfo]);

	return (
		<View
			style={[styles.board, { width: size, height: size }]}
			accessibilityRole="none"
		>
			{CELLS.map((index) => {
				const value = grid[index];
				const row = rowOf(index);
				const col = colOf(index);
				const isSelected = index === selectedCell;
				const isPeer =
					!isSelected &&
					selectedCell !== null &&
					(row === selRow ||
						col === selCol ||
						(Math.floor(row / 3) === Math.floor(selRow / 3) &&
							Math.floor(col / 3) === Math.floor(selCol / 3)));
				return (
					<BoardCell
						key={index}
						cell={index}
						size={cell}
						value={hidden ? 0 : value}
						given={board.givens[index] !== 0}
						corner={hidden ? 0 : board.corner[index]}
						center={hidden ? 0 : board.center[index]}
						marker={hidden ? 0 : board.colors[index]}
						cageSum={hidden ? undefined : cageInfo?.sumAt.get(index)}
						selected={isSelected}
						peer={isPeer}
						sameDigit={
							!hidden &&
							selectedDigit !== 0 &&
							value === selectedDigit &&
							!isSelected
						}
						conflict={!hidden && conflicts.has(index)}
						hinted={!hidden && (hintCells?.has(index) ?? false)}
						onPress={onSelectCell}
					/>
				);
			})}
			<Svg
				width={inner}
				height={inner}
				viewBox="0 0 9 9"
				style={StyleSheet.absoluteFill}
				pointerEvents="none"
			>
				{hidden
					? null
					: cageLines.map(([x1, y1, x2, y2], index) => (
							<Line
								// biome-ignore lint/suspicious/noArrayIndexKey: static per board
								key={`c${index}`}
								x1={x1}
								y1={y1}
								x2={x2}
								y2={y2}
								stroke={tokens.textMuted}
								strokeWidth={0.025}
								strokeDasharray="0.07 0.05"
							/>
						))}
				{lines.map((line) => (
					<Line
						key={line.key}
						x1={line.x1}
						y1={line.y1}
						x2={line.x2}
						y2={line.y2}
						stroke={line.thick ? tokens.textMuted : tokens.borderStrong}
						strokeWidth={line.thick ? 0.045 : 0.018}
					/>
				))}
			</Svg>
		</View>
	);
}

type CellProps = {
	cell: number;
	size: number;
	value: number;
	given: boolean;
	corner: number;
	center: number;
	marker: number;
	cageSum?: number;
	selected: boolean;
	peer: boolean;
	sameDigit: boolean;
	conflict: boolean;
	hinted: boolean;
	onPress: (cell: number) => void;
};

/** Corner-note slots, in fill order: corners, then edge midpoints. */
const CORNER_SLOTS = [
	{ left: "6%", top: "2%" },
	{ right: "6%", top: "2%" },
	{ left: "6%", bottom: "2%" },
	{ right: "6%", bottom: "2%" },
	{ left: "40%", top: "2%" },
	{ left: "40%", bottom: "2%" },
	{ left: "6%", top: "34%" },
	{ right: "6%", top: "34%" },
] as const;

const BoardCell = memo(function BoardCell({
	cell,
	size,
	value,
	given,
	corner,
	center,
	marker,
	cageSum,
	selected,
	peer,
	sameDigit,
	conflict,
	hinted,
	onPress,
}: CellProps) {
	const tokens = useTokens();
	const styles = useThemedStyles(createStyles);
	const { t } = useI18n();
	const copy = t.games.sudoku.board;
	const row = rowOf(cell);
	const col = colOf(cell);

	const background = selected
		? tokens.accentDim
		: hinted
			? tokens.orangeDim
			: sameDigit
				? tokens.accentDim
				: peer
					? tokens.surface2
					: "transparent";
	const digitColor = conflict
		? tokens.danger
		: given
			? tokens.text
			: tokens.accent;
	const cornerDigits = digitsInMask(corner);
	const centerDigits = digitsInMask(center);

	const state =
		value !== 0
			? `${value}${given ? `, ${copy.given}` : ""}`
			: cornerDigits.length + centerDigits.length > 0
				? fmt(copy.notes, {
						digits: [...cornerDigits, ...centerDigits].join(" "),
					})
				: copy.empty;
	const label = [
		fmt(copy.cellLabel, { row: row + 1, col: col + 1 }),
		state,
		cageSum !== undefined ? fmt(copy.cage, { sum: cageSum }) : null,
		conflict ? copy.conflict : null,
	]
		.filter(Boolean)
		.join(", ");

	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={label}
			accessibilityState={{ selected }}
			onPress={() => onPress(cell)}
			style={[
				styles.cell,
				{
					left: col * size,
					top: row * size,
					width: size,
					height: size,
					backgroundColor: background,
				},
				selected && styles.selected,
			]}
		>
			{marker > 0 ? (
				<View
					style={[
						StyleSheet.absoluteFill,
						{ backgroundColor: markerColors[marker - 1] },
					]}
				/>
			) : null}
			{cageSum !== undefined ? (
				<AppText
					variant="cellNote"
					allowFontScaling={false}
					style={[styles.cageSum, { color: tokens.textMuted }]}
				>
					{cageSum}
				</AppText>
			) : null}
			{value !== 0 ? (
				<AppText
					variant={size >= 40 ? "cellLarge" : "cellMedium"}
					allowFontScaling={false}
					style={{ color: digitColor, fontWeight: given ? "700" : "500" }}
				>
					{value}
				</AppText>
			) : (
				<>
					{cornerDigits.map((digit, index) => (
						<AppText
							key={digit}
							variant="cellNote"
							allowFontScaling={false}
							style={[styles.corner, CORNER_SLOTS[index] ?? CORNER_SLOTS[7]]}
						>
							{digit}
						</AppText>
					))}
					{centerDigits.length > 0 ? (
						<AppText
							variant="cellCenterNote"
							allowFontScaling={false}
							numberOfLines={1}
							adjustsFontSizeToFit
							style={styles.centerNote}
						>
							{centerDigits.join("")}
						</AppText>
					) : null}
				</>
			)}
		</Pressable>
	);
});

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		board: {
			backgroundColor: colors.surface,
			borderRadius: 6,
			borderWidth: BOARD_BORDER,
			borderColor: colors.textMuted,
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
		},
		cageSum: {
			position: "absolute",
			left: 3,
			top: 1,
			backgroundColor: colors.surface,
			paddingHorizontal: 1,
		},
		corner: {
			position: "absolute",
			color: colors.textMuted,
		},
		centerNote: {
			color: colors.textMuted,
			paddingHorizontal: 2,
		},
	});
