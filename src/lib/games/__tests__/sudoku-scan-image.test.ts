import type { DigitRead, InkBox } from "@arcadeclub/core/sudoku-scan-ink";
import { describe, expect, it, vi } from "vitest";
import { RETRY_MIN_CONFIDENCE, readDigitWithRetry } from "../sudoku-scan-image";

const empty: DigitRead = { digit: 0, confidence: 0 };
const box: InkBox = { x: 100, y: 200, width: 40, height: 60 };
const grown: InkBox = { x: 98, y: 198, width: 44, height: 64 };
const shrunk: InkBox = { x: 101, y: 201, width: 38, height: 58 };

/** A recognizer that answers each call in turn and records the boxes it got. */
function recognizer(...answers: DigitRead[]) {
	const read = vi.fn(async (_box: InkBox) => answers.shift() ?? empty);
	return read;
}

describe("readDigitWithRetry", () => {
	it("does not retry a digit that was read", async () => {
		const read = recognizer({ digit: 4, confidence: 0.3 });
		expect(await readDigitWithRetry(box, read)).toEqual({
			digit: 4,
			confidence: 0.3,
		});
		expect(read).toHaveBeenCalledTimes(1);
	});

	it("retries an empty read with the box grown by 2 px, then shrunk by 1 px", async () => {
		const read = recognizer();
		expect(await readDigitWithRetry(box, read)).toEqual(empty);
		expect(read.mock.calls.map(([b]) => b)).toEqual([box, grown, shrunk]);
	});

	it("takes the grown read when it is confident", async () => {
		const read = recognizer(empty, {
			digit: 8,
			confidence: RETRY_MIN_CONFIDENCE,
		});
		expect(await readDigitWithRetry(box, read)).toEqual({
			digit: 8,
			confidence: RETRY_MIN_CONFIDENCE,
		});
		expect(read).toHaveBeenCalledTimes(2);
	});

	it("ignores a low-confidence retry and falls through to the shrunk read", async () => {
		const read = recognizer(
			empty,
			{ digit: 8, confidence: RETRY_MIN_CONFIDENCE - 0.01 },
			{ digit: 6, confidence: 0.95 },
		);
		expect(await readDigitWithRetry(box, read)).toEqual({
			digit: 6,
			confidence: 0.95,
		});
	});

	it("stays empty when no retry is confident", async () => {
		const read = recognizer(
			empty,
			{ digit: 2, confidence: 0.87 },
			{ digit: 4, confidence: 0.5 },
		);
		expect(await readDigitWithRetry(box, read)).toEqual(empty);
		expect(read).toHaveBeenCalledTimes(3);
	});

	it("keeps retry boxes inside the grid and skips one with no area", async () => {
		const read = recognizer();
		await readDigitWithRetry({ x: 0, y: 870, width: 30, height: 30 }, read);
		expect(read.mock.calls[1][0]).toEqual({
			x: 0,
			y: 868,
			width: 32,
			height: 32,
		});
		read.mockClear();
		await readDigitWithRetry({ x: 10, y: 10, width: 2, height: 30 }, read);
		expect(read).toHaveBeenCalledTimes(2);
	});
});
