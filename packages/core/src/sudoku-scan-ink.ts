/**
 * The image-independent half of reading a scanned sudoku: where the grid's
 * corners start, and what the digits read in a cell make of it. The ink to
 * read is found by `sudoku-scan-read.ts`, on the web and in the phone app.
 */
import { digitMask } from "./sudoku";
import type { ScanCell } from "./sudoku-scan";
import { emptyScanCell } from "./sudoku-scan";

export type Point = { x: number; y: number };

/** A centred square inset from the photo's edges, for when no grid is found. */
export function defaultCorners(width: number, height: number): Point[] {
	const inset = 0.06;
	const side = Math.min(width, height) * (1 - inset * 2);
	const cx = width / 2;
	const cy = height / 2;
	return [
		{ x: cx - side / 2, y: cy - side / 2 },
		{ x: cx + side / 2, y: cy - side / 2 },
		{ x: cx + side / 2, y: cy + side / 2 },
		{ x: cx - side / 2, y: cy + side / 2 },
	];
}

/** A rectangle in the warped grid image, in pixels. */
export type InkBox = { x: number; y: number; width: number; height: number };

/** What a cell's ink asks to be read. */
export type CellReadPlan =
	| { kind: "empty" }
	/** One full-size digit; printed ink is darker than handwriting. */
	| { kind: "digit"; box: InkBox; printed: boolean }
	/** Small pencil marks; the central ones are centre notes. */
	| { kind: "notes"; marks: { box: InkBox; central: boolean }[] };

/** One box's reading: 0 when no digit 1-9 was recognized. */
export type DigitRead = { digit: number; confidence: number };

/**
 * The cell the reads make of a plan. Handwritten digits and notes never get
 * full confidence, so the verifier flags them for a check.
 */
export function scanCellFromReads(
	plan: CellReadPlan,
	reads: readonly DigitRead[],
): ScanCell {
	if (plan.kind === "empty") {
		return emptyScanCell();
	}
	if (plan.kind === "digit") {
		const read = reads[0];
		if (!read || read.digit === 0) {
			return emptyScanCell(0.2);
		}
		return {
			type: plan.printed ? "given" : "userDigit",
			digit: read.digit,
			cornerMask: 0,
			centerMask: 0,
			confidence: Math.min(read.confidence, plan.printed ? 1 : 0.85),
		};
	}
	let cornerMask = 0;
	let centerMask = 0;
	let worst = 1;
	plan.marks.forEach((mark, index) => {
		const read = reads[index];
		if (!read || read.digit === 0) {
			worst = Math.min(worst, 0.3);
			return;
		}
		if (mark.central) {
			centerMask |= digitMask(read.digit);
		} else {
			cornerMask |= digitMask(read.digit);
		}
		worst = Math.min(worst, read.confidence, 0.8);
	});
	if (cornerMask === 0 && centerMask === 0) {
		return emptyScanCell(0.3);
	}
	return {
		type: centerMask !== 0 && cornerMask === 0 ? "centerNotes" : "cornerNotes",
		digit: 0,
		cornerMask,
		centerMask,
		confidence: worst,
	};
}
