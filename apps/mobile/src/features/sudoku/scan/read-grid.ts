/**
 * Photo and grid corners in, recognized cells out: the native module does the
 * image work, `@arcadeclub/core/sudoku-scan-ink` decides what to read and
 * what it means. `scripts/scan-bench` measures this same function.
 */
import type { ScanCell } from "@arcadeclub/core/sudoku-scan";
import {
	type DigitRead,
	gridReadBoxes,
	type InkBox,
	type Point,
	planGridReads,
	scanCellsFromGridReads,
} from "@arcadeclub/core/sudoku-scan-ink";

export type GridReader = {
	warpGrid(
		uri: string,
		corners: Point[],
	): Promise<{ uri: string; size: number; pixels: Uint8Array }>;
	readDigits(uri: string, boxes: InkBox[]): Promise<DigitRead[]>;
};

export type ReadGridProgress = { gridUri: string; done: number };

const CELLS_PER_ROW = 9;

/** Null when `onProgress` answers false: a newer scan took over. */
export async function readGrid(
	reader: GridReader,
	photoUri: string,
	corners: Point[],
	onProgress: (progress: ReadGridProgress) => boolean,
): Promise<{ gridUri: string; cells: ScanCell[] } | null> {
	const grid = await reader.warpGrid(photoUri, corners);
	const plans = planGridReads(grid.pixels, grid.size);
	const reads: DigitRead[] = [];
	// A row at a time, so the screen can count the cells read.
	for (let row = 0; row < 9; row += 1) {
		if (!onProgress({ gridUri: grid.uri, done: row * CELLS_PER_ROW })) {
			return null;
		}
		const boxes = gridReadBoxes(
			plans.slice(row * CELLS_PER_ROW, (row + 1) * CELLS_PER_ROW),
		);
		const rowReads =
			boxes.length > 0 ? await reader.readDigits(grid.uri, boxes) : [];
		if (rowReads.length !== boxes.length) {
			throw new Error("The reader answered for a different number of boxes");
		}
		reads.push(...rowReads);
	}
	return { gridUri: grid.uri, cells: scanCellsFromGridReads(plans, reads) };
}
