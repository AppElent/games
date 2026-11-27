/**
 * Where everything sits on the board, in points, for a given width.
 *
 * The board is twelve point columns split by the bar, with the borne-off
 * tray on the right. The viewer's home board is always bottom right, so
 * Black's board is White's with the rows swapped.
 */
import type {
	BackgammonColor,
	BackgammonDropTarget,
} from "@arcadeclub/core/backgammon";
import { type as typeRamp } from "../../../theme";

/** Point numbers per row, left to right, as seen by `viewer`. */
export function boardRows(viewer: BackgammonColor) {
	const high = [13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24];
	const low = [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
	return viewer === "white"
		? { top: high, bottom: low }
		: { top: low, bottom: high };
}

const BAR_UNITS = 1;
const TRAY_UNITS = 1.2;
const HALF_UNITS = 5;
const GAP_UNITS = 1;
/** Checkers drawn per point before the stack shows a count instead. */
export const MAX_STACK = 5;

/**
 * Board text sizes for the system text scale. Labels follow `fontScale`
 * until a two-digit point number fills its column (or a stack count fills
 * its checker); the band between the halves grows to fit both label rows.
 */
function boardText(unit: number, fontScale: number) {
	const label = Math.min(typeRamp.boardLabel.fontSize * fontScale, unit * 0.78);
	const count = Math.min(
		typeRamp.checkerCount.fontSize * fontScale,
		unit * 0.5,
	);
	return { label, labelLine: Math.ceil(label * 1.25), count };
}

export function boardGeometry(width: number, fontScale = 1) {
	const frame = Math.max(4, Math.round(width * 0.015));
	const inner = width - frame * 2;
	const unit = inner / (12 + BAR_UNITS + TRAY_UNITS);
	const half = unit * HALF_UNITS;
	const text = boardText(unit, fontScale);
	const gap = Math.max(unit * GAP_UNITS, text.labelLine * 2 + 2);
	const height = half * 2 + gap + frame * 2;
	/** Left edge of a point column (0–11, left to right), inside the frame. */
	const columnX = (column: number) =>
		column < 6 ? column * unit : (column + BAR_UNITS) * unit;
	return {
		frame,
		unit,
		half,
		gap,
		width,
		height,
		checker: unit * 0.92,
		columnX,
		barX: 6 * unit,
		barWidth: BAR_UNITS * unit,
		trayX: (12 + BAR_UNITS) * unit,
		trayWidth: TRAY_UNITS * unit,
		bottomY: half + gap,
		text,
	};
}

export type BoardGeometry = ReturnType<typeof boardGeometry>;

/** The widest board, up to `maxWidth`, whose height fits in `maxHeight`. */
export function fitBoardWidth(
	maxWidth: number,
	maxHeight: number,
	fontScale = 1,
) {
	let low = 0;
	let high = Math.floor(maxWidth);
	while (low < high) {
		const mid = Math.ceil((low + high) / 2);
		if (boardGeometry(mid, fontScale).height <= maxHeight) low = mid;
		else high = mid - 1;
	}
	return low;
}

/**
 * The plain numbers a gesture worklet needs to find what is under a point on
 * the board; `boardGeometry` itself holds functions a worklet cannot capture.
 */
export function hitGrid(geometry: BoardGeometry, viewer: BackgammonColor) {
	const { top, bottom } = boardRows(viewer);
	const { frame, unit, half, gap } = geometry;
	return { frame, unit, half, gap, top, bottom };
}

export type HitGrid = ReturnType<typeof hitGrid>;

/**
 * What lies under `x`, `y` (board coordinates, frame included): a point (its
 * whole half-column), the bar, the tray, or nothing (the frame, the band
 * between the halves, or outside the board).
 */
export function hitTestBoard(
	grid: HitGrid,
	x: number,
	y: number,
): BackgammonDropTarget {
	"worklet";
	const { frame, unit, half, gap } = grid;
	const slot = (x - frame) / unit;
	const row = y - frame;
	if (slot < 0 || row < 0 || row >= half * 2 + gap) return null;
	if (slot >= 12 + BAR_UNITS + TRAY_UNITS) return null;
	if (slot >= 12 + BAR_UNITS) return "off";
	if (slot >= 6 && slot < 6 + BAR_UNITS) return "bar";
	const column = slot < 6 ? Math.floor(slot) : Math.floor(slot - BAR_UNITS);
	if (row < half) return grid.top[column] ?? null;
	if (row >= half + gap) return grid.bottom[column] ?? null;
	return null;
}

/** Where a checker sits, in board coordinates: one of the places a drag starts or ends. */
export type Slot =
	| { kind: "point"; point: number; index: number }
	| { kind: "bar"; side: Side; index: number }
	| { kind: "off"; side: Side; index: number };

/** The viewer's stacks on the bar and in the tray face the middle and the bottom. */
export type Side = "viewer" | "opponent";

/** The centre of `slot`, matching how the board stacks its checkers. */
export function slotCenter(
	geometry: BoardGeometry,
	viewer: BackgammonColor,
	slot: Slot,
) {
	const { frame, unit, half, gap, checker } = geometry;
	const bottom = half * 2 + gap;
	if (slot.kind === "off") {
		const slab = offSlabHeight(geometry);
		const offset = 4 + slot.index * slab + (slab - 1) / 2;
		return {
			x: frame + geometry.trayX + geometry.trayWidth / 2,
			y: slot.side === "viewer" ? frame + bottom - offset : frame + offset,
		};
	}
	const k = Math.min(slot.index, MAX_STACK - 1);
	if (slot.kind === "bar") {
		return {
			x: frame + geometry.barX + geometry.barWidth / 2,
			y:
				slot.side === "viewer"
					? frame + half - (k + 0.5) * checker
					: frame + half + gap + (k + 0.5) * checker,
		};
	}
	const rows = boardRows(viewer);
	const topColumn = rows.top.indexOf(slot.point);
	const column = topColumn >= 0 ? topColumn : rows.bottom.indexOf(slot.point);
	return {
		x: frame + geometry.columnX(column) + unit / 2,
		y:
			topColumn >= 0
				? frame + (k + 0.5) * checker
				: frame + bottom - (k + 0.5) * checker,
	};
}

/** One borne-off checker's slab in the tray, gap included. */
export function offSlabHeight(geometry: BoardGeometry) {
	return Math.max(2, (geometry.half - 8) / 15);
}
