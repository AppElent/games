import { describe, expect, it } from "vitest";
import { mulberry32 } from "../random";
import { generateSolvedGrid } from "../sudoku";
import { generateKillerCages, type KillerCage } from "../sudoku-killer";
import {
	type CageRead,
	cageSumBox,
	cageSumInk,
	cagesFromBorders,
	checkKillerScan,
	edgeBetween,
	innerEdges,
	isKillerRead,
	KILLER_TOTAL,
	killerScanCages,
	killerScanFromRead,
	parseCageSum,
	readCages,
	setKillerSum,
	sumGray,
	toggleKillerBorder,
	validateScannedCages,
} from "../sudoku-scan-cages";
import {
	BLUE_PRINT,
	CELL,
	paintGlyph,
	renderKiller,
	SIZE,
} from "../testing/drawn-killer";

function layout(seed: number) {
	const rng = mulberry32(seed);
	const cages = generateKillerCages(generateSolvedGrid(rng), rng);
	return {
		cages,
		cells: cages
			.map((cage) => [...cage.cells].sort((a, b) => a - b))
			.sort((a, b) => a[0] - b[0]),
	};
}

describe("readCages", () => {
	it("reads every cage of a printed Killer", () => {
		for (const seed of [3, 11, 29]) {
			const { cells } = layout(seed);
			const read = readCages(
				renderKiller(cells, { rng: mulberry32(seed) }),
				SIZE,
			);
			expect(read.cages).toEqual(cells);
			expect(read.doubtful).toEqual([]);
		}
	});

	it("ignores blue handwriting over a black print", () => {
		const { cells } = layout(5);
		const rgba = renderKiller(cells, { rng: mulberry32(5), penStrokes: 60 });
		expect(readCages(rgba, SIZE).cages).toEqual(cells);
	});

	it("keeps the dashes of a Killer printed in blue", () => {
		const { cells } = layout(8);
		const rgba = renderKiller(cells, {
			rng: mulberry32(8),
			dashColor: BLUE_PRINT,
		});
		expect(readCages(rgba, SIZE).cages).toEqual(cells);
	});

	it("finds the grid inside a coloured panel the corners sat on", () => {
		const { cells } = layout(13);
		const grid = renderKiller(cells, { rng: mulberry32(13) });
		// The book prints its grid on a blue panel: 18 px of it on each side.
		const margin = 18;
		const inner = SIZE - margin * 2;
		const framed = new Uint8ClampedArray(SIZE * SIZE * 4);
		for (let y = 0; y < SIZE; y += 1) {
			for (let x = 0; x < SIZE; x += 1) {
				const i = (y * SIZE + x) * 4;
				const gx = Math.round(((x - margin) * (SIZE - 1)) / (inner - 1));
				const gy = Math.round(((y - margin) * (SIZE - 1)) / (inner - 1));
				if (gx < 0 || gy < 0 || gx >= SIZE || gy >= SIZE) {
					framed.set([110, 160, 200, 255], i);
				} else {
					framed.set(
						grid.subarray((gy * SIZE + gx) * 4, (gy * SIZE + gx) * 4 + 4),
						i,
					);
				}
			}
		}
		const read = readCages(framed, SIZE);
		expect(read.cages).toEqual(cells);
		expect(read.bounds.left).toBeGreaterThanOrEqual(margin - 3);
		expect(read.bounds.left).toBeLessThanOrEqual(margin + 3);
	});
});

describe("cagesFromBorders", () => {
	it("keeps every cell alone when every edge is a border", () => {
		expect(cagesFromBorders(() => true)).toHaveLength(81);
	});

	it("joins the whole grid when no edge is a border", () => {
		expect(cagesFromBorders(() => false)).toEqual([
			Array.from({ length: 81 }, (_, i) => i),
		]);
	});
});

describe("cageSumBox", () => {
	it("points at the top-left corner of the cage's first cell", () => {
		const box = cageSumBox([40, 31, 32], {
			left: 0,
			top: 0,
			right: SIZE - 1,
			bottom: SIZE - 1,
		});
		expect(box.x).toBeGreaterThanOrEqual(4 * CELL);
		expect(box.x + box.width).toBeLessThan(4.5 * CELL);
		expect(box.y).toBeGreaterThanOrEqual(3 * CELL);
		expect(box.y + box.height).toBeLessThan(3.5 * CELL);
	});
});

describe("validateScannedCages", () => {
	it("accepts a generated Killer", () => {
		expect(validateScannedCages(layout(3).cages)).toBeNull();
	});

	it("reports a total other than 405", () => {
		const cages: KillerCage[] = layout(3).cages.map((cage, index) =>
			index === 0 ? { ...cage, sum: cage.sum + 1 } : cage,
		);
		expect(validateScannedCages(cages)).toEqual({
			kind: "total",
			total: KILLER_TOTAL + 1,
		});
	});

	it("reports a sum its cage cannot have", () => {
		const cages: KillerCage[] = layout(3).cages.map((cage, index) =>
			index === 0 ? { ...cage, sum: 1 } : cage,
		);
		expect(validateScannedCages(cages)).toEqual({ kind: "invalidCages" });
	});

	it("reports a puzzle with more than one solution", () => {
		const rows: KillerCage[] = Array.from({ length: 9 }, (_, row) => ({
			sum: 45,
			cells: Array.from({ length: 9 }, (_, col) => row * 9 + col),
		}));
		expect(validateScannedCages(rows)).toEqual({
			kind: "notUnique",
			solutions: 2,
		});
	});
});

/** A read of `cages` exactly, as `readCages` would return it. */
function readOf(cages: number[][]): CageRead {
	const cageOf = new Map<number, number>();
	cages.forEach((cells, index) => {
		for (const cell of cells) {
			cageOf.set(cell, index);
		}
	});
	return {
		cages,
		borders: innerEdges().filter(
			(edge) =>
				cageOf.get(edge.cell) !==
				cageOf.get(edge.side === "right" ? edge.cell + 1 : edge.cell + 9),
		),
		doubtful: [],
		bounds: { left: 0, top: 0, right: SIZE - 1, bottom: SIZE - 1 },
	};
}

describe("killer scan corrections", () => {
	const { cages, cells } = layout(3);
	const sumOf = (cage: number[]) =>
		cages.find((entry) => Math.min(...entry.cells) === cage[0])?.sum ?? 0;

	it("plays a read with every sum right", () => {
		const scan = killerScanFromRead(readOf(cells), cells.map(sumOf));
		expect(killerScanCages(scan).map((cage) => cage.cells)).toEqual(cells);
		expect(checkKillerScan(scan, { checkUnique: false })).toBeNull();
	});

	it("asks for the sums it could not read", () => {
		const sums = cells.map((cage, index) => (index < 2 ? null : sumOf(cage)));
		const scan = killerScanFromRead(readOf(cells), sums);
		expect(checkKillerScan(scan)).toEqual({ kind: "missingSums", count: 2 });
		const fixed = setKillerSum(
			setKillerSum(scan, cells[0][0], sumOf(cells[0])),
			cells[1].at(-1) ?? 0,
			sumOf(cells[1]),
		);
		expect(checkKillerScan(fixed, { checkUnique: false })).toBeNull();
	});

	it("joins a cage the read split, keeping its first cell's sum", () => {
		const pair = cells.find((cage) => cage.length === 2) ?? [];
		const split = [
			...cells.filter((cage) => cage !== pair),
			[pair[0]],
			[pair[1]],
		].sort((a, b) => a[0] - b[0]);
		const sums = split.map((cage) =>
			cage.length === 1 && cage[0] === pair[1]
				? null
				: sumOf(cage[0] === pair[0] ? pair : cage),
		);
		const scan = killerScanFromRead(readOf(split), sums);
		expect(checkKillerScan(scan)).toEqual({ kind: "missingSums", count: 1 });

		const edge = edgeBetween(pair[0], pair[1]);
		if (!edge) {
			throw new Error("a two-cell cage has neighbouring cells");
		}
		const joined = toggleKillerBorder(scan, edge);
		expect(killerScanCages(joined).map((cage) => cage.cells)).toEqual(cells);
		expect(checkKillerScan(joined, { checkUnique: false })).toBeNull();
	});

	it("tells a Killer from a classic grid", () => {
		expect(isKillerRead(readOf(cells))).toBe(true);
		expect(
			isKillerRead(readOf([Array.from({ length: 81 }, (_, i) => i)])),
		).toBe(false);
	});

	it("only knows edges between neighbours", () => {
		expect(edgeBetween(8, 9)).toBeNull();
		expect(edgeBetween(10, 1)).toEqual({ cell: 1, side: "bottom" });
		expect(edgeBetween(4, 3)).toEqual({ cell: 3, side: "right" });
	});
});

describe("cageSumInk", () => {
	const { cells } = layout(3);
	const bounds = { left: 0, right: SIZE - 1, top: 0, bottom: SIZE - 1 };

	it("cuts a two-digit sum out of the lines and dashes around it", () => {
		const rgba = renderKiller(cells, { rng: mulberry32(1) });
		const cage = cells[10];
		const cornerX = (cage[0] % 9) * CELL;
		const cornerY = Math.floor(cage[0] / 9) * CELL;
		paintGlyph(rgba, cornerX + 11, cornerY + 11);
		paintGlyph(rgba, cornerX + 26, cornerY + 11);

		const sum = cageSumInk(rgba, SIZE, cage, bounds, { ignoreBlue: true });
		if (!sum) {
			throw new Error("expected a sum");
		}
		expect(sum.digits).toHaveLength(2);
		expect(Math.abs(sum.box.x - (cornerX + 11))).toBeLessThanOrEqual(3);
		expect(Math.abs(sum.box.y - (cornerY + 11))).toBeLessThanOrEqual(3);
		expect(sum.box.width).toBeLessThanOrEqual(27 + 6);
		const gray = sumGray(rgba, SIZE, sum);
		// The ring's stroke is ink; its hole is paper.
		const at = (x: number, y: number) =>
			gray[(y - sum.box.y) * sum.box.width + (x - sum.box.x)];
		expect(at(cornerX + 12, cornerY + 20)).toBeLessThan(80);
		expect(at(cornerX + 17, cornerY + 20)).toBe(255);
	});

	it("reads one digit as one", () => {
		const rgba = renderKiller(cells, { rng: mulberry32(2) });
		const cage = cells[4];
		paintGlyph(
			rgba,
			(cage[0] % 9) * CELL + 11,
			Math.floor(cage[0] / 9) * CELL + 11,
		);
		expect(
			cageSumInk(rgba, SIZE, cage, bounds, { ignoreBlue: true })?.digits,
		).toHaveLength(1);
	});

	it("finds nothing where no sum is printed", () => {
		const rgba = renderKiller(cells, { rng: mulberry32(4) });
		expect(
			cageSumInk(rgba, SIZE, cells[6], bounds, { ignoreBlue: true }),
		).toBeNull();
	});
});

describe("parseCageSum", () => {
	it("takes a whole sum from 1 to 45", () => {
		expect(parseCageSum("7")).toBe(7);
		expect(parseCageSum(" 45 ")).toBe(45);
	});

	it("refuses what no cage can add up to", () => {
		expect(parseCageSum("")).toBeNull();
		expect(parseCageSum("0")).toBeNull();
		expect(parseCageSum("46")).toBeNull();
		expect(parseCageSum("123")).toBeNull();
		expect(parseCageSum("1a")).toBeNull();
	});
});

describe("toggleKillerBorder and sums", () => {
	it("asks again for a sum after a join is split", () => {
		const rows = Array.from({ length: 9 }, (_, row) =>
			Array.from({ length: 9 }, (_, col) => row * 9 + col),
		);
		const scan = killerScanFromRead(
			readOf(rows),
			rows.map(() => 45),
		);
		const edge = { cell: 0, side: "bottom" as const };
		const joined = toggleKillerBorder(scan, edge);
		expect(joined.sums[9]).toBeUndefined();
		const split = toggleKillerBorder(joined, edge);
		expect(checkKillerScan(split)).toEqual({ kind: "missingSums", count: 1 });
	});
});
