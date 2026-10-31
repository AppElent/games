/**
 * Where everything sits on the board, in points, for a given width.
 *
 * The board is twelve point columns split by the bar, with the borne-off
 * tray on the right. The viewer's home board is always bottom right, so
 * Black's board is White's with the rows swapped.
 */
import type { BackgammonColor } from "@games/core/backgammon";
import { type as typeRamp } from "../../../theme/tokens";

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
export function boardText(unit: number, fontScale: number) {
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
