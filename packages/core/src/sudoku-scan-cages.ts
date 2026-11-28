/**
 * Reading a Killer sudoku's cages from a straightened photo of its grid.
 *
 * A printed Killer draws each cage as a dashed outline just inside its
 * cells. Where two neighbouring cells belong to different cages, both sides
 * of the grid line between them carry a dashed line; where they share a
 * cage, neither does. So each of the 144 inner cell edges is read on its own,
 * and the cages are the groups of cells joined by edges without dashes.
 *
 * The caller warps the grid to `size` x `size` pixels (the web uses 900) and
 * passes its RGBA pixels. The sums are read separately, from `cageSumBox`.
 */
import { emptyGrid, SUDOKU_CELL_COUNT } from "./sudoku";
import type { KillerCage } from "./sudoku-killer";
import { countKillerSolutions, validateKillerCages } from "./sudoku-killer";
import type { InkBox } from "./sudoku-scan-ink";

/** An inner edge: between `cell` and the cell right of it, or below it. */
export type CageEdge = { cell: number; side: "right" | "bottom" };

/** The grid's outer lines in the image, in pixels. */
export type GridBounds = {
	left: number;
	right: number;
	top: number;
	bottom: number;
};

export type CageRead = {
	/** Cells per cage, each sorted; cages ordered by their first cell. */
	cages: number[][];
	/** The edges read as cage borders. */
	borders: CageEdge[];
	/** Edges the read is unsure of; the verify step marks them. */
	doubtful: CageEdge[];
	/**
	 * How strongly each inner edge looked like a cage line, by `edgeKey`: 0
	 * (no dashes) to 2 (dashes on both sides). Above `BORDER_SCORE` is a line.
	 */
	scores?: Record<string, number>;
	/** Where the cells are in the image the read was given. */
	bounds: GridBounds;
};

/** Darker than its surroundings by this much (0-255) counts as ink. */
const INK_CONTRAST = 35;
/** Half the window, in cells, the paper's local brightness is taken over. */
const BACKGROUND_RADIUS = 0.25;

/**
 * Pen strokes in the usual blue ink: hue 170-300 degrees, saturated. Used to
 * drop handwriting when the print itself is not blue.
 */
function isBlueInk(r: number, g: number, b: number) {
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	if (max === 0 || ((max - min) * 255) / max <= 45) {
		return false;
	}
	const d = max - min;
	let hue: number;
	if (max === r) {
		hue = 60 * (((g - b) / d) % 6);
	} else if (max === g) {
		hue = 60 * ((b - r) / d + 2);
	} else {
		hue = 60 * ((r - g) / d + 4);
	}
	if (hue < 0) {
		hue += 360;
	}
	return hue >= 170 && hue <= 300;
}

/**
 * 1 where a pixel is ink: darker than the paper around it. With
 * `ignoreBlue`, blue pen strokes (and the pixel around them) are left out.
 */
export function cageInk(
	rgba: ArrayLike<number>,
	size: number,
	{ ignoreBlue }: { ignoreBlue: boolean },
): Uint8Array {
	const count = size * size;
	const gray = new Float64Array(count);
	for (let i = 0; i < count; i += 1) {
		gray[i] =
			0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2];
	}
	// Paper brightness: a box mean around each pixel, via an integral image.
	const integral = new Float64Array((size + 1) * (size + 1));
	for (let y = 0; y < size; y += 1) {
		let row = 0;
		for (let x = 0; x < size; x += 1) {
			row += gray[y * size + x];
			integral[(y + 1) * (size + 1) + x + 1] =
				integral[y * (size + 1) + x + 1] + row;
		}
	}
	const radius = Math.max(4, Math.round((size / 9) * BACKGROUND_RADIUS));
	const ink = new Uint8Array(count);
	for (let y = 0; y < size; y += 1) {
		const y0 = Math.max(0, y - radius);
		const y1 = Math.min(size, y + radius + 1);
		for (let x = 0; x < size; x += 1) {
			const x0 = Math.max(0, x - radius);
			const x1 = Math.min(size, x + radius + 1);
			const sum =
				integral[y1 * (size + 1) + x1] -
				integral[y0 * (size + 1) + x1] -
				integral[y1 * (size + 1) + x0] +
				integral[y0 * (size + 1) + x0];
			const mean = sum / ((y1 - y0) * (x1 - x0));
			// Thin lines barely move the mean; lift it toward the paper a little.
			const paper = mean + (255 - mean) * 0.15;
			ink[y * size + x] = paper - gray[y * size + x] > INK_CONTRAST ? 1 : 0;
		}
	}
	if (ignoreBlue) {
		const blue = new Uint8Array(count);
		for (let i = 0; i < count; i += 1) {
			if (ink[i] && isBlueInk(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2])) {
				blue[i] = 1;
			}
		}
		for (let y = 0; y < size; y += 1) {
			for (let x = 0; x < size; x += 1) {
				if (!blue[y * size + x]) {
					continue;
				}
				for (let dy = -1; dy <= 1; dy += 1) {
					for (let dx = -1; dx <= 1; dx += 1) {
						const yy = y + dy;
						const xx = x + dx;
						if (yy >= 0 && yy < size && xx >= 0 && xx < size) {
							ink[yy * size + xx] = 0;
						}
					}
				}
			}
		}
	}
	return ink;
}

/**
 * How strongly a band of ink holds a dashed line along its length: the
 * share of the line covered, for the best line that has at least three
 * separate dashes and no stretch longer than 45% of it. A pen stroke is one
 * long stretch, so it scores 0. `at(along, across)` reads the band.
 */
function dashedLineScore(
	at: (along: number, across: number) => number,
	length: number,
	width: number,
) {
	let best = 0;
	for (let j = 1; j < width - 1; j += 1) {
		let covered = 0;
		let runs = 0;
		let longest = 0;
		let run = 0;
		for (let i = 0; i <= length; i += 1) {
			const on =
				i < length && (at(i, j - 1) || at(i, j) || at(i, j + 1)) ? 1 : 0;
			covered += on;
			if (on) {
				run += 1;
			} else if (run > 0) {
				if (run >= 2) {
					runs += 1;
				}
				longest = Math.max(longest, run);
				run = 0;
			}
		}
		if (runs >= 3 && longest <= 0.45 * length) {
			best = Math.max(best, covered / length);
		}
	}
	return Math.min(best, 1);
}

/**
 * Where the solid grid line near `nominal` really is: on a curled page it
 * can sit several pixels off. The line must cover most of the stretch, so a
 * dashed cage line next to it is not taken for it.
 */
function snapToGridLine(
	nominal: number,
	slack: number,
	at: (across: number, along: number) => number,
	length: number,
	size: number,
) {
	let best = nominal;
	let bestCover = 0.8;
	for (
		let across = Math.max(0, nominal - slack);
		across <= Math.min(size - 1, nominal + slack);
		across += 1
	) {
		let covered = 0;
		for (let along = 0; along < length; along += 1) {
			covered += at(across, along);
		}
		const cover = covered / length;
		if (
			cover > bestCover ||
			(cover === bestCover &&
				Math.abs(across - nominal) < Math.abs(best - nominal))
		) {
			best = across;
			bestCover = cover;
		}
	}
	return best;
}

/** 0 (no dashes) to 2 (dashed lines on both sides) for one inner edge. */
function edgeScore(ink: Uint8Array, size: number, edge: CageEdge) {
	const cellSize = size / 9;
	const row = Math.floor(edge.cell / 9);
	const col = edge.cell % 9;
	// Read the middle half of the edge, clear of the cell corners and sums.
	const from = Math.round(cellSize * 0.25);
	const length = Math.round(cellSize * 0.5);
	const near = Math.round(cellSize * 0.05);
	const far = Math.round(cellSize * 0.22);
	const width = far - near;
	const slack = Math.round(cellSize * SNAP_SLACK);
	if (edge.side === "right") {
		const top = Math.round(row * cellSize) + from;
		const line = snapToGridLine(
			Math.round((col + 1) * cellSize),
			slack,
			(across, along) => ink[(top + along) * size + across],
			length,
			size,
		);
		const side = (start: number) => (i: number, j: number) =>
			ink[(top + i) * size + start + j];
		return (
			dashedLineScore(side(line - far), length, width) +
			dashedLineScore(side(line + near), length, width)
		);
	}
	const left = Math.round(col * cellSize) + from;
	const line = snapToGridLine(
		Math.round((row + 1) * cellSize),
		slack,
		(across, along) => ink[across * size + left + along],
		length,
		size,
	);
	const side = (start: number) => (i: number, j: number) =>
		ink[(start + j) * size + left + i];
	return (
		dashedLineScore(side(line - far), length, width) +
		dashedLineScore(side(line + near), length, width)
	);
}

/**
 * How far, in cells, a grid line may sit from where the corners put it: a
 * curled page bends lines, and corners on a frame around the grid shift them.
 */
const SNAP_SLACK = 0.18;

/** Above this an edge is a cage border. */
export const BORDER_SCORE = 0.6;
/** Between these the read is doubtful. */
const DOUBT_LOW = 0.15;
const DOUBT_HIGH = 1.15;

export function innerEdges(): CageEdge[] {
	const edges: CageEdge[] = [];
	for (let cell = 0; cell < SUDOKU_CELL_COUNT; cell += 1) {
		if (cell % 9 < 8) {
			edges.push({ cell, side: "right" });
		}
		if (cell < 72) {
			edges.push({ cell, side: "bottom" });
		}
	}
	return edges;
}

export function edgeNeighbor(edge: CageEdge) {
	return edge.side === "right" ? edge.cell + 1 : edge.cell + 9;
}

/** Groups cells joined by edges that are not borders. */
export function cagesFromBorders(isBorder: (edge: CageEdge) => boolean) {
	const parent = Array.from({ length: SUDOKU_CELL_COUNT }, (_, i) => i);
	const find = (cell: number): number => {
		let root = cell;
		while (parent[root] !== root) {
			root = parent[root];
		}
		parent[cell] = root;
		return root;
	};
	for (const edge of innerEdges()) {
		if (!isBorder(edge)) {
			parent[find(edge.cell)] = find(edgeNeighbor(edge));
		}
	}
	const groups = new Map<number, number[]>();
	for (let cell = 0; cell < SUDOKU_CELL_COUNT; cell += 1) {
		const root = find(cell);
		const group = groups.get(root) ?? [];
		group.push(cell);
		groups.set(root, group);
	}
	return [...groups.values()].sort((a, b) => a[0] - b[0]);
}

function readWithInk(ink: Uint8Array, size: number): Omit<CageRead, "bounds"> {
	const scores: Record<string, number> = {};
	const doubtful: CageEdge[] = [];
	const borders: CageEdge[] = [];
	for (const edge of innerEdges()) {
		const score = edgeScore(ink, size, edge);
		scores[edgeKey(edge)] = score;
		if (score > BORDER_SCORE) {
			borders.push(edge);
		}
		if (score > DOUBT_LOW && score < DOUBT_HIGH) {
			doubtful.push(edge);
		}
	}
	return {
		cages: cagesFromBorders((edge) => scores[edgeKey(edge)] > BORDER_SCORE),
		borders,
		doubtful,
		scores,
	};
}

/**
 * How unlikely a read is as a Killer: a cage of more than nine cells cannot
 * be, single cells are rare, and every doubtful edge counts.
 */
function implausibility(read: Omit<CageRead, "bounds">) {
	let penalty = read.doubtful.length;
	for (const cage of read.cages) {
		if (cage.length > 9) {
			penalty += 50;
		} else if (cage.length === 1) {
			penalty += 2;
		}
	}
	return penalty;
}

/** How far in, as a share of the image, a frame around the grid may reach. */
const FRAME_REACH = 0.07;

/**
 * Where the grid's outer lines are, when the photo's corners sat on a frame
 * around it (some books print the grid on a coloured panel). Each bound is
 * the innermost solid line within reach of that side; with none, the side
 * stays at the image's edge.
 */
export function gridBounds(ink: Uint8Array, size: number): GridBounds {
	const reach = Math.round(size * FRAME_REACH);
	const from = Math.round(size * 0.1);
	const to = Math.round(size * 0.9);
	const solid = (line: (along: number) => number) => {
		let covered = 0;
		for (let along = from; along < to; along += 1) {
			covered += line(along);
		}
		return covered / (to - from) > 0.75;
	};
	const column = (x: number) => (y: number) => ink[y * size + x];
	const row = (y: number) => (x: number) => ink[y * size + x];
	const inner = (
		line: (at: number) => (along: number) => number,
		inward: 1 | -1,
	) => {
		const edge = inward === 1 ? 0 : size - 1;
		let last = -1;
		for (let step = 0; step < reach; step += 1) {
			if (solid(line(edge + inward * step))) {
				last = step;
			}
		}
		return last < 0 ? edge : edge + inward * last;
	};
	return {
		left: inner(column, 1),
		right: inner(column, -1),
		top: inner(row, 1),
		bottom: inner(row, -1),
	};
}

/** The part of the image inside `bounds`, stretched back to `size` square. */
function cropToBounds(
	rgba: ArrayLike<number>,
	size: number,
	{ left, right, top, bottom }: GridBounds,
) {
	const out = new Uint8ClampedArray(size * size * 4);
	const sx = (right - left) / (size - 1);
	const sy = (bottom - top) / (size - 1);
	for (let y = 0; y < size; y += 1) {
		const fy = top + y * sy;
		const y0 = Math.floor(fy);
		const y1 = Math.min(size - 1, y0 + 1);
		const wy = fy - y0;
		for (let x = 0; x < size; x += 1) {
			const fx = left + x * sx;
			const x0 = Math.floor(fx);
			const x1 = Math.min(size - 1, x0 + 1);
			const wx = fx - x0;
			for (let c = 0; c < 4; c += 1) {
				const a = rgba[(y0 * size + x0) * 4 + c];
				const b = rgba[(y0 * size + x1) * 4 + c];
				const d = rgba[(y1 * size + x0) * 4 + c];
				const e = rgba[(y1 * size + x1) * 4 + c];
				out[(y * size + x) * 4 + c] =
					(a * (1 - wx) + b * wx) * (1 - wy) + (d * (1 - wx) + e * wx) * wy;
			}
		}
	}
	return out;
}

/**
 * Reads the cages and keeps the most plausible of up to four reads: with all
 * ink and without blue pen strokes, on the image as given and inside a frame
 * found around the grid. Blue handwriting can look like dashes; a blue print
 * loses its dashes when blue is dropped, which the size check catches.
 */
export function readCages(rgba: ArrayLike<number>, size: number): CageRead {
	const whole: GridBounds = {
		left: 0,
		top: 0,
		right: size - 1,
		bottom: size - 1,
	};
	const images: { pixels: ArrayLike<number>; bounds: GridBounds }[] = [
		{ pixels: rgba, bounds: whole },
	];
	const bounds = gridBounds(cageInk(rgba, size, { ignoreBlue: false }), size);
	if (
		bounds.left > 2 ||
		bounds.top > 2 ||
		bounds.right < size - 3 ||
		bounds.bottom < size - 3
	) {
		images.push({ pixels: cropToBounds(rgba, size, bounds), bounds });
	}
	let best: CageRead | null = null;
	for (const image of images) {
		for (const ignoreBlue of [false, true]) {
			const read = readWithInk(
				cageInk(image.pixels, size, { ignoreBlue }),
				size,
			);
			if (!best || implausibility(read) < implausibility(best)) {
				best = { ...read, bounds: image.bounds };
			}
		}
	}
	return best as CageRead;
}

/**
 * Where a cage's printed sum sits, in the image `readCages` was given: the
 * top-left corner of the cage's first cell.
 */
export function cageSumBox(cage: number[], bounds: GridBounds): InkBox {
	const cellWidth = (bounds.right - bounds.left) / 9;
	const cellHeight = (bounds.bottom - bounds.top) / 9;
	const first = Math.min(...cage);
	return {
		x: Math.round(bounds.left + ((first % 9) + 0.03) * cellWidth),
		y: Math.round(bounds.top + (Math.floor(first / 9) + 0.02) * cellHeight),
		width: Math.round(cellWidth * 0.45),
		height: Math.round(cellHeight * 0.32),
	};
}

export type ScannedCagesError =
	| { kind: "invalidCages" }
	| { kind: "total"; total: number }
	| { kind: "notUnique"; solutions: number };

/** The sum all cages of a Killer add up to: nine times 1 + ... + 9. */
export const KILLER_TOTAL = 405;

/**
 * What is wrong with scanned cages and sums, in the order to fix it: cages
 * that cannot be (too big, an impossible sum), a total other than 405, or a
 * puzzle without exactly one solution. Counting solutions can take a second,
 * so a screen that checks on every edit skips it with `checkUnique: false`.
 */
export function validateScannedCages(
	cages: KillerCage[],
	{ checkUnique = true }: { checkUnique?: boolean } = {},
): ScannedCagesError | null {
	if (!validateKillerCages(cages)) {
		return { kind: "invalidCages" };
	}
	const total = cages.reduce((sum, cage) => sum + cage.sum, 0);
	if (total !== KILLER_TOTAL) {
		return { kind: "total", total };
	}
	if (!checkUnique) {
		return null;
	}
	const solutions = countKillerSolutions(emptyGrid(), cages, 2);
	return solutions === 1 ? null : { kind: "notUnique", solutions };
}

/**
 * A Killer scan the player corrects: which edges are cage borders, and the
 * sum read (or typed) for each cage, kept on the cage's first cell so a sum
 * stays put while cages around it change.
 */
export type KillerScan = {
	/** `edgeKey`s of the border edges. */
	borders: string[];
	/** `edgeKey`s the read was unsure of. */
	doubtful: string[];
	/** Sum per cage, by the cage's first cell. */
	sums: Record<number, number>;
	/** First cells of the cages whose sum was read with doubt. */
	unsureSums?: number[];
};

export function edgeKey(edge: CageEdge) {
	return `${edge.cell}${edge.side === "right" ? "r" : "b"}`;
}

/** The edge between two orthogonally neighbouring cells, else null. */
export function edgeBetween(a: number, b: number): CageEdge | null {
	const [low, high] = a < b ? [a, b] : [b, a];
	if (high - low === 1 && low % 9 < 8) {
		return { cell: low, side: "right" };
	}
	if (high - low === 9) {
		return { cell: low, side: "bottom" };
	}
	return null;
}

export function killerScanFromRead(
	read: CageRead,
	sums: (number | null)[],
	unsure: boolean[] = [],
): KillerScan {
	const byFirst: Record<number, number> = {};
	read.cages.forEach((cells, index) => {
		const sum = sums[index];
		if (sum !== null && sum !== undefined) {
			byFirst[cells[0]] = sum;
		}
	});
	return {
		borders: read.borders.map(edgeKey),
		doubtful: read.doubtful.map(edgeKey),
		sums: byFirst,
		unsureSums: read.cages.flatMap((cells, index) =>
			unsure[index] ? [cells[0]] : [],
		),
	};
}

/** The cages a scan draws, each with its sum or null when it has none yet. */
export function killerScanCages(scan: KillerScan) {
	const borders = new Set(scan.borders);
	return cagesFromBorders((edge) => borders.has(edgeKey(edge))).map(
		(cells) => ({ cells, sum: scan.sums[cells[0]] ?? null }),
	);
}

/** Makes `edge` a border, or joins the cells across it. */
export function toggleKillerBorder(
	scan: KillerScan,
	edge: CageEdge,
): KillerScan {
	const key = edgeKey(edge);
	const borders = scan.borders.includes(key)
		? scan.borders.filter((entry) => entry !== key)
		: [...scan.borders, key];
	const toggled = {
		...scan,
		borders,
		doubtful: scan.doubtful.filter((entry) => entry !== key),
	};
	// A join drops the absorbed cage's sum, so a later split asks for it
	// again rather than bringing back a sum nobody looked at.
	const firsts = new Set(killerScanCages(toggled).map((cage) => cage.cells[0]));
	const sums: Record<number, number> = {};
	for (const [cell, sum] of Object.entries(scan.sums)) {
		if (firsts.has(Number(cell))) {
			sums[Number(cell)] = sum;
		}
	}
	return {
		...toggled,
		sums,
		unsureSums: scan.unsureSums?.filter((cell) => firsts.has(cell)),
	};
}

/** A typed or read cage sum: a whole number from 1 to 45, else null. */
export function parseCageSum(text: string): number | null {
	if (!/^[0-9]{1,2}$/.test(text.trim())) {
		return null;
	}
	const sum = Number(text.trim());
	return sum >= 1 && sum <= 45 ? sum : null;
}

/** Sets (or clears, with null) the sum of the cage that holds `cell`. */
export function setKillerSum(
	scan: KillerScan,
	cell: number,
	sum: number | null,
): KillerScan {
	const cage = killerScanCages(scan).find((entry) =>
		entry.cells.includes(cell),
	);
	if (!cage) {
		return scan;
	}
	const sums = { ...scan.sums };
	if (sum === null) {
		delete sums[cage.cells[0]];
	} else {
		sums[cage.cells[0]] = sum;
	}
	// A sum the player typed is theirs: it is no longer unsure.
	return {
		...scan,
		sums,
		unsureSums: scan.unsureSums?.filter((cell) => cell !== cage.cells[0]),
	};
}

export type KillerScanCheck =
	| { kind: "missingSums"; count: number }
	| ScannedCagesError;

/** The first thing to fix before the scan can be played, or null. */
export function checkKillerScan(
	scan: KillerScan,
	options?: { checkUnique?: boolean },
): KillerScanCheck | null {
	const cages = killerScanCages(scan);
	const missing = cages.filter((cage) => cage.sum === null).length;
	if (missing > 0) {
		return { kind: "missingSums", count: missing };
	}
	return validateScannedCages(
		cages.map((cage) => ({ cells: cage.cells, sum: cage.sum ?? 0 })),
		options,
	);
}

/** Looks like a Killer: enough cages, none bigger than nine cells. */
export function isKillerRead(read: CageRead) {
	return (
		read.cages.length >= 12 && read.cages.every((cage) => cage.length <= 9)
	);
}

/**
 * Where one cage's printed sum is, in the image's pixels, and which pixels of
 * that box are its ink (1) rather than lines, dashes or paper (0).
 */
export type SumInk = {
	box: InkBox;
	/** Row by row, `box.width` x `box.height`. */
	mask: Uint8Array;
	/**
	 * The same ink, not grown: a small 0's hole stays open in it. Row by row,
	 * as `mask`.
	 */
	ink: Uint8Array;
	/** Each digit's box, left to right, in `box`'s own pixels. */
	digits: InkBox[];
};

type InkComponent = {
	left: number;
	right: number;
	top: number;
	bottom: number;
	pixels: number[];
};

/**
 * The digits of a cage's printed sum, with the grid lines, the cage's dashes
 * and other cells' ink left out, or null when no sum-sized ink is found.
 *
 * A curled page bends the grid, so the first cell is not exactly where even
 * spacing puts it: the search looks a third of a cell around that spot. Long
 * straight runs (grid lines) are wiped first, so a digit that touches a line
 * still stands alone. What is left is kept when it is sum-sized: taller than
 * a dash, smaller than a solved digit. The piece nearest the cell's corner
 * is the sum's first digit; a piece beside it on the same line is the second.
 */
export function cageSumInk(
	rgba: ArrayLike<number>,
	size: number,
	cage: number[],
	bounds: GridBounds,
	{ ignoreBlue }: { ignoreBlue: boolean },
): SumInk | null {
	const cellWidth = (bounds.right - bounds.left) / 9;
	const cellHeight = (bounds.bottom - bounds.top) / 9;
	const first = Math.min(...cage);
	const cornerX = bounds.left + (first % 9) * cellWidth;
	const cornerY = bounds.top + Math.floor(first / 9) * cellHeight;
	const x0 = Math.max(0, Math.round(cornerX - cellWidth * 0.35));
	const y0 = Math.max(0, Math.round(cornerY - cellHeight * 0.35));
	const x1 = Math.min(size, Math.round(cornerX + cellWidth * 0.8));
	const y1 = Math.min(size, Math.round(cornerY + cellHeight * 0.65));
	const width = x1 - x0;
	const height = y1 - y0;
	if (width <= 0 || height <= 0) {
		return null;
	}
	const region = regionInk(rgba, size, { x: x0, y: y0, width, height });
	if (ignoreBlue) {
		for (let y = 0; y < height; y += 1) {
			for (let x = 0; x < width; x += 1) {
				const o = ((y0 + y) * size + x0 + x) * 4;
				if (isBlueInk(rgba[o], rgba[o + 1], rgba[o + 2])) {
					region[y * width + x] = 0;
				}
			}
		}
	}
	const wiped = wipeLongRuns(
		region,
		width,
		height,
		cellWidth * 0.35,
		cellHeight * 0.35,
	);
	// A thin piece that touches a wiped line is what is left of that line; a
	// thin piece on its own can be a plain 1.
	const lineRemnant = (piece: InkComponent) =>
		piece.right - piece.left + 1 < cellWidth * 0.06 &&
		piece.pixels.some((index) => {
			const x = index % width;
			const y = Math.floor(index / width);
			for (let dy = -1; dy <= 1; dy += 1) {
				for (let dx = -1; dx <= 1; dx += 1) {
					const xx = x + dx;
					const yy = y + dy;
					if (
						xx >= 0 &&
						yy >= 0 &&
						xx < width &&
						yy < height &&
						wiped[yy * width + xx]
					) {
						return true;
					}
				}
			}
			return false;
		});

	const allPieces = inkComponents(region, width, height).map((piece) =>
		piece.right - piece.left + 1 > cellWidth * 0.32
			? trimThinTail(piece, width, cellWidth * 0.08)
			: piece,
	);
	const pieces = allPieces.filter((piece) => {
		const pieceHeight = piece.bottom - piece.top + 1;
		const pieceWidth = piece.right - piece.left + 1;
		return (
			pieceHeight >= cellHeight * 0.12 &&
			pieceHeight <= cellHeight * 0.42 &&
			pieceWidth <= cellWidth * 0.32 &&
			!lineRemnant(piece)
		);
	});
	if (pieces.length === 0) {
		return null;
	}
	// The sum starts just inside the cell's top-left corner.
	const targetX = cornerX - x0 + cellWidth * 0.08;
	const targetY = cornerY - y0 + cellHeight * 0.08;
	const distance = (piece: InkComponent) =>
		Math.hypot(piece.left - targetX, piece.top - targetY);
	// A cage's dashes can run together into a hairline as tall as a digit.
	// A bolder piece wins the seed; growing the line still picks up a 1.
	const hairline = (piece: InkComponent) =>
		piece.pixels.length / (piece.bottom - piece.top + 1) < cellWidth * 0.03;
	const reach = Math.max(cellWidth, cellHeight) * 0.45;
	const nearest = (candidates: InkComponent[]) =>
		candidates
			.filter((piece) => distance(piece) <= reach)
			.reduce<InkComponent | null>(
				(best, piece) =>
					best === null || distance(piece) < distance(best) ? piece : best,
				null,
			);
	const seed =
		nearest(pieces.filter((piece) => !hairline(piece))) ?? nearest(pieces);
	if (!seed) {
		return null;
	}
	const heightOf = (piece: InkComponent) => piece.bottom - piece.top + 1;
	const found = [seed];
	// Compared by the shorter piece: a digit that touches a dash below it
	// grows taller than its neighbour.
	const sameLine = (piece: InkComponent) => {
		const overlap =
			Math.min(piece.bottom, seed.bottom) - Math.max(piece.top, seed.top);
		return overlap >= Math.min(heightOf(piece), heightOf(seed)) * 0.5;
	};
	for (const direction of [1, -1]) {
		let edge = direction === 1 ? seed.right : seed.left;
		for (;;) {
			const next = pieces.find((piece) => {
				const reach = Math.min(heightOf(piece), heightOf(seed)) * 0.45;
				return (
					!found.includes(piece) &&
					sameLine(piece) &&
					(direction === 1
						? piece.left > edge && piece.left - edge <= reach
						: piece.right < edge && edge - piece.right <= reach)
				);
			});
			if (!next || found.length >= 2) {
				break;
			}
			found.push(next);
			edge = direction === 1 ? next.right : next.left;
		}
	}
	// A sum's digits share one height; anything a taller one has beyond the
	// shortest one's rows is a dash it touches.
	const shortest = found.reduce((best, piece) =>
		heightOf(piece) < heightOf(best) ? piece : best,
	);
	const rowTop = found.length > 1 ? shortest.top - 2 : -1;
	const rowBottom = found.length > 1 ? shortest.bottom + 2 : height;
	const clip = (piece: InkComponent): InkComponent => {
		if (piece.top >= rowTop && piece.bottom <= rowBottom) {
			return piece;
		}
		const clipped: InkComponent = {
			left: piece.right,
			right: piece.left,
			top: rowBottom,
			bottom: rowTop,
			pixels: [],
		};
		for (const index of piece.pixels) {
			const x = index % width;
			const y = Math.floor(index / width);
			if (y < rowTop || y > rowBottom) {
				continue;
			}
			clipped.pixels.push(index);
			clipped.left = Math.min(clipped.left, x);
			clipped.right = Math.max(clipped.right, x);
			clipped.top = Math.min(clipped.top, y);
			clipped.bottom = Math.max(clipped.bottom, y);
		}
		return clipped;
	};
	const line = found.map(clip);
	const left = Math.min(...line.map((piece) => piece.left));
	const right = Math.max(...line.map((piece) => piece.right));
	const top = Math.min(...line.map((piece) => piece.top));
	const bottom = Math.max(...line.map((piece) => piece.bottom));
	// Bits of the digits the threshold cut off (the bar of a 5) lie inside.
	const kept = [
		...line,
		...allPieces.filter(
			(piece) =>
				!found.includes(piece) &&
				piece.left >= left - 2 &&
				piece.right <= right + 2 &&
				piece.top >= top - 2 &&
				piece.bottom <= bottom + 2,
		),
	];
	const pad = 2;
	const boxLeft = Math.max(0, left - pad);
	const boxTop = Math.max(0, top - pad);
	const boxWidth = Math.min(width - 1, right + pad) - boxLeft + 1;
	const boxHeight = Math.min(height - 1, bottom + pad) - boxTop + 1;
	const mask = new Uint8Array(boxWidth * boxHeight);
	const solid = new Uint8Array(boxWidth * boxHeight);
	for (const piece of kept) {
		for (const index of piece.pixels) {
			const px = (index % width) - boxLeft;
			const py = Math.floor(index / width) - boxTop;
			if (px >= 0 && py >= 0 && px < boxWidth && py < boxHeight) {
				solid[py * boxWidth + px] = 1;
			}
			// Grown by a pixel, so the soft edge of each stroke stays.
			for (let dy = -1; dy <= 1; dy += 1) {
				for (let dx = -1; dx <= 1; dx += 1) {
					const x = px + dx;
					const y = py + dy;
					if (x >= 0 && y >= 0 && x < boxWidth && y < boxHeight) {
						mask[y * boxWidth + x] = 1;
					}
				}
			}
		}
	}
	return {
		box: {
			x: x0 + boxLeft,
			y: y0 + boxTop,
			width: boxWidth,
			height: boxHeight,
		},
		mask,
		ink: solid,
		digits: [...line]
			.sort((a, b) => a.left - b.left)
			.map((digit) => {
				const parts = kept.filter((piece) => {
					const middle = (piece.left + piece.right) / 2;
					return middle >= digit.left && middle <= digit.right;
				});
				const digitLeft = Math.min(...parts.map((piece) => piece.left));
				const digitTop = Math.min(...parts.map((piece) => piece.top));
				return {
					x: digitLeft - boxLeft,
					y: digitTop - boxTop,
					width: Math.max(...parts.map((piece) => piece.right)) - digitLeft + 1,
					height:
						Math.max(...parts.map((piece) => piece.bottom)) - digitTop + 1,
				};
			}),
	};
}

/**
 * The sum's pixels as gray (0 = darkest ink, 255 = paper), row by row over
 * `sum.box`, with everything off the mask painted white: what a text reader
 * is given, free of lines and dashes.
 */
export function sumGray(
	rgba: ArrayLike<number>,
	size: number,
	sum: SumInk,
): Uint8ClampedArray {
	const { box, mask } = sum;
	const gray = new Uint8ClampedArray(box.width * box.height);
	let darkest = 255;
	let lightest = 0;
	for (let y = 0; y < box.height; y += 1) {
		for (let x = 0; x < box.width; x += 1) {
			const o = ((box.y + y) * size + box.x + x) * 4;
			const value = 0.299 * rgba[o] + 0.587 * rgba[o + 1] + 0.114 * rgba[o + 2];
			gray[y * box.width + x] = value;
			lightest = Math.max(lightest, value);
			if (mask[y * box.width + x]) {
				darkest = Math.min(darkest, value);
			}
		}
	}
	const range = Math.max(1, lightest - darkest);
	for (let i = 0; i < gray.length; i += 1) {
		gray[i] = mask[i] ? ((gray[i] - darkest) * 255) / range : 255;
	}
	return gray;
}

/**
 * Ink in a small box, split from the paper at one threshold (Otsu's). Over
 * a cell or so the paper is even, and one threshold keeps a bold digit
 * whole where a local one breaks it up.
 */
function regionInk(rgba: ArrayLike<number>, size: number, box: InkBox) {
	const gray = new Uint8Array(box.width * box.height);
	const histogram = new Array<number>(256).fill(0);
	for (let y = 0; y < box.height; y += 1) {
		for (let x = 0; x < box.width; x += 1) {
			const o = ((box.y + y) * size + box.x + x) * 4;
			const value = Math.round(
				0.299 * rgba[o] + 0.587 * rgba[o + 1] + 0.114 * rgba[o + 2],
			);
			gray[y * box.width + x] = value;
			histogram[value] += 1;
		}
	}
	const total = gray.length;
	let sumAll = 0;
	for (let value = 0; value < 256; value += 1) {
		sumAll += value * histogram[value];
	}
	let best = 0;
	let threshold = 128;
	let countBelow = 0;
	let sumBelow = 0;
	for (let value = 0; value < 256; value += 1) {
		countBelow += histogram[value];
		sumBelow += value * histogram[value];
		const countAbove = total - countBelow;
		if (countBelow === 0 || countAbove === 0) {
			continue;
		}
		const meanBelow = sumBelow / countBelow;
		const meanAbove = (sumAll - sumBelow) / countAbove;
		const between = countBelow * countAbove * (meanBelow - meanAbove) ** 2;
		if (between > best) {
			best = between;
			threshold = value;
		}
	}
	const ink = new Uint8Array(gray.length);
	for (let i = 0; i < gray.length; i += 1) {
		ink[i] = gray[i] <= threshold ? 1 : 0;
	}
	return ink;
}

/**
 * Clears straight ink runs longer than the limits: grid and cage lines. A
 * run is measured over a band 5 pixels wide, so a line the warp left a
 * little slanted still counts as one run. Returns the pixels it cleared.
 */
function wipeLongRuns(
	region: Uint8Array,
	width: number,
	height: number,
	maxRow: number,
	maxColumn: number,
) {
	const wipe = new Uint8Array(region.length);
	const band = 2;
	const inkNear = (x: number, y: number, alongRow: boolean) => {
		for (let d = -band; d <= band; d += 1) {
			const xx = alongRow ? x : x + d;
			const yy = alongRow ? y + d : y;
			if (
				xx >= 0 &&
				yy >= 0 &&
				xx < width &&
				yy < height &&
				region[yy * width + xx]
			) {
				return true;
			}
		}
		return false;
	};
	for (let y = 0; y < height; y += 1) {
		let start = 0;
		for (let x = 0; x <= width; x += 1) {
			if (x < width && inkNear(x, y, true)) {
				continue;
			}
			if (x - start > maxRow) {
				for (let k = start; k < x; k += 1) {
					wipe[y * width + k] = 1;
				}
			}
			start = x + 1;
		}
	}
	for (let x = 0; x < width; x += 1) {
		let start = 0;
		for (let y = 0; y <= height; y += 1) {
			if (y < height && inkNear(x, y, false)) {
				continue;
			}
			if (y - start > maxColumn) {
				for (let k = start; k < y; k += 1) {
					wipe[k * width + x] = 1;
				}
			}
			start = y + 1;
		}
	}
	const wiped = new Uint8Array(region.length);
	for (let i = 0; i < region.length; i += 1) {
		if (wipe[i] && region[i]) {
			region[i] = 0;
			wiped[i] = 1;
		}
	}
	return wiped;
}

/**
 * A sum's digit often touches the cage's dashes beside it, which makes one
 * wide piece. Dash columns hold little ink top to bottom; digit columns span
 * much of the piece's height. This keeps the first run of digit columns.
 */
function trimThinTail(
	piece: InkComponent,
	width: number,
	maxGap: number,
): InkComponent {
	const pieceHeight = piece.bottom - piece.top + 1;
	const columnTop = new Map<number, number>();
	const columnBottom = new Map<number, number>();
	for (const index of piece.pixels) {
		const x = index % width;
		const y = Math.floor(index / width);
		columnTop.set(x, Math.min(columnTop.get(x) ?? y, y));
		columnBottom.set(x, Math.max(columnBottom.get(x) ?? y, y));
	}
	let first = -1;
	let last = -1;
	for (let x = piece.left; x <= piece.right; x += 1) {
		const extent = (columnBottom.get(x) ?? -1) - (columnTop.get(x) ?? 0) + 1;
		if (extent < pieceHeight * 0.4) {
			continue;
		}
		if (first === -1) {
			first = x;
		} else if (x - last > maxGap) {
			break;
		}
		last = x;
	}
	if (first === -1) {
		return piece;
	}
	const trimmed: InkComponent = {
		left: first,
		right: last,
		top: piece.bottom,
		bottom: piece.top,
		pixels: [],
	};
	for (const index of piece.pixels) {
		const x = index % width;
		if (x < first || x > last) {
			continue;
		}
		const y = Math.floor(index / width);
		trimmed.pixels.push(index);
		trimmed.top = Math.min(trimmed.top, y);
		trimmed.bottom = Math.max(trimmed.bottom, y);
	}
	return trimmed;
}

/** Groups of touching ink pixels (8-connected). */
function inkComponents(region: Uint8Array, width: number, height: number) {
	const seen = new Uint8Array(region.length);
	const pieces: InkComponent[] = [];
	for (let start = 0; start < region.length; start += 1) {
		if (!region[start] || seen[start]) {
			continue;
		}
		const piece: InkComponent = {
			left: width,
			right: 0,
			top: height,
			bottom: 0,
			pixels: [],
		};
		const stack = [start];
		seen[start] = 1;
		while (stack.length > 0) {
			const index = stack.pop() as number;
			const x = index % width;
			const y = Math.floor(index / width);
			piece.pixels.push(index);
			piece.left = Math.min(piece.left, x);
			piece.right = Math.max(piece.right, x);
			piece.top = Math.min(piece.top, y);
			piece.bottom = Math.max(piece.bottom, y);
			for (let dy = -1; dy <= 1; dy += 1) {
				for (let dx = -1; dx <= 1; dx += 1) {
					const xx = x + dx;
					const yy = y + dy;
					if (xx < 0 || yy < 0 || xx >= width || yy >= height) {
						continue;
					}
					const next = yy * width + xx;
					if (region[next] && !seen[next]) {
						seen[next] = 1;
						stack.push(next);
					}
				}
			}
		}
		pieces.push(piece);
	}
	return pieces;
}
