/**
 * The backgammon board, drawn natively: SVG for the wood and points, views
 * for the checkers and one pressable column per point. Moves are made by
 * tapping or dragging; `use-board-selection.ts` decides what each means, and
 * `use-checker-drag.ts` runs the drag gesture and its motion. The pressable
 * columns stay the tap and screen-reader path.
 */
import {
	BACKGAMMON_COLORS,
	type BackgammonColor,
	type BackgammonPoint,
	type BackgammonTurnState,
} from "@arcadeclub/core/backgammon";
import { opponent as opponentOf } from "@arcadeclub/core/duel";
import { memo, useEffect, useMemo } from "react";
import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import Animated, {
	Easing,
	type SharedValue,
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from "react-native-reanimated";
import Svg, { Polygon, Rect } from "react-native-svg";
import { scheduleOnRN } from "react-native-worklets";
import { fmt, plural, useI18n } from "../../../i18n";
import { backgammonColors as board } from "../../../theme";
import { AppText } from "../../../ui/text";
import { colorLabel } from "../components/color-label";
import {
	type BoardGeometry,
	boardGeometry,
	boardRows,
	MAX_STACK,
	offSlabHeight,
} from "./board-layout";
import type { BoardControl } from "./use-board-selection";
import { type Flight, LIFT_SCALE, useCheckerDrag } from "./use-checker-drag";

type Props = {
	state: BackgammonTurnState;
	viewer: BackgammonColor;
	width: number;
	showNumbers: boolean;
	control: BoardControl;
	testID?: string;
};

const HIT_MS = 220;

const STACK = Array.from({ length: MAX_STACK }, (_, index) => index);
const SLABS = Array.from({ length: 15 }, (_, index) => index);

export function BackgammonBoard({
	state,
	viewer,
	width,
	showNumbers,
	control,
	testID,
}: Props) {
	const { selected, highlights, lifted, hovered } = control;
	const { t, locale } = useI18n();
	const copy = t.games.backgammon;
	const white = colorLabel(copy, "white");
	const black = colorLabel(copy, "black");
	const { fontScale } = useWindowDimensions();
	const geometry = useMemo(
		() => boardGeometry(width, fontScale),
		[width, fontScale],
	);
	const rows = boardRows(viewer);
	const opponent = opponentOf(BACKGAMMON_COLORS, viewer);
	const active = state.activeColor;
	const drag = useCheckerDrag({ geometry, viewer, state, control });
	const { hiddenSource, flights } = drag;
	/** Checkers drawn on `color`'s side of the bar: one short while it is in the air. */
	const barShown = (color: BackgammonColor) =>
		Math.max(
			0,
			state.bar[color] -
				(hiddenSource === "bar" && color === active ? 1 : 0) -
				flights.filter((flight) => flight.color === color).length,
		);
	/** The ghost's slot on a hovered point: on top of its own checkers, or over a blot. */
	const ghostIndex = (point: BackgammonPoint) =>
		point.color === active ? Math.min(point.count, MAX_STACK - 1) : 0;

	const describe = (point: BackgammonPoint) => {
		if (!point.color || point.count === 0) {
			return fmt(copy.board.pointEmpty, { number: point.point });
		}
		return fmt(copy.board.pointOccupied, {
			number: point.point,
			count: point.count,
			// Inflected inside the sentence ("witte" in Dutch), unlike `colorLabel`.
			color:
				point.color === "white" ? copy.board.colorWhite : copy.board.colorBlack,
			checkerWord: plural(locale, point.count, copy.board.checkerWord),
		});
	};

	const { frame, unit, half, gap } = geometry;
	return (
		<GestureDetector gesture={drag.gesture}>
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
							const isHovered = hovered === pointNumber;
							const isSelected = selected === pointNumber;
							const isSource = lifted === pointNumber;
							return (
								<Pressable
									key={pointNumber}
									accessibilityRole="button"
									accessibilityLabel={describe(point)}
									accessibilityHint={isTarget ? copy.board.target : undefined}
									accessibilityState={{ selected: isSelected }}
									onPress={() => control.tapPoint(pointNumber)}
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
										isHovered && styles.hovered,
										isSource && styles.source,
									]}
								>
									<CheckerStack
										color={point.color}
										count={point.count - (hiddenSource === pointNumber ? 1 : 0)}
										size={geometry.checker}
										countSize={geometry.text.count}
										fromTop={row === "top"}
										selected={isSelected && !isSource}
									/>
									{isHovered ? (
										<GhostChecker
											index={ghostIndex(point)}
											size={geometry.checker}
											fromTop={row === "top"}
										/>
									) : null}
								</Pressable>
							);
						}),
					)}
					{showNumbers ? (
						<NumberRow
							geometry={geometry}
							top={rows.top}
							bottom={rows.bottom}
						/>
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
						accessibilityLabel={`${copy.board.barLabel}: ${white} ${state.bar.white}, ${black} ${state.bar.black}`}
						accessibilityState={{ selected: selected === "bar" }}
						testID="bg-bar"
					>
						<View style={{ height: half }}>
							<CheckerStack
								color={viewer}
								count={barShown(viewer)}
								size={geometry.checker}
								countSize={geometry.text.count}
								fromTop={false}
								selected={selected === "bar" && lifted == null}
							/>
						</View>
						<View style={{ height: half, marginTop: gap }}>
							<CheckerStack
								color={opponent}
								count={barShown(opponent)}
								size={geometry.checker}
								countSize={geometry.text.count}
								fromTop
								selected={false}
							/>
						</View>
					</View>
					<Pressable
						accessibilityRole="button"
						accessibilityLabel={`${copy.board.offLabel}: ${white} ${state.off.white}, ${black} ${state.off.black}`}
						accessibilityHint={highlights.off ? copy.board.bearOff : undefined}
						onPress={control.tapOff}
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
							hovered === "off" && styles.hovered,
						]}
					>
						<OffStack
							color={opponent}
							count={state.off[opponent]}
							geometry={geometry}
							fromTop
							ghost={hovered === "off" && active === opponent}
						/>
						<OffStack
							color={viewer}
							count={state.off[viewer]}
							geometry={geometry}
							fromTop={false}
							ghost={hovered === "off" && active === viewer}
						/>
					</Pressable>
				</View>
				{flights.map((flight) => (
					<FlyingChecker
						key={flight.id}
						flight={flight}
						size={geometry.checker}
						onDone={drag.endFlight}
					/>
				))}
				<LiftedChecker {...drag.lifted} size={geometry.checker} />
			</View>
		</GestureDetector>
	);
}

/** The dragged checker: 1.3×, ringed, with a drop shadow. */
function LiftedChecker({
	x,
	y,
	scale,
	shown,
	color,
	size,
}: {
	x: SharedValue<number>;
	y: SharedValue<number>;
	scale: SharedValue<number>;
	shown: SharedValue<number>;
	color: BackgammonColor;
	size: number;
}) {
	const motion = useAnimatedStyle(() => ({
		opacity: shown.value,
		// Lifted, the ring and shadow show; settled back, it matches the stack.
		shadowOpacity: shown.value * ((scale.value - 1) / (LIFT_SCALE - 1)) * 0.5,
		transform: [
			{ translateX: x.value - size / 2 },
			{ translateY: y.value - size / 2 },
			{ scale: scale.value },
		],
	}));
	return (
		<Animated.View
			pointerEvents="none"
			style={[
				styles.floating,
				styles.lifted,
				checkerLook(color, size),
				{ borderColor: board.selected, borderWidth: 3 },
				motion,
			]}
		/>
	);
}

/** A hit blot sliding to the bar. */
function FlyingChecker({
	flight,
	size,
	onDone,
}: {
	flight: Flight;
	size: number;
	onDone: (id: number) => void;
}) {
	const progress = useSharedValue(0);
	useEffect(() => {
		progress.value = withTiming(
			1,
			{ duration: HIT_MS, easing: Easing.bezier(0.2, 0.8, 0.2, 1) },
			(finished) => {
				"worklet";
				if (finished) scheduleOnRN(onDone, flight.id);
			},
		);
	}, [progress, onDone, flight.id]);
	const { from, to } = flight;
	const motion = useAnimatedStyle(() => ({
		transform: [
			{ translateX: from.x + (to.x - from.x) * progress.value - size / 2 },
			{ translateY: from.y + (to.y - from.y) * progress.value - size / 2 },
		],
	}));
	return (
		<Animated.View
			pointerEvents="none"
			style={[styles.floating, checkerLook(flight.color, size), motion]}
		/>
	);
}

/** Where the dropped checker will land: a dashed outline in its slot. */
function GhostChecker({
	index,
	size,
	fromTop,
}: {
	index: number;
	size: number;
	fromTop: boolean;
}) {
	return (
		<View
			pointerEvents="none"
			style={[
				StyleSheet.absoluteFill,
				styles.stack,
				fromTop ? styles.stackTop : styles.stackBottom,
			]}
		>
			{STACK.slice(0, index).map((slot) => (
				<View key={slot} style={{ width: size, height: size }} />
			))}
			<View
				style={[
					styles.ghost,
					{ width: size, height: size, borderRadius: size / 2 },
				]}
			/>
		</View>
	);
}

function checkerLook(color: BackgammonColor, size: number) {
	const white = color === "white";
	return {
		width: size,
		height: size,
		borderRadius: size / 2,
		backgroundColor: white ? board.checkerWhite : board.checkerBlack,
		borderColor: white ? board.checkerWhiteEdge : board.checkerBlackEdge,
		borderWidth: 1,
	};
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
	const { unit, half, gap, text } = geometry;
	const label = (point: number, column: number, y: number) => (
		<AppText
			key={point}
			variant="boardLabel"
			allowFontScaling={false}
			style={[
				styles.number,
				{
					left: geometry.columnX(column),
					top: y,
					width: unit,
					fontSize: text.label,
					lineHeight: text.labelLine,
				},
			]}
			accessible={false}
		>
			{point}
		</AppText>
	);
	return (
		<View pointerEvents="none" style={StyleSheet.absoluteFill}>
			{top.map((point, column) => label(point, column, half + 1))}
			{bottom.map((point, column) =>
				label(point, column, half + gap - text.labelLine - 1),
			)}
		</View>
	);
}

function CheckerStack({
	color,
	count,
	size,
	countSize,
	fromTop,
	selected,
}: {
	color?: BackgammonColor;
	count: number;
	size: number;
	countSize: number;
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
						countSize={countSize}
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
	countSize,
	selected,
	label,
}: {
	color: BackgammonColor;
	size: number;
	countSize: number;
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
					allowFontScaling={false}
					style={{
						fontSize: countSize,
						lineHeight: Math.ceil(countSize * 1.2),
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
	ghost,
}: {
	color: BackgammonColor;
	count: number;
	geometry: BoardGeometry;
	fromTop: boolean;
	/** Show where a dropped checker will go: one dashed slab past the stack. */
	ghost: boolean;
}) {
	const slab = offSlabHeight(geometry);
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
			{ghost ? (
				<View
					style={[
						styles.ghost,
						{
							width: geometry.trayWidth - 8,
							height: slab - 1,
							borderRadius: 2,
							borderWidth: 1,
						},
					]}
				/>
			) : null}
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
	hovered: {
		backgroundColor: board.targetHover,
		borderWidth: 3,
		borderColor: board.targetHoverRing,
		borderRadius: 4,
		shadowColor: board.targetHoverRing,
		shadowOpacity: 0.7,
		shadowRadius: 9,
		shadowOffset: { width: 0, height: 0 },
	},
	/** The column a checker was lifted from. */
	source: {
		borderWidth: 2,
		borderColor: board.selected,
		borderRadius: 4,
	},
	ghost: {
		backgroundColor: board.ghost,
		borderWidth: 2,
		borderStyle: "dashed",
		borderColor: board.ghostEdge,
	},
	floating: { position: "absolute", left: 0, top: 0 },
	lifted: {
		shadowColor: board.liftedShadow,
		shadowOffset: { width: 0, height: 10 },
		shadowRadius: 9,
	},
	stack: { flex: 1, alignItems: "center" },
	stackTop: { justifyContent: "flex-start" },
	// Reversed so the first checker sits on the rim and the stack grows inward.
	stackBottom: { flexDirection: "column-reverse" },
	checker: { alignItems: "center", justifyContent: "center" },
	offStack: { alignItems: "center", gap: 1, paddingVertical: 4 },
	number: { position: "absolute", textAlign: "center", color: board.label },
});
