/**
 * Browser-only image pipeline for the Sudoku scan flow: perspective
 * correction, cell segmentation, ink analysis, and OCR via tesseract.js.
 * Pure recognition-result handling lives in sudoku-scan.ts.
 */
import { digitMask } from "./sudoku";
import type { ScanCell } from "./sudoku-scan";
import { emptyScanCell, emptyScanResult } from "./sudoku-scan";

export type Point = { x: number; y: number };

export const WARP_SIZE = 900; // 9 cells x 100px
const CELL = WARP_SIZE / 9;

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

type Component = {
	minX: number;
	maxX: number;
	minY: number;
	maxY: number;
	pixels: number;
	meanGray: number;
};

function analyzeCellInk(
	gray: Float32Array,
	width: number,
	cellRow: number,
	cellCol: number,
) {
	const margin = Math.round(CELL * 0.1);
	const x0 = Math.round(cellCol * CELL) + margin;
	const y0 = Math.round(cellRow * CELL) + margin;
	const size = Math.round(CELL) - margin * 2;

	// Local threshold from the cell's own brightness distribution.
	let sum = 0;
	for (let y = 0; y < size; y += 1) {
		for (let x = 0; x < size; x += 1) {
			sum += gray[(y0 + y) * width + (x0 + x)];
		}
	}
	const mean = sum / (size * size);
	const threshold = Math.min(mean * 0.72, mean - 18);

	const binary = new Uint8Array(size * size);
	for (let y = 0; y < size; y += 1) {
		for (let x = 0; x < size; x += 1) {
			binary[y * size + x] =
				gray[(y0 + y) * width + (x0 + x)] < threshold ? 1 : 0;
		}
	}

	// Connected components via BFS.
	const visited = new Uint8Array(size * size);
	const components: Component[] = [];
	const queue: number[] = [];
	for (let start = 0; start < size * size; start += 1) {
		if (!binary[start] || visited[start]) {
			continue;
		}
		visited[start] = 1;
		queue.length = 0;
		queue.push(start);
		const comp: Component = {
			minX: size,
			maxX: 0,
			minY: size,
			maxY: 0,
			pixels: 0,
			meanGray: 0,
		};
		while (queue.length > 0) {
			const index = queue.pop();
			if (index === undefined) {
				break;
			}
			const px = index % size;
			const py = Math.floor(index / size);
			comp.pixels += 1;
			comp.meanGray += gray[(y0 + py) * width + (x0 + px)];
			comp.minX = Math.min(comp.minX, px);
			comp.maxX = Math.max(comp.maxX, px);
			comp.minY = Math.min(comp.minY, py);
			comp.maxY = Math.max(comp.maxY, py);
			const neighbors = [index - 1, index + 1, index - size, index + size];
			for (const next of neighbors) {
				if (
					next >= 0 &&
					next < size * size &&
					binary[next] &&
					!visited[next] &&
					Math.abs((next % size) - px) <= 1
				) {
					visited[next] = 1;
					queue.push(next);
				}
			}
		}
		comp.meanGray /= comp.pixels;
		// Discard specks and grid-line slivers hugging the border.
		const w = comp.maxX - comp.minX + 1;
		const hgt = comp.maxY - comp.minY + 1;
		const touchesBorder =
			comp.minX <= 1 ||
			comp.minY <= 1 ||
			comp.maxX >= size - 2 ||
			comp.maxY >= size - 2;
		const sliver = w <= 3 || hgt <= 3;
		if (comp.pixels >= 12 && !(touchesBorder && sliver)) {
			components.push(comp);
		}
	}
	return { components, size, x0, y0 };
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
 * Segment the warped grid image into 81 cells and classify each one as
 * given / userDigit / cornerNotes / centerNotes / empty with confidence.
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

	const cells = emptyScanResult();
	const worker = await createOcrWorker();
	try {
		for (let cell = 0; cell < 81; cell += 1) {
			const row = Math.floor(cell / 9);
			const col = cell % 9;
			const { components, size, x0, y0 } = analyzeCellInk(
				gray,
				WARP_SIZE,
				row,
				col,
			);
			onProgress?.({ step: "recognizing", cellsDone: cell, cellsTotal: 81 });
			if (components.length === 0) {
				cells[cell] = emptyScanCell();
				continue;
			}
			const biggest = components.reduce((best, comp) =>
				comp.pixels > best.pixels ? comp : best,
			);
			const bigW = biggest.maxX - biggest.minX + 1;
			const bigH = biggest.maxY - biggest.minY + 1;

			if (bigH >= size * 0.38 && bigW >= size * 0.12) {
				// Full-size digit.
				const crop = cropToCanvas(
					warped,
					x0 + biggest.minX - 2,
					y0 + biggest.minY - 2,
					bigW + 4,
					bigH + 4,
				);
				const { digit, confidence } = await recognizeDigit(worker, crop);
				if (digit === 0) {
					cells[cell] = { ...emptyScanCell(0.2) };
					continue;
				}
				// Heuristic: printed clues are usually darker and denser.
				const isPrinted = biggest.meanGray < 110;
				cells[cell] = {
					type: isPrinted ? "given" : "userDigit",
					digit,
					cornerMask: 0,
					centerMask: 0,
					confidence: Math.min(confidence, isPrinted ? 1 : 0.85),
				};
				continue;
			}

			// Small marks: pencil notes. Position decides corner vs center.
			let cornerMask = 0;
			let centerMask = 0;
			let worst = 1;
			const marks = components.sort((a, b) => b.pixels - a.pixels).slice(0, 6);
			for (const mark of marks) {
				const cx = (mark.minX + mark.maxX) / 2 / size;
				const cy = (mark.minY + mark.maxY) / 2 / size;
				const central = cx > 0.3 && cx < 0.7 && cy > 0.3 && cy < 0.7;
				const crop = cropToCanvas(
					warped,
					x0 + mark.minX - 1,
					y0 + mark.minY - 1,
					mark.maxX - mark.minX + 3,
					mark.maxY - mark.minY + 3,
					5,
				);
				const { digit, confidence } = await recognizeDigit(worker, crop);
				if (digit === 0) {
					worst = Math.min(worst, 0.3);
					continue;
				}
				if (central) {
					centerMask |= digitMask(digit);
				} else {
					cornerMask |= digitMask(digit);
				}
				worst = Math.min(worst, confidence, 0.8);
			}
			if (cornerMask === 0 && centerMask === 0) {
				cells[cell] = emptyScanCell(0.3);
			} else {
				cells[cell] = {
					type:
						centerMask !== 0 && cornerMask === 0
							? "centerNotes"
							: "cornerNotes",
					digit: 0,
					cornerMask,
					centerMask,
					confidence: worst,
				};
			}
		}
	} finally {
		await worker.terminate();
	}
	onProgress?.({ step: "recognizing", cellsDone: 81, cellsTotal: 81 });
	return cells;
}
