/**
 * Tier-4 ("expert") hint techniques: Jellyfish, Simple Coloring, X-Chain,
 * XY-Chain and ALS-XZ. Like the advanced ones, each detector reads the
 * candidate masks it is given and is deterministic: it scans digits, cells
 * and units in a fixed order and reports the first, shortest pattern.
 */
import {
	digitsInMask,
	maskHasDigit,
	maskSize,
	SUDOKU_BOXES,
	SUDOKU_COLS,
	SUDOKU_ROWS,
} from "./sudoku";
import type { SudokuHint, TechniqueDetector } from "./sudoku-hints";
import {
	combinations,
	eliminateSeenByAll,
	findFish,
	openCells,
	sees,
	spotsOf,
} from "./sudoku-hints-advanced";

/** The longest chain the chain detectors follow, in cells. */
const MAX_CHAIN = 14;
/** The largest almost locked set ALS-XZ looks at, in cells. */
const MAX_ALS = 4;

const UNIT_CELLS: readonly (readonly number[])[] = [
	...SUDOKU_ROWS,
	...SUDOKU_COLS,
	...SUDOKU_BOXES,
];

function expertHint(
	technique: SudokuHint["technique"],
	fields: Partial<SudokuHint> & Pick<SudokuHint, "cells" | "candidateDigits">,
): SudokuHint {
	return {
		technique,
		level: "expert",
		eliminations: [],
		placements: [],
		...fields,
	};
}

/** Every other cell a cell shares a strong link on `digit` with. */
function strongLinks(candidates: number[], digit: number) {
	const links = new Map<number, number[]>();
	const link = (from: number, to: number) => {
		const ends = links.get(from) ?? [];
		if (!ends.includes(to)) {
			ends.push(to);
		}
		links.set(from, ends);
	};
	for (const cells of UNIT_CELLS) {
		const spots = spotsOf(cells, candidates, digit);
		if (spots.length === 2) {
			link(spots[0], spots[1]);
			link(spots[1], spots[0]);
		}
	}
	for (const ends of links.values()) {
		ends.sort((a, b) => a - b);
	}
	return links;
}

/** Alternating tones for a chain's cells, first cell first. */
function alternate(cells: number[]): [number[], number[]] {
	return [
		cells.filter((_, index) => index % 2 === 0),
		cells.filter((_, index) => index % 2 === 1),
	];
}

// --- Simple Coloring ---

function findSimpleColoring(candidates: number[]): SudokuHint | null {
	for (let digit = 1; digit <= 9; digit += 1) {
		const links = strongLinks(candidates, digit);
		const coloured = new Set<number>();
		for (const start of [...links.keys()].sort((a, b) => a - b)) {
			if (coloured.has(start)) {
				continue;
			}
			// Strong links force the digit to alternate, so the cluster splits
			// into two colours: exactly one of them holds the digit.
			const tone = new Map<number, number>([[start, 0]]);
			const queue = [start];
			coloured.add(start);
			while (queue.length > 0) {
				const cell = queue.shift() as number;
				for (const next of links.get(cell) ?? []) {
					if (!tone.has(next)) {
						tone.set(next, 1 - (tone.get(cell) as number));
						coloured.add(next);
						queue.push(next);
					}
				}
			}
			if (tone.size < 4) {
				continue;
			}
			const cluster = [...tone.keys()].sort((a, b) => a - b);
			const groups: [number[], number[]] = [
				cluster.filter((cell) => tone.get(cell) === 0),
				cluster.filter((cell) => tone.get(cell) === 1),
			];
			// Colour wrap: two cells of one colour see each other, so that colour
			// is the wrong one.
			for (const wrong of [0, 1]) {
				const clash = combinations(groups[wrong], 2).find(([a, b]) =>
					sees(a, b),
				);
				if (clash) {
					const rest = cluster.filter((cell) => !clash.includes(cell));
					return expertHint("simple-coloring", {
						cells: [...clash, ...rest],
						candidateDigits: [digit],
						eliminations: groups[wrong].map((cell) => ({
							cell,
							digits: [digit],
						})),
						colors: [groups[wrong], groups[1 - wrong]],
						coloring: "wrap",
					});
				}
			}
			// Colour trap: a cell outside the cluster that sees both colours.
			const eliminations: SudokuHint["eliminations"] = [];
			for (let cell = 0; cell < 81; cell += 1) {
				if (
					!tone.has(cell) &&
					maskHasDigit(candidates[cell], digit) &&
					groups[0].some((other) => sees(cell, other)) &&
					groups[1].some((other) => sees(cell, other))
				) {
					eliminations.push({ cell, digits: [digit] });
				}
			}
			if (eliminations.length > 0) {
				return expertHint("simple-coloring", {
					cells: cluster,
					candidateDigits: [digit],
					eliminations,
					colors: groups,
					coloring: "trap",
				});
			}
		}
	}
	return null;
}

// --- X-Chain ---

/**
 * A chain on one digit that starts and ends with a strong link and
 * alternates with weak links (two cells that see each other). Whichever end
 * is not the digit, the chain forces the other one to be it.
 */
function findXChain(candidates: number[]): SudokuHint | null {
	for (let digit = 1; digit <= 9; digit += 1) {
		const links = strongLinks(candidates, digit);
		const spots = openCells(candidates).filter((cell) =>
			maskHasDigit(candidates[cell], digit),
		);
		for (const start of [...links.keys()].sort((a, b) => a - b)) {
			// Breadth first, so the shortest chain wins. A path is a list of
			// cells; even-length paths end on a strong link.
			let frontier: number[][] = [[start]];
			while (frontier.length > 0) {
				const next: number[][] = [];
				for (const path of frontier) {
					if (path.length >= MAX_CHAIN) {
						continue;
					}
					const cell = path[path.length - 1];
					const strongNext = path.length % 2 === 1;
					const neighbours = strongNext
						? (links.get(cell) ?? [])
						: spots.filter((other) => other !== cell && sees(other, cell));
					for (const neighbour of neighbours) {
						if (path.includes(neighbour)) {
							continue;
						}
						const chain = [...path, neighbour];
						if (strongNext && chain.length >= 4) {
							const eliminations = eliminateSeenByAll(candidates, digit, [
								start,
								neighbour,
							]).filter((entry) => !chain.includes(entry.cell));
							if (eliminations.length > 0) {
								return expertHint("x-chain", {
									cells: chain,
									candidateDigits: [digit],
									eliminations,
									colors: alternate(chain),
								});
							}
						}
						next.push(chain);
					}
				}
				frontier = dedupe(next);
			}
		}
	}
	return null;
}

/**
 * Keeps one path per (last cell, length parity): a longer path to the same
 * place adds nothing a breadth-first search has not already tried.
 */
function dedupe(paths: number[][]) {
	const kept = new Map<string, number[]>();
	for (const path of paths) {
		const key = `${path[path.length - 1]}:${path.length % 2}`;
		if (!kept.has(key)) {
			kept.set(key, path);
		}
	}
	return [...kept.values()];
}

// --- XY-Chain ---

/**
 * A chain of two-candidate cells, each seeing the next and sharing a digit
 * with it, whose two ends both allow `z`. If the first cell is not `z`, each
 * next cell is pushed to its other digit until the last one is `z`.
 */
function findXYChain(candidates: number[]): SudokuHint | null {
	const bivalue = openCells(candidates, 2);
	const other = (cell: number, digit: number) =>
		digitsInMask(candidates[cell]).find((value) => value !== digit) as number;
	for (const start of bivalue) {
		for (const z of digitsInMask(candidates[start])) {
			type Step = { cells: number[]; out: number };
			let frontier: Step[] = [{ cells: [start], out: other(start, z) }];
			const visited = new Set<string>([`${start}:${other(start, z)}`]);
			while (frontier.length > 0) {
				const next: Step[] = [];
				for (const { cells, out } of frontier) {
					if (cells.length >= MAX_CHAIN) {
						continue;
					}
					const cell = cells[cells.length - 1];
					for (const neighbour of bivalue) {
						if (
							cells.includes(neighbour) ||
							!sees(neighbour, cell) ||
							!maskHasDigit(candidates[neighbour], out)
						) {
							continue;
						}
						const nextOut = other(neighbour, out);
						const chain = [...cells, neighbour];
						if (nextOut === z && chain.length >= 3) {
							const eliminations = eliminateSeenByAll(candidates, z, [
								start,
								neighbour,
							]).filter((entry) => !chain.includes(entry.cell));
							if (eliminations.length > 0) {
								return expertHint("xy-chain", {
									cells: chain,
									candidateDigits: [z],
									eliminations,
									colors: alternate(chain),
								});
							}
						}
						const key = `${neighbour}:${nextOut}`;
						if (!visited.has(key)) {
							visited.add(key);
							next.push({ cells: chain, out: nextOut });
						}
					}
				}
				frontier = next;
			}
		}
	}
	return null;
}

// --- ALS-XZ ---

/**
 * Cell sets as three 27-bit words (rows 0-2, 3-5, 6-8), so ALS-XZ can test
 * overlap and sight with a few bitwise ANDs: it compares many set pairs.
 */
type CellBits = [number, number, number];

const NO_CELLS: CellBits = [0, 0, 0];
const ALL_CELLS: CellBits = [0x7ffffff, 0x7ffffff, 0x7ffffff];

function bitsOf(cells: readonly number[]): CellBits {
	const bits: CellBits = [0, 0, 0];
	for (const cell of cells) {
		bits[Math.floor(cell / 27)] |= 1 << (cell % 27);
	}
	return bits;
}

function and(a: CellBits, b: CellBits): CellBits {
	return [a[0] & b[0], a[1] & b[1], a[2] & b[2]];
}

function isEmpty(bits: CellBits) {
	return bits[0] === 0 && bits[1] === 0 && bits[2] === 0;
}

function cellsOf(bits: CellBits) {
	const cells: number[] = [];
	for (let cell = 0; cell < 81; cell += 1) {
		if (bits[Math.floor(cell / 27)] & (1 << (cell % 27))) {
			cells.push(cell);
		}
	}
	return cells;
}

const PEER_BITS: readonly CellBits[] = Array.from({ length: 81 }, (_, cell) =>
	bitsOf(
		Array.from({ length: 81 }, (_, other) => other).filter(
			(other) => other !== cell && sees(cell, other),
		),
	),
);

type AlmostLockedSet = {
	cells: number[];
	mask: number;
	bits: CellBits;
	/** Per digit: the set's cells that allow it. */
	holders: CellBits[];
	/** Per digit: the cells that see every one of those holders. */
	seenBy: CellBits[];
};

function almostLockedSet(cells: number[], mask: number, candidates: number[]) {
	const holders: CellBits[] = [];
	const seenBy: CellBits[] = [];
	for (let digit = 1; digit <= 9; digit += 1) {
		const holding = cells.filter((cell) =>
			maskHasDigit(candidates[cell], digit),
		);
		holders[digit] = bitsOf(holding);
		seenBy[digit] = holding.reduce(
			(seen, cell) => and(seen, PEER_BITS[cell]),
			ALL_CELLS,
		);
	}
	return { cells, mask, bits: bitsOf(cells), holders, seenBy };
}

/** Groups of N cells in one unit that together allow N + 1 digits. */
function almostLockedSets(candidates: number[]) {
	const found = new Map<string, AlmostLockedSet>();
	for (const unit of UNIT_CELLS) {
		const open = unit.filter((cell) => candidates[cell] !== 0);
		for (let size = 1; size <= Math.min(MAX_ALS, open.length - 1); size += 1) {
			for (const cells of combinations(open, size)) {
				const mask = cells.reduce((all, cell) => all | candidates[cell], 0);
				if (maskSize(mask) !== size + 1) {
					continue;
				}
				const sorted = [...cells].sort((a, b) => a - b);
				const key = sorted.join(",");
				if (!found.has(key)) {
					found.set(key, almostLockedSet(sorted, mask, candidates));
				}
			}
		}
	}
	// Smaller sets first: they make the shorter explanation.
	return [...found.values()].sort(
		(a, b) => a.cells.length - b.cells.length || a.cells[0] - b.cells[0],
	);
}

/** Cells that allow `digit`, as bits. */
function digitBits(candidates: number[], digit: number) {
	return bitsOf(
		openCells(candidates).filter((cell) =>
			maskHasDigit(candidates[cell], digit),
		),
	);
}

function findAlsXz(candidates: number[]): SudokuHint | null {
	const sets = almostLockedSets(candidates);
	const allowing: CellBits[] = [NO_CELLS];
	for (let digit = 1; digit <= 9; digit += 1) {
		allowing[digit] = digitBits(candidates, digit);
	}
	for (let i = 0; i < sets.length; i += 1) {
		const a = sets[i];
		for (let j = i + 1; j < sets.length; j += 1) {
			const b = sets[j];
			const common = a.mask & b.mask;
			if (maskSize(common) < 2 || !isEmpty(and(a.bits, b.bits))) {
				continue;
			}
			const digits = digitsInMask(common);
			for (const x of digits) {
				// X is restricted: every X in one set sees every X in the other,
				// so at most one set holds it, and the other is then locked.
				const bx = b.holders[x];
				const seen = and(a.seenBy[x], bx);
				if (seen[0] !== bx[0] || seen[1] !== bx[1] || seen[2] !== bx[2]) {
					continue;
				}
				for (const z of digits) {
					if (z === x) {
						continue;
					}
					// Cells outside both sets (a cell cannot see itself) that see
					// every Z in both.
					const targets = and(and(a.seenBy[z], b.seenBy[z]), allowing[z]);
					if (isEmpty(targets)) {
						continue;
					}
					return expertHint("als-xz", {
						cells: [...a.cells, ...b.cells],
						candidateDigits: [x, z],
						eliminations: cellsOf(targets).map((cell) => ({
							cell,
							digits: [z],
						})),
						colors: [a.cells, b.cells],
					});
				}
			}
		}
	}
	return null;
}

export const EXPERT_TECHNIQUES: readonly TechniqueDetector[] = [
	{ id: "jellyfish", level: "expert", detect: (_, c) => findFish(c, 4) },
	{
		id: "simple-coloring",
		level: "expert",
		detect: (_, c) => findSimpleColoring(c),
	},
	{ id: "x-chain", level: "expert", detect: (_, c) => findXChain(c) },
	{ id: "xy-chain", level: "expert", detect: (_, c) => findXYChain(c) },
	{ id: "als-xz", level: "expert", detect: (_, c) => findAlsXz(c) },
];
