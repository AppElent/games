/**
 * The photo with the grid's outline and four handles to drag onto its
 * corners. Corners are in the photo's pixels; the photo is drawn to fit the
 * space the screen gives it.
 */
import type { Point } from "@arcadeclub/core/sudoku-scan-ink";
import { useRef, useState } from "react";
import {
	Image,
	type LayoutChangeEvent,
	PanResponder,
	StyleSheet,
	View,
} from "react-native";
import Svg, { Polygon } from "react-native-svg";
import type { PreparedPhoto } from "../../../../modules/sudoku-scanner";
import { haptics } from "../../../feedback/haptics";
import { fmt, useI18n } from "../../../i18n";
import {
	metrics,
	radius,
	type Tokens,
	useThemedStyles,
	useTokens,
} from "../../../theme";

type Props = {
	photo: PreparedPhoto;
	corners: Point[];
	onChange: (corners: Point[]) => void;
};

const HANDLE = metrics.hitTarget;

export function ScanCornerEditor({ photo, corners, onChange }: Props) {
	const tokens = useTokens();
	const styles = useThemedStyles(createStyles);
	const { t } = useI18n();
	const [space, setSpace] = useState({ width: 0, height: 0 });
	const scale =
		space.width > 0
			? Math.min(space.width / photo.width, space.height / photo.height)
			: 0;
	const width = photo.width * scale;
	const height = photo.height * scale;

	function onLayout(event: LayoutChangeEvent) {
		const { width: w, height: h } = event.nativeEvent.layout;
		setSpace({ width: w, height: h });
	}

	const points = corners.map((p) => `${p.x * scale},${p.y * scale}`).join(" ");

	return (
		<View style={styles.space} onLayout={onLayout}>
			{scale > 0 ? (
				<View style={{ width, height }}>
					<Image
						source={{ uri: photo.uri }}
						style={[styles.photo, { width, height }]}
						accessibilityIgnoresInvertColors
					/>
					<Svg
						width={width}
						height={height}
						style={StyleSheet.absoluteFill}
						pointerEvents="none"
					>
						<Polygon
							points={points}
							fill={tokens.accentDim}
							stroke={tokens.accent}
							strokeWidth={2}
						/>
					</Svg>
					{corners.map((corner, index) => (
						<CornerHandle
							// biome-ignore lint/suspicious/noArrayIndexKey: the four corners keep their order
							key={index}
							label={fmt(t.games.sudoku.scan.cornerHandle, {
								number: index + 1,
							})}
							point={corner}
							scale={scale}
							bounds={photo}
							onMove={(point) => {
								const next = [...corners];
								next[index] = point;
								onChange(next);
							}}
						/>
					))}
				</View>
			) : null}
		</View>
	);
}

function CornerHandle({
	label,
	point,
	scale,
	bounds,
	onMove,
}: {
	label: string;
	point: Point;
	scale: number;
	bounds: { width: number; height: number };
	onMove: (point: Point) => void;
}) {
	const styles = useThemedStyles(createStyles);
	// The responder is made once; it reads the latest props through this.
	const latest = useRef({ point, scale, bounds, onMove });
	latest.current = { point, scale, bounds, onMove };
	const start = useRef(point);

	const responder = useRef(
		PanResponder.create({
			onStartShouldSetPanResponder: () => true,
			onPanResponderTerminationRequest: () => false,
			onPanResponderGrant: () => {
				start.current = latest.current.point;
				haptics.selectionChanged();
			},
			onPanResponderMove: (_event, gesture) => {
				const { scale: s, bounds: b, onMove: move } = latest.current;
				move({
					x: clamp(start.current.x + gesture.dx / s, 0, b.width),
					y: clamp(start.current.y + gesture.dy / s, 0, b.height),
				});
			},
		}),
	).current;

	return (
		<View
			accessibilityLabel={label}
			style={[
				styles.handle,
				{
					left: point.x * scale - HANDLE / 2,
					top: point.y * scale - HANDLE / 2,
				},
			]}
			{...responder.panHandlers}
		>
			<View style={styles.ring} />
		</View>
	);
}

const clamp = (value: number, min: number, max: number) =>
	Math.max(min, Math.min(max, value));

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		space: { flex: 1, alignItems: "center", justifyContent: "center" },
		photo: { borderRadius: radius.sm },
		handle: {
			position: "absolute",
			width: HANDLE,
			height: HANDLE,
			alignItems: "center",
			justifyContent: "center",
		},
		ring: {
			width: 24,
			height: 24,
			borderRadius: radius.pill,
			borderWidth: 3,
			borderColor: colors.accent,
			backgroundColor: colors.accentDim,
		},
	});
