/**
 * A warped grid's pixels in, recognized cells out, on the web and in the phone
 * app alike: the grid's lines, the ink in its cells, the digit network, which
 * digits are printed and whether the grid itself looks wrong. Only reading a
 * glyph's ink as a digit differs: the phone asks Apple Vision, the web asks
 * tesseract where the network is unsure.
 */
import { type DigitGuess, guessDigit } from "./sudoku-digit-net";
import type { ScanCell } from "./sudoku-scan";
import { doubtWrongGrid } from "./sudoku-scan-doubt";
import {
	type CellInk,
	darkness,
	glyphImage,
	gridInk,
	heightOf,
	type InkPiece,
	imageBox,
	inkDarkness,
} from "./sudoku-scan-glyphs";
import {
	type CellReadPlan,
	type DigitRead,
	type InkBox,
	scanCellFromReads,
} from "./sudoku-scan-ink";
import {
	CELL,
	clearOutside,
	findMesh,
	flatten,
	type GridFrame,
} from "./sudoku-scan-mesh";
import { arePrinted } from "./sudoku-scan-printed";

/** One piece of ink to read, and the network's guess when it is a digit. */
export type GlyphToRead = {
	/** Where the ink is in the warped image, with some paper around it. */
	box: InkBox;
	/** Null for a note: the network reads a cell's single digit only. */
	guess: DigitGuess | null;
};

/** Reads one row's glyphs, in order, to one read each. */
export type ReadGlyphs = (glyphs: GlyphToRead[]) => Promise<DigitRead[]>;

const CELLS_PER_ROW = 9;
/** Paper around the ink in the boxes a reader reads, in pixels. */
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

/**
 * The 81 cells of a grid warped with `withMargins`. `onRow` hears how many
 * cells are read after each row; null when it answers false, because a newer
 * scan took over.
 */
export async function readWarpedGrid(
	grid: { pixels: ArrayLike<number>; size: number },
	margins: GridFrame["margins"],
	readRow: ReadGlyphs,
	onRow: (done: number) => boolean = () => true,
): Promise<ScanCell[] | null> {
	const gray = clearOutside(grid.pixels, grid.size);
	const mesh = findMesh(gray, grid.size, margins);
	const flat = flatten(gray, grid.size, mesh);
	const dark = darkness(flat.pixels);
	const inks = gridInk(dark);
	const reads: DigitRead[][] = [];
	const guesses: (DigitGuess | null)[] = [];
	// A row at a time, so the screen can count the cells read.
	for (let row = 0; row < 9; row += 1) {
		const rowInks = inks.slice(row * CELLS_PER_ROW, (row + 1) * CELLS_PER_ROW);
		const rowGuesses = rowInks.map((ink) =>
			ink.kind === "digit" ? guessDigit(glyphImage(ink.ink)) : null,
		);
		const glyphs = rowInks.flatMap((ink, i) =>
			piecesOf(ink).map((piece) => ({
				box: imageBox(
					piece,
					flat,
					ink.kind === "digit" ? DIGIT_MARGIN : MARK_MARGIN,
				),
				guess: rowGuesses[i],
			})),
		);
		const rowReads = glyphs.length > 0 ? await readRow(glyphs) : [];
		if (rowReads.length !== glyphs.length) {
			throw new Error("The reader answered for a different number of boxes");
		}
		for (const [i, ink] of rowInks.entries()) {
			reads.push(rowReads.splice(0, piecesOf(ink).length));
			guesses.push(rowGuesses[i]);
		}
		if (!onRow(guesses.length)) return null;
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
	return doubtWrongGrid(cells, mesh);
}
