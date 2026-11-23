/**
 * Photo and grid corners in, recognized cells out. The native module warps
 * the photo and reads with Apple Vision; the grid's lines, the ink in its
 * cells and the digit network are JavaScript, so they improve by update.
 * `scripts/scan-bench` measures this same function.
 */
import type { ScanCell } from "@arcadeclub/core/sudoku-scan";
import {
	type CellReadPlan,
	type DigitRead,
	type InkBox,
	type Point,
	scanCellFromReads,
} from "@arcadeclub/core/sudoku-scan-ink";
import { type DigitGuess, guessDigit } from "./digit-net";
import { fuseReads } from "./fuse-reads";
import {
	type CellInk,
	darkness,
	glyphImage,
	gridInk,
	heightOf,
	type InkPiece,
	imageBox,
	inkDarkness,
} from "./grid-ink";
import {
	CELL,
	clearOutside,
	findMesh,
	flatten,
	withMargins,
} from "./grid-mesh";
import { arePrinted } from "./printed-digits";

export type GridReader = {
	warpGrid(
		uri: string,
		corners: Point[],
	): Promise<{ uri: string; size: number; pixels: Uint8Array }>;
	readDigits(uri: string, boxes: InkBox[]): Promise<DigitRead[]>;
};

export type ReadGridProgress = { gridUri: string; done: number };

const CELLS_PER_ROW = 9;
/** Paper around the ink in the boxes Vision reads, in pixels. */
const DIGIT_MARGIN = 2;
const MARK_MARGIN = 1;
/** How near the cell's middle a centre note is, as shares of the cell. */
const CENTRAL = { from: 0.3, to: 0.7 };

const piecesOf = (ink: CellInk): InkPiece[] =>
	ink.kind === "digit" ? [ink.ink] : ink.kind === "notes" ? ink.marks : [];

const boxOf = (piece: InkPiece): InkBox => ({
	x: piece.minX,
	y: piece.minY,
	width: piece.maxX - piece.minX + 1,
	height: piece.maxY - piece.minY + 1,
});

function isCentral(mark: InkPiece) {
	const inside = (low: number, high: number) => {
		const middle = (((low + high + 1) / 2) % CELL) / CELL;
		return middle > CENTRAL.from && middle < CENTRAL.to;
	};
	return inside(mark.minX, mark.maxX) && inside(mark.minY, mark.maxY);
}

function planOf(ink: CellInk, printed: boolean): CellReadPlan {
	if (ink.kind === "empty") return ink;
	if (ink.kind === "digit") {
		return { kind: "digit", box: boxOf(ink.ink), printed };
	}
	return {
		kind: "notes",
		marks: ink.marks.map((mark) => ({
			box: boxOf(mark),
			central: isCentral(mark),
		})),
	};
}

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
	const gray = clearOutside(grid.pixels, grid.size);
	const flat = flatten(
		gray,
		grid.size,
		findMesh(gray, grid.size, frame.margins),
	);
	const dark = darkness(flat.pixels);
	const inks = gridInk(dark);
	const reads: DigitRead[][] = [];
	const guesses: (DigitGuess | null)[] = [];
	// A row at a time, so the screen can count the cells read.
	for (let row = 0; row < 9; row += 1) {
		const rowInks = inks.slice(row * CELLS_PER_ROW, (row + 1) * CELLS_PER_ROW);
		const boxes = rowInks.flatMap((ink) =>
			piecesOf(ink).map((piece) =>
				imageBox(
					piece,
					flat,
					ink.kind === "digit" ? DIGIT_MARGIN : MARK_MARGIN,
				),
			),
		);
		const rowReads =
			boxes.length > 0 ? await reader.readDigits(grid.uri, boxes) : [];
		if (rowReads.length !== boxes.length) {
			throw new Error("The reader answered for a different number of boxes");
		}
		for (const ink of rowInks) {
			const vision = rowReads.splice(0, piecesOf(ink).length);
			// The network always finds a digit, so a note takes Vision's word.
			const guess =
				ink.kind === "digit" ? guessDigit(glyphImage(ink.ink)) : null;
			guesses.push(guess);
			reads.push(guess ? vision.map((read) => fuseReads(read, guess)) : vision);
		}
		if (!onProgress({ gridUri: grid.uri, done: guesses.length })) return null;
	}

	const digits = inks.flatMap((ink, cell) => {
		const guess = guesses[cell];
		if (ink.kind !== "digit" || !guess) return [];
		return [
			{
				cell,
				score: guess.printScore,
				height: heightOf(ink.ink),
				darkness: inkDarkness(ink.ink, dark),
			},
		];
	});
	const printed = new Map(
		arePrinted(digits).map((print, i) => [digits[i].cell, print]),
	);
	const cells = inks.map((ink, cell) =>
		scanCellFromReads(planOf(ink, printed.get(cell) ?? false), reads[cell]),
	);
	return { gridUri: grid.uri, cells };
}
