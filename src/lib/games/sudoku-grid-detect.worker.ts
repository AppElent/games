import { detectGridCorners } from "./sudoku-grid-detect";

export type DetectRequest = {
	/** RGBA, as a canvas hands it out. */
	pixels: Uint8ClampedArray;
	width: number;
	height: number;
};

addEventListener("message", ({ data }: MessageEvent<DetectRequest>) => {
	const { pixels, width, height } = data;
	const gray = new Uint8Array(width * height);
	for (let i = 0; i < gray.length; i += 1) {
		const at = i * 4;
		gray[i] =
			pixels[at] * 0.299 + pixels[at + 1] * 0.587 + pixels[at + 2] * 0.114;
	}
	postMessage(detectGridCorners(gray, width, height));
});
