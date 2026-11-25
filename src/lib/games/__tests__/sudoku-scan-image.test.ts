import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { isKillerRead } from "@arcadeclub/core/sudoku-scan-cages";
import type { DigitRead, InkBox } from "@arcadeclub/core/sudoku-scan-ink";
import { describe, expect, it, vi } from "vitest";
import {
	NETWORK_SURE,
	networkRead,
	RETRY_MIN_CONFIDENCE,
	readDigitWithRetry,
	readWarpedCages,
	warpToSquare,
} from "../sudoku-scan-image";

const empty: DigitRead = { digit: 0, confidence: 0 };
const box: InkBox = { x: 100, y: 200, width: 40, height: 60 };
const grown: InkBox = { x: 98, y: 198, width: 44, height: 64 };
const shrunk: InkBox = { x: 101, y: 201, width: 38, height: 58 };

/** A recognizer that answers each call in turn and records the boxes it got. */
function recognizer(...answers: DigitRead[]) {
	const read = vi.fn(async (_box: InkBox) => answers.shift() ?? empty);
	return read;
}

describe("networkRead", () => {
	const guess = (confidence: number, junk = 0) => ({
		digit: 7,
		confidence,
		junk,
		printScore: 0,
	});

	it("takes the network's digit when it is sure", () => {
		expect(networkRead(guess(NETWORK_SURE))).toEqual({
			digit: 7,
			confidence: NETWORK_SURE,
		});
	});

	it("asks tesseract when the network is unsure, sees junk, or reads a note", () => {
		expect(networkRead(guess(NETWORK_SURE - 0.01))).toBeNull();
		expect(networkRead(guess(0.99, 0.5))).toBeNull();
		expect(networkRead(null)).toBeNull();
	});
});

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

/** Decode an unfiltered grayscale PNG from `./fixtures/` into a fake canvas. */
function readGrayFixture(name: string) {
	const file = readFileSync(new URL(`./fixtures/${name}`, import.meta.url));
	const width = file.readUInt32BE(16);
	const height = file.readUInt32BE(20);
	const chunks: Buffer[] = [];
	for (let at = 8; at < file.length; ) {
		const length = file.readUInt32BE(at);
		if (file.toString("latin1", at + 4, at + 8) === "IDAT") {
			chunks.push(file.subarray(at + 8, at + 8 + length));
		}
		at += length + 12;
	}
	const rows = inflateSync(Buffer.concat(chunks));
	const rgba = new Uint8ClampedArray(width * height * 4);
	for (let y = 0; y < height; y += 1) {
		const row = y * (width + 1);
		for (let x = 0; x < width; x += 1) {
			const g = rows[row + 1 + x];
			const o = (y * width + x) * 4;
			rgba[o] = g;
			rgba[o + 1] = g;
			rgba[o + 2] = g;
			rgba[o + 3] = 255;
		}
	}
	return { width, height, rgba };
}

function makeCanvas(width = 0, height = 0, initial?: Uint8ClampedArray) {
	let data = initial ?? new Uint8ClampedArray(width * height * 4);
	const canvas = {
		width,
		height,
		getContext(kind: string) {
			if (kind !== "2d") return null;
			return {
				getImageData: () => ({
					width: canvas.width,
					height: canvas.height,
					data,
				}),
				createImageData: (w: number, h: number) => ({
					width: w,
					height: h,
					data: new Uint8ClampedArray(w * h * 4),
				}),
				putImageData: (img: { data: Uint8ClampedArray }) => {
					data = img.data;
				},
			};
		},
	};
	return canvas as unknown as HTMLCanvasElement;
}

describe("a classic grid on the sudoku-book-page fixture", () => {
	it("does not read as a Killer", () => {
		const { width, height, rgba } = readGrayFixture("sudoku-book-page.png");
		vi.stubGlobal("document", {
			createElement: () => makeCanvas(),
		});
		try {
			const warped = warpToSquare(
				makeCanvas(width, height, rgba),
				[
					{ x: 48, y: 35 },
					{ x: 148, y: 78 },
					{ x: 157, y: 194 },
					{ x: 37, y: 174 },
				],
				{ smooth: true },
			);
			expect(isKillerRead(readWarpedCages(warped))).toBe(false);
		} finally {
			vi.unstubAllGlobals();
		}
	});
});
