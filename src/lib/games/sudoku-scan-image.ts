/**
 * Browser-only image pipeline for the Sudoku scan flow: perspective
 * correction and OCR via tesseract.js. Finding the grid's lines and ink,
 * reading digits with the digit network, and what it makes of a cell are
 * shared with the phone app in `@arcadeclub/core/sudoku-scan-read`.
 */

import type { DigitGuess } from "@arcadeclub/core/sudoku-digit-net";
import type { ScanCell } from "@arcadeclub/core/sudoku-scan";
import type { CageRead, SumInk } from "@arcadeclub/core/sudoku-scan-cages";
import {
	cageSumInk,
	isKillerRead,
	parseCageSum,
	readCages,
	sumGray,
} from "@arcadeclub/core/sudoku-scan-cages";
import { fuseReads } from "@arcadeclub/core/sudoku-scan-fuse";
import type {
	DigitRead,
	InkBox,
	Point,
} from "@arcadeclub/core/sudoku-scan-ink";
import { withMargins } from "@arcadeclub/core/sudoku-scan-mesh";
import {
	CLASSIC_TURNS,
	findUprightTurns,
	gridDigitGuesses,
	KILLER_TURNS,
	killerSumScore,
	turnCorners,
	uprightDigitScore,
} from "@arcadeclub/core/sudoku-scan-orientation";
import { readWarpedGrid } from "@arcadeclub/core/sudoku-scan-read";

const WARP_SIZE = 900; // 9 cells x 100px

export async function fileToCanvas(file: Blob, maxDim = 1400) {
	const bitmap = await createImageBitmap(file);
	const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
	const canvas = document.createElement("canvas");
	canvas.width = Math.round(bitmap.width * scale);
	canvas.height = Math.round(bitmap.height * scale);
	const ctx = canvas.getContext("2d");
	if (!ctx) {
		throw new Error("Canvas not supported");
	}
	ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
	bitmap.close();
	return canvas;
}

/** Solve H so that dest (unit square scaled) maps onto the source quad. */
function homographyFromCorners(corners: Point[], size: number) {
	// Map (0,0)→c0, (size,0)→c1, (size,size)→c2, (0,size)→c3.
	const src = [
		{ x: 0, y: 0 },
		{ x: size, y: 0 },
		{ x: size, y: size },
		{ x: 0, y: size },
	];
	// Build 8x9 system A·h = 0 solved with fixed h8 = 1 → 8x8 linear system.
	const a: number[][] = [];
	const b: number[] = [];
	for (let i = 0; i < 4; i += 1) {
		const { x, y } = src[i];
		const { x: u, y: v } = corners[i];
		a.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
		b.push(u);
		a.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
		b.push(v);
	}
	// Gaussian elimination with partial pivoting.
	const n = 8;
	for (let col = 0; col < n; col += 1) {
		let pivot = col;
		for (let row = col + 1; row < n; row += 1) {
			if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) {
				pivot = row;
			}
		}
		[a[col], a[pivot]] = [a[pivot], a[col]];
		[b[col], b[pivot]] = [b[pivot], b[col]];
		const div = a[col][col];
		if (Math.abs(div) < 1e-12) {
			throw new Error("Degenerate corner configuration");
		}
		for (let row = col + 1; row < n; row += 1) {
			const factor = a[row][col] / div;
			for (let k = col; k < n; k += 1) {
				a[row][k] -= factor * a[col][k];
			}
			b[row] -= factor * b[col];
		}
	}
	const h = new Array<number>(n).fill(0);
	for (let row = n - 1; row >= 0; row -= 1) {
		let sum = b[row];
		for (let k = row + 1; k < n; k += 1) {
			sum -= a[row][k] * h[k];
		}
		h[row] = sum / a[row][row];
	}
	return [...h, 1];
}

/**
 * Warp the quad described by corners into a square WARP_SIZE canvas. By
 * default it takes the nearest source pixel, which is enough for the picture
 * the check step shows; `smooth` blends the four nearest instead, which keeps
 * thin lines, a Killer's dashes and small digits whole for reading.
 */
export function warpToSquare(
	source: HTMLCanvasElement,
	corners: Point[],
	{ smooth = false }: { smooth?: boolean } = {},
): HTMLCanvasElement {
	const h = homographyFromCorners(corners, WARP_SIZE);
	const srcCtx = source.getContext("2d");
	if (!srcCtx) {
		throw new Error("Canvas not supported");
	}
	const srcData = srcCtx.getImageData(0, 0, source.width, source.height);
	const out = document.createElement("canvas");
	out.width = WARP_SIZE;
	out.height = WARP_SIZE;
	const outCtx = out.getContext("2d");
	if (!outCtx) {
		throw new Error("Canvas not supported");
	}
	const outData = outCtx.createImageData(WARP_SIZE, WARP_SIZE);
	const sw = source.width;
	const sh = source.height;
	for (let y = 0; y < WARP_SIZE; y += 1) {
		for (let x = 0; x < WARP_SIZE; x += 1) {
			const w = h[6] * x + h[7] * y + h[8];
			const sx = (h[0] * x + h[1] * y + h[2]) / w;
			const sy = (h[3] * x + h[4] * y + h[5]) / w;
			const di = (y * WARP_SIZE + x) * 4;
			outData.data[di + 3] = 255;
			if (!smooth) {
				const px = Math.round(sx);
				const py = Math.round(sy);
				const inside = px >= 0 && py >= 0 && px < sw && py < sh;
				const si = (py * sw + px) * 4;
				for (let c = 0; c < 3; c += 1) {
					outData.data[di + c] = inside ? srcData.data[si + c] : 255;
				}
				continue;
			}
			if (sx < 0 || sy < 0 || sx > sw - 1 || sy > sh - 1) {
				for (let c = 0; c < 3; c += 1) {
					outData.data[di + c] = 255;
				}
				continue;
			}
			const x0 = Math.floor(sx);
			const y0 = Math.floor(sy);
			const x1 = Math.min(sw - 1, x0 + 1);
			const y1 = Math.min(sh - 1, y0 + 1);
			const fx = sx - x0;
			const fy = sy - y0;
			const i00 = (y0 * sw + x0) * 4;
			const i10 = (y0 * sw + x1) * 4;
			const i01 = (y1 * sw + x0) * 4;
			const i11 = (y1 * sw + x1) * 4;
			for (let c = 0; c < 3; c += 1) {
				const top =
					srcData.data[i00 + c] * (1 - fx) + srcData.data[i10 + c] * fx;
				const bottom =
					srcData.data[i01 + c] * (1 - fx) + srcData.data[i11 + c] * fx;
				outData.data[di + c] = top * (1 - fy) + bottom * fy;
			}
		}
	}
	outCtx.putImageData(outData, 0, 0);
	return out;
}

function cropToCanvas(
	source: HTMLCanvasElement,
	x: number,
	y: number,
	w: number,
	h: number,
	scale = 3,
	pad = 8,
) {
	const out = document.createElement("canvas");
	out.width = w * scale + pad * 2;
	out.height = h * scale + pad * 2;
	const ctx = out.getContext("2d");
	if (!ctx) {
		throw new Error("Canvas not supported");
	}
	ctx.fillStyle = "#fff";
	ctx.fillRect(0, 0, out.width, out.height);
	ctx.imageSmoothingEnabled = true;
	ctx.drawImage(source, x, y, w, h, pad, pad, w * scale, h * scale);
	return out;
}

type OcrWorker = {
	recognize: (image: HTMLCanvasElement) => Promise<{
		data: { text: string; confidence: number };
	}>;
	terminate: () => Promise<unknown>;
};

async function createOcrWorker(): Promise<OcrWorker> {
	const { createWorker, PSM } = await import("tesseract.js");
	const worker = await createWorker("eng");
	await worker.setParameters({
		tessedit_char_whitelist: "123456789",
		tessedit_pageseg_mode: PSM.SINGLE_CHAR,
	});
	return worker as unknown as OcrWorker;
}

async function recognizeDigit(worker: OcrWorker, crop: HTMLCanvasElement) {
	try {
		const result = await worker.recognize(crop);
		const match = result.data.text.match(/[1-9]/);
		if (!match) {
			return { digit: 0, confidence: 0 };
		}
		return {
			digit: Number(match[0]),
			confidence: Math.max(0, Math.min(1, result.data.confidence / 100)),
		};
	} catch {
		return { digit: 0, confidence: 0 };
	}
}

/**
 * Tesseract sometimes reads nothing from a clear printed digit, and a 1 px
 * change of the crop decides it. For an empty read the crop is grown by 2 px,
 * then shrunk by 1 px (per side). A retry only counts at this confidence: on
 * the scan-bench photos 0.9 keeps every right read the retry finds and adds no
 * wrong read, where an ungated retry also turned empty cells into wrong digits.
 */
const RETRY_INSETS = [-2, 1];
export const RETRY_MIN_CONFIDENCE = 0.9;

function insetBox(box: InkBox, inset: number): InkBox | null {
	const x = Math.max(0, box.x + inset);
	const y = Math.max(0, box.y + inset);
	const width = Math.min(WARP_SIZE, box.x + box.width - inset) - x;
	const height = Math.min(WARP_SIZE, box.y + box.height - inset) - y;
	return width > 0 && height > 0 ? { x, y, width, height } : null;
}

/**
 * Read a digit box; on an empty read, retry with the box grown and then
 * shrunk, and take the first retry that reads a digit with enough confidence.
 */
export async function readDigitWithRetry(
	box: InkBox,
	read: (box: InkBox) => Promise<DigitRead>,
): Promise<DigitRead> {
	const first = await read(box);
	if (first.digit !== 0) {
		return first;
	}
	for (const inset of RETRY_INSETS) {
		const retryBox = insetBox(box, inset);
		if (!retryBox) {
			continue;
		}
		const retry = await read(retryBox);
		if (retry.digit !== 0 && retry.confidence >= RETRY_MIN_CONFIDENCE) {
			return retry;
		}
	}
	return first;
}

export type ScanProgress = {
	step: "preparing" | "recognizing" | "cageSums";
	cellsDone: number;
	cellsTotal: number;
};

/**
 * How sure the digit network must be of a glyph to skip tesseract. Below it,
 * tesseract reads the glyph too and `fuseReads` settles the two, as Apple
 * Vision and the network do in the phone app.
 */
export const NETWORK_SURE = 0.95;
/** Ink the network is this sure is no digit still goes to tesseract. */
const NETWORK_JUNK = 0.2;

/** The read of a glyph the network is sure of, or null to ask tesseract. */
export function networkRead(guess: DigitGuess | null): DigitRead | null {
	if (!guess || guess.confidence < NETWORK_SURE || guess.junk >= NETWORK_JUNK) {
		return null;
	}
	return { digit: guess.digit, confidence: guess.confidence };
}

/** The grid as one gray value per pixel, as the core reader takes it. */
function grayPixels(canvas: HTMLCanvasElement) {
	const ctx = canvas.getContext("2d");
	if (!ctx) {
		throw new Error("Canvas not supported");
	}
	const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
	const pixels = new Uint8Array(canvas.width * canvas.height);
	for (let i = 0; i < pixels.length; i += 1) {
		const o = i * 4;
		pixels[i] = 0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2];
	}
	return pixels;
}

/**
 * Read the 81 cells of the grid inside `corners`, as the phone app does: the
 * grid is warped with a margin, the shared core reader finds its lines and the
 * ink in each cell, and the digit network reads each digit. Tesseract only
 * reads what the network is unsure of, and the notes.
 */
export async function recognizeGrid(
	source: HTMLCanvasElement,
	corners: Point[],
	onProgress?: (progress: ScanProgress) => void,
): Promise<ScanCell[]> {
	onProgress?.({ step: "preparing", cellsDone: 0, cellsTotal: 81 });
	const frame = withMargins(corners, source);
	const warped = warpToSquare(source, frame.corners, { smooth: true });
	// Started on the first glyph the network is unsure of, if any.
	const ocr: { worker: Promise<OcrWorker> | null } = { worker: null };
	const readBox = (box: InkBox, scale: number) => {
		ocr.worker ??= createOcrWorker();
		return ocr.worker.then((ready) =>
			recognizeDigit(
				ready,
				cropToCanvas(warped, box.x, box.y, box.width, box.height, scale),
			),
		);
	};
	try {
		const cells = await readWarpedGrid(
			{ pixels: grayPixels(warped), size: WARP_SIZE },
			frame.margins,
			async (glyphs) => {
				// Let the page paint the count between rows: the network alone
				// would read the whole grid in one task.
				await new Promise((resolve) => setTimeout(resolve, 0));
				const reads: DigitRead[] = [];
				for (const { box, guess } of glyphs) {
					const sure = networkRead(guess);
					if (sure) {
						reads.push(sure);
						continue;
					}
					if (!guess) {
						// Notes are small: scale them up more before tesseract reads them.
						reads.push(await readBox(box, 5));
						continue;
					}
					const read = await readDigitWithRetry(box, (retry) =>
						readBox(retry, 3),
					);
					reads.push(fuseReads(read, guess));
				}
				return reads;
			},
			(done) => {
				onProgress?.({ step: "recognizing", cellsDone: done, cellsTotal: 81 });
				return true;
			},
		);
		if (!cells) {
			throw new Error("The grid read stopped");
		}
		return cells;
	} finally {
		if (ocr.worker) {
			await (await ocr.worker).terminate();
		}
	}
}

/**
 * The corners turned so the grid reads upright, for a photo taken sideways
 * or upside down: a Killer by where its sums sit, a classic grid by how sure
 * the digit network is of its digits.
 */
export async function uprightCorners(
	source: HTMLCanvasElement,
	corners: Point[],
): Promise<Point[]> {
	const smoothAt = (turns: number) =>
		warpToSquare(source, turnCorners(corners, turns), { smooth: true });
	const asTaken = smoothAt(0);
	const cages = readWarpedCages(asTaken);
	if (isKillerRead(cages)) {
		const turns = await findUprightTurns((turn) => {
			const warped = turn === 0 ? asTaken : smoothAt(turn);
			const read = turn === 0 ? cages : readWarpedCages(warped);
			return killerSumScore(rgbaOf(warped), WARP_SIZE, read);
		}, KILLER_TURNS);
		return turnCorners(corners, turns);
	}
	const turns = await findUprightTurns(async (turn) => {
		const frame = withMargins(turnCorners(corners, turn), source);
		const warped = warpToSquare(source, frame.corners, { smooth: true });
		const guesses = await gridDigitGuesses(
			{ pixels: grayPixels(warped), size: WARP_SIZE },
			frame.margins,
		);
		return uprightDigitScore(guesses);
	}, CLASSIC_TURNS);
	return turnCorners(corners, turns);
}

function rgbaOf(warped: HTMLCanvasElement) {
	const ctx = warped.getContext("2d");
	if (!ctx) {
		throw new Error("Canvas not supported");
	}
	return ctx.getImageData(0, 0, WARP_SIZE, WARP_SIZE).data;
}

/** The cages of a Killer, read from the warped grid's lines and dashes. */
export function readWarpedCages(warped: HTMLCanvasElement): CageRead {
	const ctx = warped.getContext("2d");
	if (!ctx) {
		throw new Error("Canvas not supported");
	}
	return readCages(
		ctx.getImageData(0, 0, WARP_SIZE, WARP_SIZE).data,
		WARP_SIZE,
	);
}

/** Tesseract reads printed text best at about this height, in pixels. */
const SUM_TEXT_HEIGHT = 28;
const SUM_MARGIN = 16;

/** Paints a cut-out sum (or one of its digits) at reading size. */
function sumCanvas(source: HTMLCanvasElement, box: InkBox) {
	const scale = SUM_TEXT_HEIGHT / box.height;
	const out = document.createElement("canvas");
	out.width = Math.max(1, Math.round(box.width * scale)) + SUM_MARGIN * 2;
	out.height = SUM_TEXT_HEIGHT + SUM_MARGIN * 2;
	const ctx = out.getContext("2d");
	if (!ctx) {
		throw new Error("Canvas not supported");
	}
	ctx.fillStyle = "#fff";
	ctx.fillRect(0, 0, out.width, out.height);
	ctx.imageSmoothingEnabled = true;
	ctx.imageSmoothingQuality = "high";
	ctx.drawImage(
		source,
		box.x,
		box.y,
		box.width,
		box.height,
		SUM_MARGIN,
		SUM_MARGIN,
		out.width - SUM_MARGIN * 2,
		SUM_TEXT_HEIGHT,
	);
	return out;
}

function sumSource(rgba: Uint8ClampedArray, sum: SumInk) {
	const gray = sumGray(rgba, WARP_SIZE, sum);
	const canvas = document.createElement("canvas");
	canvas.width = sum.box.width;
	canvas.height = sum.box.height;
	const ctx = canvas.getContext("2d");
	if (!ctx) {
		throw new Error("Canvas not supported");
	}
	const image = ctx.createImageData(sum.box.width, sum.box.height);
	for (let i = 0; i < gray.length; i += 1) {
		image.data[i * 4] = gray[i];
		image.data[i * 4 + 1] = gray[i];
		image.data[i * 4 + 2] = gray[i];
		image.data[i * 4 + 3] = 255;
	}
	ctx.putImageData(image, 0, 0);
	return canvas;
}

/**
 * The sum printed in each cage, or null where none could be read. The
 * sum's digits are cut out of the lines and dashes around them and read as
 * one line; when that read has a different number of digits than were cut
 * out, each digit is read on its own instead.
 */
export async function readCageSums(
	warped: HTMLCanvasElement,
	read: CageRead,
	onProgress?: (progress: ScanProgress) => void,
): Promise<(number | null)[]> {
	const ctx = warped.getContext("2d");
	if (!ctx) {
		throw new Error("Canvas not supported");
	}
	const rgba = ctx.getImageData(0, 0, WARP_SIZE, WARP_SIZE).data;
	const total = read.cages.length;
	const { createWorker, PSM } = await import("tesseract.js");
	const worker = await createWorker("eng");
	const readText = async (canvas: HTMLCanvasElement, single: boolean) => {
		await worker.setParameters({
			tessedit_char_whitelist: "0123456789",
			tessedit_pageseg_mode: single ? PSM.SINGLE_CHAR : PSM.SINGLE_LINE,
		});
		try {
			const result = await worker.recognize(canvas);
			return result.data.text.replace(/[^0-9]/g, "");
		} catch {
			return "";
		}
	};
	const sums: (number | null)[] = [];
	try {
		for (const [index, cage] of read.cages.entries()) {
			onProgress?.({ step: "cageSums", cellsDone: index, cellsTotal: total });
			const sum =
				cageSumInk(rgba, WARP_SIZE, cage, read.bounds, { ignoreBlue: true }) ??
				cageSumInk(rgba, WARP_SIZE, cage, read.bounds, { ignoreBlue: false });
			if (!sum) {
				sums.push(null);
				continue;
			}
			const source = sumSource(rgba, sum);
			let text = await readText(
				sumCanvas(source, { ...sum.box, x: 0, y: 0 }),
				false,
			);
			if (text.length !== sum.digits.length) {
				const digits: string[] = [];
				for (const digit of sum.digits) {
					digits.push(await readText(sumCanvas(source, digit), true));
				}
				if (digits.every((digit) => digit.length === 1)) {
					text = digits.join("");
				}
			}
			sums.push(parseCageSum(text));
		}
	} finally {
		await worker.terminate();
	}
	onProgress?.({ step: "cageSums", cellsDone: total, cellsTotal: total });
	return sums;
}
