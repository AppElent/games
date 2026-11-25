/**
 * Photo and grid corners in, recognized cells out. The native module warps
 * the photo and reads with Apple Vision; the grid's lines, the ink in its
 * cells and the digit network are core JavaScript (`readWarpedGrid`), shared
 * with the web and improved by update. `scripts/scan-bench` measures this
 * same function.
 */
import type { ScanCell } from "@arcadeclub/core/sudoku-scan";
import {
	isKillerRead,
	type KillerScan,
	killerScanFromRead,
	readCages,
} from "@arcadeclub/core/sudoku-scan-cages";
import { fuseReads } from "@arcadeclub/core/sudoku-scan-fuse";
import type {
	DigitRead,
	InkBox,
	Point,
} from "@arcadeclub/core/sudoku-scan-ink";
import {
	grayToRgba,
	readKillerSums,
} from "@arcadeclub/core/sudoku-scan-killer-sums";
import { withMargins } from "@arcadeclub/core/sudoku-scan-mesh";
import { readWarpedGrid } from "@arcadeclub/core/sudoku-scan-read";

export type GridReader = {
	warpGrid(
		uri: string,
		corners: Point[],
	): Promise<{ uri: string; size: number; pixels: Uint8Array }>;
	readDigits(uri: string, boxes: InkBox[]): Promise<DigitRead[]>;
};

export type ReadGridProgress = { gridUri: string; done: number };

/** Null when `onProgress` answers false: a newer scan took over. */
export async function readGrid(
	reader: GridReader,
	photo: { uri: string; width: number; height: number },
	corners: Point[],
	onProgress: (progress: ReadGridProgress) => boolean,
): Promise<{ gridUri: string; cells: ScanCell[] } | null> {
	const frame = withMargins(corners, photo);
	const grid = await reader.warpGrid(photo.uri, frame.corners);
	if (!onProgress({ gridUri: grid.uri, done: 0 })) return null;
	// Finding the lines takes a second on a phone: show the grid first.
	await new Promise((resolve) => setTimeout(resolve, 0));
	const cells = await readWarpedGrid(
		grid,
		frame.margins,
		async (glyphs) => {
			const vision = await reader.readDigits(
				grid.uri,
				glyphs.map((glyph) => glyph.box),
			);
			// The network always finds a digit, so a note takes Vision's word.
			return vision.map((read, i) => {
				const guess = glyphs[i]?.guess;
				return guess ? fuseReads(read, guess) : read;
			});
		},
		(done) => onProgress({ gridUri: grid.uri, done }),
	);
	return cells ? { gridUri: grid.uri, cells } : null;
}

/**
 * The cages and sums of a Killer, or null for a grid without cages: the
 * classic read takes over then. The grid is warped to its corners exactly,
 * as the web reads cages, and the sums' digits go to Vision as one batch.
 */
export async function readKiller(
	reader: GridReader,
	photo: { uri: string },
	corners: Point[],
): Promise<{ gridUri: string; scan: KillerScan } | null> {
	const grid = await reader.warpGrid(photo.uri, corners);
	const rgba = grayToRgba(grid.pixels);
	const cages = readCages(rgba, grid.size);
	if (!isKillerRead(cages)) return null;
	const sums = await readKillerSums(rgba, grid.size, cages, (boxes) =>
		reader.readDigits(grid.uri, boxes),
	);
	return { gridUri: grid.uri, scan: killerScanFromRead(cages, sums) };
}
