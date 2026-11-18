/**
 * Browser-only image pipeline for the Sudoku scan flow: perspective
 * correction and OCR via tesseract.js. Which ink to read and what it makes of
 * a cell is shared with the app in `@arcadeclub/core/sudoku-scan-ink`.
 */
import type { ScanCell } from "@arcadeclub/core/sudoku-scan";
import type { DigitRead, Point } from "@arcadeclub/core/sudoku-scan-ink";
import {
	planGridReads,
	readBoxes,
	scanCellFromReads,
} from "@arcadeclub/core/sudoku-scan-ink";

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

/** Warp the quad described by corners into a square WARP_SIZE canvas. */
export function warpToSquare(
	source: HTMLCanvasElement,
	corners: Point[],
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
			const px = Math.round(sx);
			const py = Math.round(sy);
			const di = (y * WARP_SIZE + x) * 4;
			if (px < 0 || py < 0 || px >= sw || py >= sh) {
				outData.data[di] = 255;
				outData.data[di + 1] = 255;
				outData.data[di + 2] = 255;
				outData.data[di + 3] = 255;
				continue;
			}
			const si = (py * sw + px) * 4;
			outData.data[di] = srcData.data[si];
			outData.data[di + 1] = srcData.data[si + 1];
			outData.data[di + 2] = srcData.data[si + 2];
			outData.data[di + 3] = 255;
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

export type ScanProgress = {
	step: "preparing" | "recognizing";
	cellsDone: number;
	cellsTotal: number;
};

/**
 * Read the 81 cells of the warped grid: the shared planner picks the ink to
 * read in each cell, tesseract reads it, and the planner's rules turn the
 * reads into given / userDigit / cornerNotes / centerNotes / empty cells.
 *
 * Printed vs handwritten discrimination uses ink darkness as a rough
 * heuristic — the verifier screen exists precisely so the user can fix
 * misclassifications before play starts.
 */
export async function recognizeGrid(
	warped: HTMLCanvasElement,
	onProgress?: (progress: ScanProgress) => void,
): Promise<ScanCell[]> {
	const ctx = warped.getContext("2d");
	if (!ctx) {
		throw new Error("Canvas not supported");
	}
	onProgress?.({ step: "preparing", cellsDone: 0, cellsTotal: 81 });
	const image = ctx.getImageData(0, 0, WARP_SIZE, WARP_SIZE);
	const gray = new Float32Array(WARP_SIZE * WARP_SIZE);
	for (let i = 0; i < gray.length; i += 1) {
		const o = i * 4;
		gray[i] =
			0.299 * image.data[o] +
			0.587 * image.data[o + 1] +
			0.114 * image.data[o + 2];
	}

	const plans = planGridReads(gray, WARP_SIZE);
	const cells: ScanCell[] = [];
	const worker = await createOcrWorker();
	try {
		for (let cell = 0; cell < 81; cell += 1) {
			onProgress?.({ step: "recognizing", cellsDone: cell, cellsTotal: 81 });
			const plan = plans[cell];
			// Notes are small: scale them up more before tesseract reads them.
			const scale = plan.kind === "notes" ? 5 : 3;
			const reads: DigitRead[] = [];
			for (const box of readBoxes(plan)) {
				const crop = cropToCanvas(
					warped,
					box.x,
					box.y,
					box.width,
					box.height,
					scale,
				);
				reads.push(await recognizeDigit(worker, crop));
			}
			cells.push(scanCellFromReads(plan, reads));
		}
	} finally {
		await worker.terminate();
	}
	onProgress?.({ step: "recognizing", cellsDone: 81, cellsTotal: 81 });
	return cells;
}
