import { describe, expect, it } from "vitest";
import { digitMask } from "../sudoku";
import {
	type CellReadPlan,
	defaultCorners,
	scanCellFromReads,
} from "../sudoku-scan-ink";

describe("scanCellFromReads", () => {
	const digit: CellReadPlan = {
		kind: "digit",
		box: { x: 0, y: 0, width: 10, height: 10 },
		printed: true,
	};

	it("makes a printed digit a given, handwriting a user digit", () => {
		expect(scanCellFromReads(digit, [{ digit: 7, confidence: 1 }])).toEqual({
			type: "given",
			digit: 7,
			cornerMask: 0,
			centerMask: 0,
			confidence: 1,
		});
		expect(
			scanCellFromReads({ ...digit, printed: false }, [
				{ digit: 3, confidence: 1 },
			]),
		).toMatchObject({ type: "userDigit", digit: 3, confidence: 0.85 });
	});

	it("leaves an unreadable digit empty and doubtful", () => {
		expect(scanCellFromReads(digit, [{ digit: 0, confidence: 0 }])).toEqual({
			type: "empty",
			digit: 0,
			cornerMask: 0,
			centerMask: 0,
			confidence: 0.2,
		});
	});

	it("sorts note reads into corner and centre masks", () => {
		const notes: CellReadPlan = {
			kind: "notes",
			marks: [
				{ box: { x: 0, y: 0, width: 4, height: 4 }, central: false },
				{ box: { x: 0, y: 0, width: 4, height: 4 }, central: true },
			],
		};
		expect(
			scanCellFromReads(notes, [
				{ digit: 2, confidence: 0.9 },
				{ digit: 5, confidence: 0.6 },
			]),
		).toEqual({
			type: "cornerNotes",
			digit: 0,
			cornerMask: digitMask(2),
			centerMask: digitMask(5),
			confidence: 0.6,
		});
		expect(
			scanCellFromReads(notes, [
				{ digit: 0, confidence: 0 },
				{ digit: 0, confidence: 0 },
			]),
		).toMatchObject({ type: "empty", confidence: 0.3 });
	});
});

describe("defaultCorners", () => {
	it("is a centred square inset from the photo's edges", () => {
		expect(defaultCorners(1000, 500)).toEqual([
			{ x: 280, y: 30 },
			{ x: 720, y: 30 },
			{ x: 720, y: 470 },
			{ x: 280, y: 470 },
		]);
	});
});
