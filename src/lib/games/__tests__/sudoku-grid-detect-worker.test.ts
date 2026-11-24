import { afterEach, expect, it, vi } from "vitest";
import type { DetectRequest } from "../sudoku-grid-detect.worker";

afterEach(() => {
	vi.unstubAllGlobals();
});

it("the worker answers a photo's colors with the grid's corners", async () => {
	let ask: (event: { data: DetectRequest }) => void = () => {};
	const postMessage = vi.fn();
	vi.stubGlobal("postMessage", postMessage);
	vi.stubGlobal("addEventListener", (_: string, listener: typeof ask) => {
		ask = listener;
	});
	await import("../sudoku-grid-detect.worker");

	// Blue lines on yellow paper: only the weighted gray tells them apart.
	const size = 300;
	const pixels = new Uint8ClampedArray(size * size * 4);
	for (let y = 0; y < size; y += 1) {
		for (let x = 0; x < size; x += 1) {
			const inside = x >= 60 && x <= 240 && y >= 60 && y <= 240;
			const line = inside && (x % 20 === 0 || y % 20 === 0);
			pixels.set(
				line ? [0, 0, 255, 255] : [255, 255, 0, 255],
				(y * size + x) * 4,
			);
		}
	}
	ask({ data: { pixels, width: size, height: size } });
	expect(postMessage).toHaveBeenCalledWith([
		{ x: 60, y: 60 },
		{ x: 240, y: 60 },
		{ x: 240, y: 240 },
		{ x: 60, y: 240 },
	]);
});
