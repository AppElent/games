/**
 * Tier-3 ("advanced") hint techniques: quads, fish, single-digit patterns,
 * wings and the uniqueness patterns. Each detector reads the candidate masks
 * it is given, so eliminations from earlier hints carry over.
 */
import {
	boxOf,
	colOf,
	digitMask,
	digitsInMask,
	maskHasDigit,
	maskSize,
	rowOf,
	SUDOKU_BOXES,
	SUDOKU_COLS,
	SUDOKU_PEERS,
	SUDOKU_ROWS,
} from "./sudoku";
import type { HintUnit, SudokuHint, TechniqueDetector } from "./sudoku-hints";

type Elimination = { cell: number; digits: number[] };
type LineKind = "row" | "column";

const PEER_SETS: readonly ReadonlySet<number>[] = SUDOKU_PEERS.map(
	(peers) => new Set(peers),
);

export function sees(a: number, b: number) {
	return PEER_SETS[a].has(b);
}

export function combinations<T>(items: readonly T[], size: number): T[][] {
	if (size === 0) {
		return [[]];
	}
	const result: T[][] = [];
	items.forEach((item, index) => {
		for (const rest of combinations(items.slice(index + 1), size - 1)) {
			result.push([item, ...rest]);
		}
	});
	return result;
}

function lineCells(kind: LineKind, index: number) {
	return kind === "row" ? SUDOKU_ROWS[index] : SUDOKU_COLS[index];
}

function lineIndexOf(kind: LineKind, cell: number) {
	return kind === "row" ? rowOf(cell) : colOf(cell);
}

/** The other line direction, for the cover lines of a fish. */
function crossIndexOf(kind: LineKind, cell: number) {
	return kind === "row" ? colOf(cell) : rowOf(cell);
}

function cross(kind: LineKind): LineKind {
	return kind === "row" ? "column" : "row";
}

function spotsOf(
	cells: readonly number[],
	candidates: number[],
	digit: number,
) {
	return cells.filter((cell) => maskHasDigit(candidates[cell], digit));
}

/** Removes `digit` from every candidate cell that sees all of `targets`. */
function eliminateSeenByAll(
	candidates: number[],
	digit: number,
	targets: readonly number[],
): Elimination[] {
	const eliminations: Elimination[] = [];
	for (let cell = 0; cell < 81; cell += 1) {
		if (
			!maskHasDigit(candidates[cell], digit) ||
			targets.includes(cell) ||
			!targets.every((target) => sees(cell, target))
		) {
			continue;
		}
		eliminations.push({ cell, digits: [digit] });
	}
	return eliminations;
}

function advancedHint(
	technique: SudokuHint["technique"],
	fields: Partial<SudokuHint> & Pick<SudokuHint, "cells" | "candidateDigits">,
): SudokuHint {
	return {
		technique,
		level: "advanced",
		eliminations: [],
		placements: [],
		...fields,
	};
}

// --- Fish: X-Wing (2 lines) and Swordfish (3 lines) ---

function findFish(candidates: number[], size: 2 | 3): SudokuHint | null {
	for (let digit = 1; digit <= 9; digit += 1) {
		for (const kind of ["row", "column"] as const) {
			const bases: { index: number; spots: number[] }[] = [];
			for (let index = 0; index < 9; index += 1) {
				const spots = spotsOf(lineCells(kind, index), candidates, digit);
				if (spots.length >= 2 && spots.length <= size) {
					bases.push({ index, spots });
				}
			}
			for (const combo of combinations(bases, size)) {
				const covers = [
					...new Set(
						combo.flatMap((base) =>
							base.spots.map((cell) => crossIndexOf(kind, cell)),
						),
					),
				].sort((a, b) => a - b);
				if (covers.length !== size) {
					continue;
				}
				const baseIndexes = combo.map((base) => base.index);
				const eliminations = covers
					.flatMap((cover) =>
						spotsOf(lineCells(cross(kind), cover), candidates, digit),
					)
					.filter((cell) => !baseIndexes.includes(lineIndexOf(kind, cell)))
					.map((cell) => ({ cell, digits: [digit] }));
				if (eliminations.length === 0) {
					continue;
				}
				return advancedHint(size === 2 ? "x-wing" : "swordfish", {
					cells: combo.flatMap((base) => base.spots),
					candidateDigits: [digit],
					eliminations,
					baseLines: baseIndexes.map((index) => ({ kind, index })),
					coverLines: covers.map((index) => ({ kind: cross(kind), index })),
				});
			}
		}
	}
	return null;
}

// --- Single-digit patterns: Skyscraper and 2-String Kite ---

/** Lines where `digit` has exactly two candidate cells (a strong link). */
function conjugateLines(candidates: number[], digit: number, kind: LineKind) {
	const links: { unit: HintUnit; ends: [number, number] }[] = [];
	for (let index = 0; index < 9; index += 1) {
		const spots = spotsOf(lineCells(kind, index), candidates, digit);
		if (spots.length === 2) {
			links.push({ unit: { kind, index }, ends: [spots[0], spots[1]] });
		}
	}
	return links;
}

function findSkyscraper(candidates: number[]): SudokuHint | null {
	for (let digit = 1; digit <= 9; digit += 1) {
		for (const kind of ["row", "column"] as const) {
			const links = conjugateLines(candidates, digit, kind);
			for (const [first, second] of combinations(links, 2)) {
				for (const [shared1, free1] of [
					first.ends,
					[...first.ends].reverse(),
				]) {
					for (const [shared2, free2] of [
						second.ends,
						[...second.ends].reverse(),
					]) {
						// The two links stand on one shared cross line; the free ends
						// sit on different cross lines (else it is an X-Wing).
						if (
							crossIndexOf(kind, shared1) !== crossIndexOf(kind, shared2) ||
							crossIndexOf(kind, free1) === crossIndexOf(kind, free2)
						) {
							continue;
						}
						const eliminations = eliminateSeenByAll(candidates, digit, [
							free1,
							free2,
						]);
						if (eliminations.length === 0) {
							continue;
						}
						return advancedHint("skyscraper", {
							cells: [shared1, free1, shared2, free2],
							candidateDigits: [digit],
							eliminations,
							baseLines: [first.unit, second.unit],
						});
					}
				}
			}
		}
	}
	return null;
}

function findTwoStringKite(candidates: number[]): SudokuHint | null {
	for (let digit = 1; digit <= 9; digit += 1) {
		const rows = conjugateLines(candidates, digit, "row");
		const columns = conjugateLines(candidates, digit, "column");
		for (const row of rows) {
			for (const column of columns) {
				for (const [rowNear, rowFar] of [row.ends, [...row.ends].reverse()]) {
					for (const [colNear, colFar] of [
						column.ends,
						[...column.ends].reverse(),
					]) {
						const four = new Set([rowNear, rowFar, colNear, colFar]);
						if (four.size !== 4 || boxOf(rowNear) !== boxOf(colNear)) {
							continue;
						}
						const eliminations = eliminateSeenByAll(candidates, digit, [
							rowFar,
							colFar,
						]);
						if (eliminations.length === 0) {
							continue;
						}
						return advancedHint("two-string-kite", {
							cells: [rowNear, rowFar, colNear, colFar],
							candidateDigits: [digit],
							eliminations,
							baseLines: [row.unit, column.unit],
							box: boxOf(rowNear),
						});
					}
				}
			}
		}
	}
	return null;
}

// --- Wings ---

function openCells(candidates: number[], size?: number) {
	const cells: number[] = [];
	for (let cell = 0; cell < 81; cell += 1) {
		const count = maskSize(candidates[cell]);
		if (count > 0 && (size === undefined || count === size)) {
			cells.push(cell);
		}
	}
	return cells;
}

function findXYWing(candidates: number[]): SudokuHint | null {
	const bivalue = openCells(candidates, 2);
	for (const pivot of bivalue) {
		const [x, y] = digitsInMask(candidates[pivot]);
		const wings = bivalue.filter(
			(cell) =>
				cell !== pivot &&
				sees(cell, pivot) &&
				candidates[cell] !== candidates[pivot] &&
				(candidates[cell] & candidates[pivot]) !== 0,
		);
		for (const [a, b] of combinations(wings, 2)) {
			const aHasX = maskHasDigit(candidates[a], x);
			const bHasX = maskHasDigit(candidates[b], x);
			if (aHasX === bHasX) {
				continue;
			}
			const zMask =
				candidates[a] & candidates[b] & ~(digitMask(x) | digitMask(y));
			if (maskSize(zMask) !== 1) {
				continue;
			}
			const z = digitsInMask(zMask)[0];
			const eliminations = eliminateSeenByAll(candidates, z, [a, b]);
			if (eliminations.length === 0) {
				continue;
			}
			const [xWing, yWing] = aHasX ? [a, b] : [b, a];
			return advancedHint("xy-wing", {
				cells: [pivot, xWing, yWing],
				candidateDigits: [x, y, z],
				eliminations,
			});
		}
	}
	return null;
}

function findXYZWing(candidates: number[]): SudokuHint | null {
	const bivalue = openCells(candidates, 2);
	for (const pivot of openCells(candidates, 3)) {
		const pivotMask = candidates[pivot];
		const wings = bivalue.filter(
			(cell) => sees(cell, pivot) && (candidates[cell] & ~pivotMask) === 0,
		);
		for (const [a, b] of combinations(wings, 2)) {
			if (candidates[a] === candidates[b]) {
				continue;
			}
			const zMask = candidates[a] & candidates[b];
			if (maskSize(zMask) !== 1) {
				continue;
			}
			const z = digitsInMask(zMask)[0];
			const eliminations = eliminateSeenByAll(candidates, z, [pivot, a, b]);
			if (eliminations.length === 0) {
				continue;
			}
			const others = digitsInMask(pivotMask & ~zMask);
			return advancedHint("xyz-wing", {
				cells: [pivot, a, b],
				candidateDigits: [...others, z],
				eliminations,
			});
		}
	}
	return null;
}

function findWWing(candidates: number[]): SudokuHint | null {
	const bivalue = openCells(candidates, 2);
	const links: { digit: number; unit: HintUnit; ends: [number, number] }[] = [];
	for (let digit = 1; digit <= 9; digit += 1) {
		for (const kind of ["row", "column", "box"] as const) {
			for (let index = 0; index < 9; index += 1) {
				const cells =
					kind === "box" ? SUDOKU_BOXES[index] : lineCells(kind, index);
				const spots = spotsOf(cells, candidates, digit);
				if (spots.length === 2) {
					links.push({
						digit,
						unit: { kind, index },
						ends: [spots[0], spots[1]],
					});
				}
			}
		}
	}
	for (const [a, b] of combinations(bivalue, 2)) {
		if (candidates[a] !== candidates[b] || sees(a, b)) {
			continue;
		}
		const pair = digitsInMask(candidates[a]);
		for (const [linkDigit, removeDigit] of [pair, [...pair].reverse()]) {
			for (const link of links) {
				const [c, d] = link.ends;
				if (
					link.digit !== linkDigit ||
					[a, b, d].includes(c) ||
					[a, b].includes(d)
				) {
					continue;
				}
				const ends =
					sees(c, a) && sees(d, b)
						? [c, d]
						: sees(d, a) && sees(c, b)
							? [d, c]
							: null;
				if (!ends) {
					continue;
				}
				const eliminations = eliminateSeenByAll(candidates, removeDigit, [
					a,
					b,
				]);
				if (eliminations.length === 0) {
					continue;
				}
				return advancedHint("w-wing", {
					cells: [a, b, ends[0], ends[1]],
					candidateDigits: [linkDigit, removeDigit],
					eliminations,
					baseLines: [link.unit],
				});
			}
		}
	}
	return null;
}

// --- Uniqueness: Unique Rectangle type 1 and BUG+1 ---

function findUniqueRectangle(candidates: number[]): SudokuHint | null {
	const bivalue = openCells(candidates, 2);
	for (const [a, b] of combinations(bivalue, 2)) {
		if (candidates[a] !== candidates[b] || rowOf(a) !== rowOf(b)) {
			continue;
		}
		const pairMask = candidates[a];
		for (let row = 0; row < 9; row += 1) {
			if (row === rowOf(a)) {
				continue;
			}
			const c = row * 9 + colOf(a);
			const d = row * 9 + colOf(b);
			const corners = [a, b, c, d];
			// A deadly pattern lies in exactly two boxes.
			if (new Set(corners.map(boxOf)).size !== 2) {
				continue;
			}
			if (corners.some((cell) => (candidates[cell] & pairMask) !== pairMask)) {
				continue;
			}
			const extra = [c, d].filter((cell) => candidates[cell] !== pairMask);
			if (extra.length !== 1) {
				continue;
			}
			const target = extra[0];
			return advancedHint("unique-rectangle", {
				cells: [a, b, c === target ? d : c, target],
				candidateDigits: digitsInMask(pairMask),
				eliminations: [{ cell: target, digits: digitsInMask(pairMask) }],
			});
		}
	}
	return null;
}

function allUnitCells() {
	return [...SUDOKU_ROWS, ...SUDOKU_COLS, ...SUDOKU_BOXES];
}

function findBugPlusOne(candidates: number[]): SudokuHint | null {
	const open = openCells(candidates);
	const extra = open.filter((cell) => maskSize(candidates[cell]) !== 2);
	if (extra.length !== 1 || maskSize(candidates[extra[0]]) !== 3) {
		return null;
	}
	const cell = extra[0];
	for (const digit of digitsInMask(candidates[cell])) {
		const reduced = [...candidates];
		reduced[cell] &= ~digitMask(digit);
		// Without `digit` here, every unit would hold each candidate exactly
		// twice: a pattern with either no solution or two.
		const deadly = allUnitCells().every((unit) => {
			for (let other = 1; other <= 9; other += 1) {
				const count = spotsOf(unit, reduced, other).length;
				if (count !== 0 && count !== 2) {
					return false;
				}
			}
			return true;
		});
		if (deadly) {
			return advancedHint("bug-plus-one", {
				cells: [cell],
				candidateDigits: [digit],
				placements: [{ cell, digit }],
				unit: { kind: "row", index: rowOf(cell) },
			});
		}
	}
	return null;
}

export const ADVANCED_TECHNIQUES: readonly TechniqueDetector[] = [
	{ id: "x-wing", level: "advanced", detect: (_, c) => findFish(c, 2) },
	{ id: "swordfish", level: "advanced", detect: (_, c) => findFish(c, 3) },
	{ id: "skyscraper", level: "advanced", detect: (_, c) => findSkyscraper(c) },
	{
		id: "two-string-kite",
		level: "advanced",
		detect: (_, c) => findTwoStringKite(c),
	},
	{ id: "xy-wing", level: "advanced", detect: (_, c) => findXYWing(c) },
	{ id: "xyz-wing", level: "advanced", detect: (_, c) => findXYZWing(c) },
	{ id: "w-wing", level: "advanced", detect: (_, c) => findWWing(c) },
	{
		id: "unique-rectangle",
		level: "advanced",
		needsUniqueness: true,
		detect: (_, c) => findUniqueRectangle(c),
	},
	{
		id: "bug-plus-one",
		level: "advanced",
		needsUniqueness: true,
		detect: (_, c) => findBugPlusOne(c),
	},
];
