/**
 * Where everything sits on the board, in points, for a given width.
 *
 * The board is twelve point columns split by the bar, with the borne-off
 * tray on the right. The viewer's home board is always bottom right, so
 * Black's board is White's with the rows swapped.
 */
import type { BackgammonColor } from "@games/core/backgammon";

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

export function boardGeometry(width: number) {
	const frame = Math.max(4, Math.round(width * 0.015));
	const inner = width - frame * 2;
	const unit = inner / (12 + BAR_UNITS + TRAY_UNITS);
	const half = unit * HALF_UNITS;
	const gap = unit * GAP_UNITS;
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
	};
}

export type BoardGeometry = ReturnType<typeof boardGeometry>;
