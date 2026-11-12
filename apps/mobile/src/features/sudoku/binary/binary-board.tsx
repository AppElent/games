/** The N×N binary grid. A tap cycles a cell; givens are drawn solid. */
import { binaryDigitLabel } from "@arcadeclub/core/binary-puzzle";
import { memo, useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { fmt, useI18n } from "../../../i18n";
import { radius, useTokens } from "../../../theme";
import { AppText } from "../../../ui/text";

type Props = {
	size: number;
	side: number;
	merged: number[];
	givens: number[];
	conflicts: ReadonlySet<number>;
	hidden: boolean;
	onCycle: (cell: number) => void;
};

const GAP = 3;

export function BinaryBoard({
	size,
	side,
	merged,
	givens,
	conflicts,
	hidden,
	onCycle,
}: Props) {
	const cell = (side - GAP * (size - 1)) / size;
	const cells = useMemo(
		() => Array.from({ length: size * size }, (_, index) => index),
		[size],
	);
	return (
		<View style={[styles.board, { width: side, height: side }]}>
			{cells.map((index) => (
				<BinaryCell
					key={index}
					cell={index}
					row={Math.floor(index / size)}
					col={index % size}
					cellSize={cell}
					value={hidden ? 0 : merged[index]}
					given={givens[index] !== 0}
					conflict={!hidden && conflicts.has(index)}
					onPress={onCycle}
				/>
			))}
		</View>
	);
}

const BinaryCell = memo(function BinaryCell({
	cell,
	row,
	col,
	cellSize,
	value,
	given,
	conflict,
	onPress,
}: {
	cell: number;
	row: number;
	col: number;
	cellSize: number;
	value: number;
	given: boolean;
	conflict: boolean;
	onPress: (cell: number) => void;
}) {
	const tokens = useTokens();
	const { t } = useI18n();
	const copy = t.games.sudoku.board;
	const label = binaryDigitLabel(value);
	const fill =
		value === 0
			? tokens.surface
			: given
				? tokens.surface2
				: value === 1
					? tokens.accentDim
					: tokens.pinkDim;
	const ink = conflict
		? tokens.danger
		: value === 1
			? tokens.accent
			: tokens.pink;
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={[
				fmt(copy.cellLabel, { row: row + 1, col: col + 1 }),
				label || copy.empty,
				given ? copy.given : null,
				conflict ? copy.conflict : null,
			]
				.filter(Boolean)
				.join(", ")}
			onPress={() => onPress(cell)}
			style={[
				styles.cell,
				{
					left: col * (cellSize + GAP),
					top: row * (cellSize + GAP),
					width: cellSize,
					height: cellSize,
					backgroundColor: fill,
					borderColor: conflict ? tokens.danger : tokens.borderStrong,
				},
			]}
		>
			{label ? (
				<AppText
					variant={cellSize >= 40 ? "cellLarge" : "cellMedium"}
					allowFontScaling={false}
					style={{
						color: given ? tokens.text : ink,
						fontWeight: given ? "800" : "600",
					}}
				>
					{label}
				</AppText>
			) : null}
		</Pressable>
	);
});

const styles = StyleSheet.create({
	board: { position: "relative" },
	cell: {
		position: "absolute",
		alignItems: "center",
		justifyContent: "center",
		borderRadius: radius.sm,
		borderWidth: StyleSheet.hairlineWidth,
	},
});
