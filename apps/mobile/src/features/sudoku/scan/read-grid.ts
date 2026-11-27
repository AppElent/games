/**
 * Photo and grid corners in, recognized cells out, read upright from a photo
 * taken sideways or upside down. The native module warps the photo and reads
 * with Apple Vision; the grid's lines, the ink in its
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
import {
	clearOutside,
	FLAT,
	findMesh,
	flatten,
	withMargins,
} from "@arcadeclub/core/sudoku-scan-mesh";
import {
	CLASSIC_TURNS,
	findUprightTurns,
	KILLER_TURNS,
	killerSumScore,
	type TurnSearch,
	turnCorners,
	uprightDigitScore,
} from "@arcadeclub/core/sudoku-scan-orientation";
import {
	prepareWarpedGrid,
	readPreparedGrid,
} from "@arcadeclub/core/sudoku-scan-read";

export type GridReader = {
	warpGrid(
		uri: string,
		corners: Point[],
	): Promise<{ uri: string; size: number; pixels: Uint8Array }>;
	readDigits(uri: string, boxes: InkBox[]): Promise<DigitRead[]>;
};

export type ReadGridProgress = { gridUri: string; done: number };

/** Hears why the upright check failed; the photo is read as taken then. */
export type OnCheckFailed = (cause: unknown) => void;

/**
 * The turn that reads a photo taken sideways or upside down upright, and
 * what `at` made of it: the scan warps the grid at each quarter turn of its
 * corners and keeps the turn `findUprightTurns` picks. The photo as taken is
 * `asTaken`, so an upright photo costs no second read. A turn that fails to
 * warp or score leaves the photo as taken.
 */
async function uprightTurn<T>(
	asTaken: T,
	at: (turns: number) => Promise<T>,
	score: (view: T) => number,
	search: TurnSearch,
	onCheckFailed: OnCheckFailed,
): Promise<{ turns: number; view: T }> {
	const views = new Map<number, T>([[0, asTaken]]);
	const viewAt = async (turns: number) => {
		const known = views.get(turns);
		if (known) return known;
		const view = await at(turns);
		views.set(turns, view);
		return view;
	};
	try {
		const turns = await findUprightTurns(
			async (turn) => score(await viewAt(turn)),
			search,
		);
		return { turns, view: await viewAt(turns) };
	} catch (cause) {
		onCheckFailed(cause);
		return { turns: 0, view: asTaken };
	}
}

/**
 * Null when `onProgress` answers false: a newer scan took over. `corners`
 * are the ones read, turned upright.
 */
export async function readGrid(
	reader: GridReader,
	photo: { uri: string; width: number; height: number },
	corners: Point[],
	onProgress: (progress: ReadGridProgress) => boolean,
	onCheckFailed: OnCheckFailed = () => {},
): Promise<{ gridUri: string; cells: ScanCell[]; corners: Point[] } | null> {
	const warpAt = async (turn: number) => {
		const frame = withMargins(turnCorners(corners, turn), photo);
		const grid = await reader.warpGrid(photo.uri, frame.corners);
		return { frame, grid };
	};
	const prepare = ({ frame, grid }: Awaited<ReturnType<typeof warpAt>>) => ({
		grid,
		prepared: prepareWarpedGrid(grid, frame.margins),
	});
	const first = await warpAt(0);
	if (!onProgress({ gridUri: first.grid.uri, done: 0 })) return null;
	// Finding the lines takes a second on a phone: show the grid first.
	await new Promise((resolve) => setTimeout(resolve, 0));
	const { turns, view } = await uprightTurn(
		prepare(first),
		async (turn) => prepare(await warpAt(turn)),
		({ prepared }) => uprightDigitScore(prepared.guesses),
		CLASSIC_TURNS,
		onCheckFailed,
	);
	const { grid, prepared } = view;
	if (turns !== 0 && !onProgress({ gridUri: grid.uri, done: 0 })) return null;
	const cells = await readPreparedGrid(
		prepared,
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
	return cells
		? { gridUri: grid.uri, cells, corners: turnCorners(corners, turns) }
		: null;
}

/**
 * The cages and sums of a Killer, or null for a grid without cages: the
 * classic read takes over then. The grid is warped with margins and its
 * lines straightened, as the classic read does, so corners placed on a frame
 * around the grid or a curled page still read; the sums' digits go to Vision
 * as one batch, at their place in the warped image. A Killer photographed
 * sideways or upside down is turned upright by where its sums sit; `corners`
 * are the ones read, turned upright.
 */
export async function readKiller(
	reader: GridReader,
	photo: { uri: string; width: number; height: number },
	corners: Point[],
	onCheckFailed: OnCheckFailed = () => {},
): Promise<{ gridUri: string; scan: KillerScan; corners: Point[] } | null> {
	const at = async (turn: number) => {
		const frame = withMargins(turnCorners(corners, turn), photo);
		const grid = await reader.warpGrid(photo.uri, frame.corners);
		const gray = clearOutside(grid.pixels, grid.size);
		const flat = flatten(
			gray,
			grid.size,
			findMesh(gray, grid.size, frame.margins),
		);
		const rgba = grayToRgba(flat.pixels);
		return { grid, flat, rgba, cages: readCages(rgba, FLAT) };
	};
	const asTaken = await at(0);
	if (!isKillerRead(asTaken.cages)) return null;
	const { turns, view } = await uprightTurn(
		asTaken,
		at,
		({ rgba, cages }) => killerSumScore(rgba, FLAT, cages),
		KILLER_TURNS,
		onCheckFailed,
	);
	const { grid, flat, rgba, cages } = view;
	const sums = await readKillerSums(rgba, FLAT, cages, (boxes) =>
		reader.readDigits(
			grid.uri,
			boxes.map((box) => warpedBox(box, flat)),
		),
	);
	return {
		gridUri: grid.uri,
		scan: killerScanFromRead(cages, sums),
		corners: turnCorners(corners, turns),
	};
}

/** A box of the straightened grid, as the box around it in the warped image. */
export function warpedBox(
	box: InkBox,
	{ mapX, mapY }: { mapX: Float32Array; mapY: Float32Array },
): InkBox {
	let left = Number.POSITIVE_INFINITY;
	let top = Number.POSITIVE_INFINITY;
	let right = Number.NEGATIVE_INFINITY;
	let bottom = Number.NEGATIVE_INFINITY;
	for (const x of [box.x, box.x + box.width - 1]) {
		for (const y of [box.y, box.y + box.height - 1]) {
			const index =
				Math.min(FLAT - 1, Math.max(0, y)) * FLAT +
				Math.min(FLAT - 1, Math.max(0, x));
			left = Math.min(left, mapX[index]);
			right = Math.max(right, mapX[index]);
			top = Math.min(top, mapY[index]);
			bottom = Math.max(bottom, mapY[index]);
		}
	}
	return {
		x: Math.round(left),
		y: Math.round(top),
		width: Math.round(right) - Math.round(left) + 1,
		height: Math.round(bottom) - Math.round(top) + 1,
	};
}
