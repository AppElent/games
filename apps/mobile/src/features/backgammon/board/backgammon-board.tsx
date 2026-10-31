/**
 * The backgammon board, drawn natively: SVG for the wood and points, views
 * for the checkers and one pressable column per point. Moves are made by
 * tapping (see `use-board-selection.ts`); the board itself only draws and
 * reports taps.
 */
import type {
	BackgammonColor,
	BackgammonMoveSource,
	BackgammonPoint,
	BackgammonTurnState,
} from "@games/core/backgammon";
import { memo, useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Svg, { Polygon, Rect } from "react-native-svg";
import { fmt, plural, useI18n } from "../../../i18n";
import { backgammonColors as board } from "../../../theme";
import { AppText } from "../../../ui/text";
import {
	type BoardGeometry,
	boardGeometry,
	boardRows,
	MAX_STACK,
} from "./board-layout";

type Props = {
	state: BackgammonTurnState;
	viewer: BackgammonColor;
	width: number;
	showNumbers: boolean;
	selected: BackgammonMoveSource | null;
	highlights: { points: Set<number>; off: boolean };
	onPointPress: (point: number) => void;
	onOffPress: () => void;
	testID?: string;
};

const STACK = Array.from({ length: MAX_STACK }, (_, index) => index);
const SLABS = Array.from({ length: 15 }, (_, index) => index);

export function BackgammonBoard({
	state,
	viewer,
	width,
	showNumbers,
	selected,
	highlights,
	onPointPress,
	onOffPress,
	testID,
}: Props) {
	const { t, locale } = useI18n();
	const copy = t.backgammon;
	const geometry = useMemo(() => boardGeometry(width), [width]);
	const rows = boardRows(viewer);
	const opponent: BackgammonColor = viewer === "white" ? "black" : "white";

	const describe = (point: BackgammonPoint) => {
		const name = fmt(copy.board.point, { point: point.point });
		if (!point.color || point.count === 0) {
			return `${name}, ${copy.board.empty}`;
		}
		return `${name}, ${copy.colors[point.color]}, ${plural(locale, point.count, copy.board.checkers)}`;
	};

	const { frame, unit, half, gap } = geometry;
	return (
		<View
			testID={testID}
			style={{ width, height: geometry.height }}
			accessibilityRole="none"
		>
			<BoardArt geometry={geometry} />
			<View
				style={[
					styles.inner,
					{ left: frame, top: frame, right: frame, bottom: frame },
				]}
			>
				{(["top", "bottom"] as const).map((row) =>
					rows[row].map((pointNumber, column) => {
						const point = state.points[pointNumber - 1];
						const isTarget = highlights.points.has(pointNumber);
						const isSelected = selected === pointNumber;
						return (
							<Pressable
								key={pointNumber}
								accessibilityRole="button"
								accessibilityLabel={describe(point)}
								accessibilityHint={isTarget ? copy.board.target : undefined}
								accessibilityState={{ selected: isSelected }}
								onPress={() => onPointPress(pointNumber)}
								testID={`bg-point-${pointNumber}`}
								style={[
									styles.column,
									{
										left: geometry.columnX(column),
										top: row === "top" ? 0 : geometry.bottomY,
										width: unit,
										height: half,
									},
									isTarget && styles.target,
								]}
							>
								<CheckerStack
									color={point.color}
									count={point.count}
									size={geometry.checker}
									fromTop={row === "top"}
									selected={isSelected}
								/>
							</Pressable>
						);
					}),
				)}
				{showNumbers ? (
					<NumberRow geometry={geometry} top={rows.top} bottom={rows.bottom} />
				) : null}
				<View
					style={[
						styles.column,
						{
							left: geometry.barX,
							top: 0,
							width: geometry.barWidth,
							height: half * 2 + gap,
						},
					]}
					accessible
					accessibilityLabel={`${copy.board.bar}: ${copy.colors.white} ${state.bar.white}, ${copy.colors.black} ${state.bar.black}`}
					accessibilityState={{ selected: selected === "bar" }}
					testID="bg-bar"
				>
					<View style={{ height: half }}>
						<CheckerStack
							color={viewer}
							count={state.bar[viewer]}
							size={geometry.checker}
							fromTop={false}
							selected={selected === "bar"}
						/>
					</View>
					<View style={{ height: half, marginTop: gap }}>
						<CheckerStack
							color={opponent}
							count={state.bar[opponent]}
							size={geometry.checker}
							fromTop
							selected={false}
						/>
					</View>
				</View>
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={`${copy.board.off}: ${copy.colors.white} ${state.off.white}, ${copy.colors.black} ${state.off.black}`}
					accessibilityHint={highlights.off ? copy.board.bearOff : undefined}
					onPress={onOffPress}
					disabled={!highlights.off}
					testID="bg-off"
					style={[
						styles.tray,
						{
							left: geometry.trayX,
							width: geometry.trayWidth,
							height: half * 2 + gap,
						},
						highlights.off && styles.target,
					]}
				>
					<OffStack
						color={opponent}
						count={state.off[opponent]}
						geometry={geometry}
						fromTop
					/>
					<OffStack
						color={viewer}
						count={state.off[viewer]}
						geometry={geometry}
						fromTop={false}
					/>
				</Pressable>
			</View>
		</View>
	);
}

/** Frame, felt, bar and the 24 triangles; redrawn only when the size changes. */
const BoardArt = memo(function BoardArt({
	geometry,
}: {
	geometry: BoardGeometry;
}) {
	const { frame, unit, half, gap, width, height } = geometry;
	const bottom = half * 2 + gap;
	const triangles = Array.from({ length: 24 }, (_, index) => {
		const column = index % 12;
		const top = index < 12;
		const x = frame + geometry.columnX(column);
		const tip = half * 0.92;
		const y0 = frame + (top ? 0 : bottom);
		const y1 = frame + (top ? tip : bottom - tip);
		return {
			key: index,
			points: `${x},${y0} ${x + unit},${y0} ${x + unit / 2},${y1}`,
			fill:
				(column + (top ? 0 : 1)) % 2 === 0 ? board.pointLight : board.pointDark,
		};
	});
	return (
		<Svg width={width} height={height} style={StyleSheet.absoluteFill}>
			<Rect
				x={0}
				y={0}
				width={width}
				height={height}
				rx={8}
				fill={board.frame}
			/>
			<Rect
				x={frame}
				y={frame}
				width={width - frame * 2}
				height={height - frame * 2}
				fill={board.felt}
			/>
			{triangles.map((triangle) => (
				<Polygon
					key={triangle.key}
					points={triangle.points}
					fill={triangle.fill}
				/>
			))}
			<Rect
				x={frame + geometry.barX}
				y={frame}
				width={geometry.barWidth}
				height={bottom}
				fill={board.bar}
			/>
			<Rect
				x={frame + geometry.trayX}
				y={frame}
				width={geometry.trayWidth}
				height={bottom}
				fill={board.bar}
			/>
		</Svg>
	);
});

function NumberRow({
	geometry,
	top,
	bottom,
}: {
	geometry: BoardGeometry;
	top: number[];
	bottom: number[];
}) {
	const { unit, half, gap } = geometry;
	const label = (point: number, column: number, y: number) => (
		<AppText
			key={point}
			variant="boardLabel"
			style={[
				styles.number,
				{ left: geometry.columnX(column), top: y, width: unit },
			]}
			accessible={false}
		>
			{point}
		</AppText>
	);
	return (
		<View pointerEvents="none" style={StyleSheet.absoluteFill}>
			{top.map((point, column) => label(point, column, half + 1))}
			{bottom.map((point, column) => label(point, column, half + gap / 2))}
		</View>
	);
}

function CheckerStack({
	color,
	count,
	size,
	fromTop,
	selected,
}: {
	color?: BackgammonColor;
	count: number;
	size: number;
	fromTop: boolean;
	selected: boolean;
}) {
	if (!color || count === 0) return null;
	const shown = Math.min(count, MAX_STACK);
	return (
		<View
			pointerEvents="none"
			style={[styles.stack, fromTop ? styles.stackTop : styles.stackBottom]}
		>
			{STACK.slice(0, shown).map((index) => {
				const outermost = index === shown - 1;
				return (
					<Checker
						key={index}
						color={color}
						size={size}
						selected={selected && outermost}
						label={outermost && count > MAX_STACK ? String(count) : null}
					/>
				);
			})}
		</View>
	);
}

function Checker({
	color,
	size,
	selected,
	label,
}: {
	color: BackgammonColor;
	size: number;
	selected: boolean;
	label: string | null;
}) {
	const white = color === "white";
	return (
		<View
			style={[
				styles.checker,
				{
					width: size,
					height: size,
					borderRadius: size / 2,
					backgroundColor: white ? board.checkerWhite : board.checkerBlack,
					borderColor: selected
						? board.selected
						: white
							? board.checkerWhiteEdge
							: board.checkerBlackEdge,
					borderWidth: selected ? 3 : 1,
				},
			]}
		>
			{label ? (
				<AppText
					variant="checkerCount"
					style={{
						color: white ? board.checkerWhiteInk : board.checkerBlackInk,
					}}
				>
					{label}
				</AppText>
			) : null}
		</View>
	);
}

function OffStack({
	color,
	count,
	geometry,
	fromTop,
}: {
	color: BackgammonColor;
	count: number;
	geometry: BoardGeometry;
	fromTop: boolean;
}) {
	const slab = Math.max(2, (geometry.half - 8) / 15);
	const white = color === "white";
	return (
		<View
			pointerEvents="none"
			style={[
				styles.offStack,
				{ height: geometry.half },
				fromTop ? styles.stackTop : styles.stackBottom,
			]}
		>
			{SLABS.slice(0, count).map((index) => (
				<View
					key={index}
					style={{
						width: geometry.trayWidth - 8,
						height: slab - 1,
						borderRadius: 2,
						backgroundColor: white ? board.checkerWhite : board.checkerBlack,
					}}
				/>
			))}
		</View>
	);
}

const styles = StyleSheet.create({
	inner: { position: "absolute" },
	column: { position: "absolute" },
	tray: {
		position: "absolute",
		top: 0,
		justifyContent: "space-between",
		borderRadius: 4,
	},
	target: {
		backgroundColor: board.targetFill,
		borderWidth: 2,
		borderColor: board.target,
		borderRadius: 4,
	},
	stack: { flex: 1, alignItems: "center" },
	stackTop: { justifyContent: "flex-start" },
	// Reversed so the first checker sits on the rim and the stack grows inward.
	stackBottom: { flexDirection: "column-reverse" },
	checker: { alignItems: "center", justifyContent: "center" },
	offStack: { alignItems: "center", gap: 1, paddingVertical: 4 },
	number: { position: "absolute", textAlign: "center", color: board.label },
});
