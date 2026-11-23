import type { Point } from "@arcadeclub/core/sudoku-scan-ink";
import { DETECT_MAX_DIM } from "./sudoku-grid-detect";
import type { DetectRequest } from "./sudoku-grid-detect.worker";

/** A grid not found by now is placed by hand: the player is waiting. */
export const FIND_TIMEOUT_MS = 4000;

/**
 * The corners of the sudoku grid in a photo, from the top-left, clockwise.
 * Null when there is no clear grid, or when looking for it failed, took too
 * long or was called off: the player then places the corners by hand.
 * The search runs in a worker, so the page stays responsive.
 */
export async function findGridCorners(
	source: HTMLCanvasElement,
	signal: AbortSignal,
): Promise<Point[] | null> {
	let worker: Worker | undefined;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let giveUp = () => {};
	try {
		const { pixels, width, height } = shrink(source);
		if (signal.aborted) {
			return null;
		}
		const searching = new Worker(
			new URL("./sudoku-grid-detect.worker.ts", import.meta.url),
			{ type: "module" },
		);
		worker = searching;
		const found = await new Promise<Point[] | null>((resolve) => {
			searching.onmessage = ({ data }: MessageEvent<Point[] | null>) =>
				resolve(data);
			searching.onerror = () => resolve(null);
			giveUp = () => resolve(null);
			signal.addEventListener("abort", giveUp);
			timer = setTimeout(giveUp, FIND_TIMEOUT_MS);
			const request: DetectRequest = { pixels, width, height };
			searching.postMessage(request, [pixels.buffer]);
		});
		return (
			found?.map(({ x, y }) => ({
				x: (x / width) * source.width,
				y: (y / height) * source.height,
			})) ?? null
		);
	} catch {
		// No worker or no pixels to read here: as good as no grid found.
		return null;
	} finally {
		worker?.terminate();
		clearTimeout(timer);
		signal.removeEventListener("abort", giveUp);
	}
}

/** The photo's pixels at the size the grid is searched at. */
function shrink(source: HTMLCanvasElement): {
	pixels: Uint8ClampedArray<ArrayBuffer>;
	width: number;
	height: number;
} {
	const scale = Math.min(
		1,
		DETECT_MAX_DIM / Math.max(source.width, source.height),
	);
	const canvas = document.createElement("canvas");
	canvas.width = Math.max(1, Math.round(source.width * scale));
	canvas.height = Math.max(1, Math.round(source.height * scale));
	const ctx = canvas.getContext("2d", { willReadFrequently: true });
	if (!ctx) {
		throw new Error("Canvas not supported");
	}
	ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
	const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
	return { pixels: data, width: canvas.width, height: canvas.height };
}
