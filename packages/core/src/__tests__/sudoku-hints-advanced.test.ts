import { describe, expect, it } from "vitest";
import { sudoku as en } from "../i18n/en/games/sudoku";
import { sudoku as nl } from "../i18n/nl/games/sudoku";
import {
	computeCandidates,
	digitMask,
	digitsInMask,
	emptyGrid,
	FULL_MASK,
	parseGrid,
} from "../sudoku";
import {
	describeHint,
	findHint,
	type HintHistory,
	type HintOptions,
	hintHighlights,
	rememberHint,
	SUDOKU_TECHNIQUES,
	type SudokuHint,
} from "../sudoku-hints";

/**
 * Board states from generated Expert puzzles, each the first point where the
 * solver needed that technique. `candidates` lists each open cell's
 * candidates once earlier hints' eliminations are applied ("." = filled).
 */
const STATES = {
	skyscraper: {
		givens:
			"000000109060000000070200860000050900090607040621000000039006070000000031705000000",
		grid: "850760129962081057170295860347852916598617040621900785039106578086579031715008690",
		candidates:
			". . 34 . . 34 . . . . . . 34 . . 34 . . . . 34 . . . . . 34 . . . . . . . . . . . . . . . 23 . 23 . . . . 34 34 . . . 24 . . . 24 . . . . 24 . . . . . 24 . . . . . 34 234 . . . 24",
		solution:
			"854763129962481357173295864347852916598617243621934785439126578286579431715348692",
	},
	"two-string-kite": {
		givens:
			"000201470000003006790000000902000000050768090000000305000009001300600000086302000",
		grid: "635291478000073906790006023902135807053768090000924305000009631309607080086302709",
		candidates:
			". . . . . . . . . 248 24 148 458 . . . 15 . . . 148 458 458 . 15 . . . 46 . . . . . 46 . 14 . . . . . 12 . 24 18 167 78 . . . . 16 . 245 247 47 458 458 . . . . . 14 . . 145 . 25 . 24 145 . . . 145 . . 45 .",
		solution:
			"635291478421873956798456123942135867153768294867924315274589631319647582586312749",
	},
	"w-wing": {
		givens:
			"030600090075030000200000700800009030900020008010800009001000004000060175040007000",
		grid: "030670090075930000200001703800009037953726418017803009701000004300060175540007000",
		candidates:
			"14 . 48 . . 2458 258 . 12 146 . . . . 248 268 246 126 . 689 4689 45 458 . . 456 . . 26 246 145 145 . 56 . . . . . . . . . . . 46 . . . 45 . 256 256 . . 268 . 235 589 58 39 268 . . 289 289 24 . 48 . . . . . 268 13 19 . 39 268 26",
		solution:
			"438672591175934826269581743824159637953726418617843259781295364392468175546317982",
	},
	"x-wing": {
		givens:
			"000700000730001009208500000006000030800094001050000400000065700300200084000003000",
		grid: "000700000730001009208500000006050030800094001050070400000065703300217084000003000",
		candidates:
			"56 1469 1459 . 2348 689 123568 12456 2568 . . 45 468 248 . 2568 2456 . . 1469 . . 34 69 136 1467 67 149 1247 . 18 . 28 289 . 278 . 27 237 36 . . 256 2567 . 19 . 123 1368 . 268 . 269 268 14 1248 124 489 . . . 129 . . 69 59 . . . 56 . . 56 12478 1247 489 48 . 12569 12569 256",
		solution:
			"569738142734621859218549376146852937827394561953176428482965713395217684671483295",
	},
	"xy-wing": {
		givens:
			"408300007000000500020050100600109000000806020002003001001000080004000000306008405",
		grid: "458300007163080540729654138637129854915846723842573001001400080084000000306208405",
		candidates:
			". . . . 19 12 269 69 . . . . 79 . 27 . . 29 . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . 69 69 . 25 79 . . 36 57 239 . 269 25 . . 79 36 157 239 17 269 . 79 . . 19 . . 17 .",
		solution:
			"458391267163782549729654138637129854915846723842573691271435986584967312396218475",
	},
	"xyz-wing": {
		givens:
			"020700000007006020000400031001060005008000203600030900950003000000100500000007090",
		grid: "020700650007306020860400731001060075008071263670030910950003107700100500000007390",
		candidates:
			"134 . 349 . 189 89 . . 489 145 14 . . 1589 . 48 . 489 . . 59 . 29 259 . . . 23 39 . 289 . 248 48 . . 45 49 . 59 . . . . . . . 25 28 . 2458 . . 48 . . 246 268 248 . . 48 . . 348 2346 . 2489 289 . 48 26 124 148 246 2568 2458 . . . 26",
		solution:
			"324719658517386429869425731231964875498571263675238914952643187783192546146857392",
	},
	"unique-rectangle": {
		givens:
			"000062001067000500040000030059008000700000069000300480070000010005070240400180000",
		grid: "500462001067830504040700030359648100784000369000397485070004010005970240400180050",
		candidates:
			". 39 38 . . . 78 79 . 129 . . . . 19 . 29 . 1289 . 128 . 15 159 68 . 268 . . . . . . . 27 27 . . . 25 125 15 . . . 126 12 126 . . . . . . 689 . 368 25 25 . 689 . 368 168 13 . . . 36 . . 368 . 239 236 . . 36 679 . 367",
		solution:
			"538462791967831524241759836359648172784215369126397485673524918815976243492183657",
	},
	"bug-plus-one": {
		givens:
			"000200003090005060061009005800000009026000530300000002000500020080700010940006000",
		grid: "578261493093005060061009085854023079726900530319057042137500926685792314942006050",
		candidates:
			". . . . . . . . . 24 . . 48 78 . 127 . 17 24 . . 34 37 . 27 . . . . . 16 . . 16 . . . . . . 14 48 . . 18 . . . 68 . . 68 . . . . . . 48 48 . . . . . . . . . . . . . . . 13 13 . 78 . 78",
		solution:
			"578261493293485761461379285854623179726914538319857642137548926685792314942136857",
	},
	swordfish: {
		givens:
			"800200700000001920500000000030060047005000100090070060000007002062300000007006003",
		grid: "810200750743651928520700000030060047675002109090170065300007602062300070007026003",
		candidates:
			". . 69 . 349 349 . . 46 . . . . . . . . . . . 69 . 489 489 34 13 146 12 . 18 59 . 59 28 . . . . . 48 348 . . 38 . 24 . 48 . . 38 238 . . . 58 14 4589 1489 . . 189 . 149 . . . 1489 4589 458 . 14 149 58 . 4589 . . 458 189 .",
		solution:
			"819234756743651928526798314231569847675842139498173265354917682962385471187426593",
	},
	"naked-quad": {
		givens:
			"100000007560090000020004080004305020000000000650207800000600030000030095800000001",
		grid: "140000007560090042020004080004305020000000004650247810000600038000030095800000001",
		candidates:
			". . 389 58 2568 2368 3569 56 . . . 378 178 . 138 13 . . 379 . 379 157 1567 . 13569 . 369 79 18 . . 18 . 679 . 69 237 1378 1237 189 168 1689 357 57 . . . 39 . . . . . 39 247 179 1257 . 1257 129 247 . . 247 17 1267 1478 . 128 2467 . . . 379 23567 4579 257 29 2467 67 .",
		solution:
			"143826957568793142927514386714385629382961574659247813491652738276138495835479261",
	},
} as const;

/** What each state's hint finds, checked against the solution as well. */
const EXPECTED: Record<
	keyof typeof STATES,
	Pick<SudokuHint, "cells" | "eliminations" | "placements">
> = {
	"naked-quad": {
		cells: [2, 11, 20, 47],
		eliminations: [
			{ cell: 38, digits: [3, 7] },
			{ cell: 56, digits: [7] },
			{ cell: 65, digits: [7] },
			{ cell: 74, digits: [3, 7] },
		],
		placements: [],
	},
	"x-wing": {
		cells: [0, 72, 8, 80],
		eliminations: [
			{ cell: 2, digits: [5] },
			{ cell: 6, digits: [5] },
			{ cell: 7, digits: [5] },
			{ cell: 78, digits: [5] },
			{ cell: 79, digits: [5] },
		],
		placements: [],
	},
	swordfish: {
		cells: [55, 73, 39, 57, 75, 43, 61, 79],
		eliminations: [
			{ cell: 40, digits: [8] },
			{ cell: 58, digits: [8] },
			{ cell: 78, digits: [8] },
		],
		placements: [],
	},
	skyscraper: {
		cells: [12, 75, 15, 69],
		eliminations: [{ cell: 80, digits: [4] }],
		placements: [],
	},
	"two-string-kite": {
		cells: [34, 28, 44, 71],
		eliminations: [{ cell: 64, digits: [4] }],
		placements: [],
	},
	"xy-wing": {
		cells: [66, 70, 76],
		eliminations: [
			{ cell: 68, digits: [1] },
			{ cell: 79, digits: [1] },
		],
		placements: [],
	},
	"xyz-wing": {
		cells: [9, 10, 36],
		eliminations: [{ cell: 0, digits: [4] }],
		placements: [],
	},
	"w-wing": {
		cells: [21, 49, 25, 52],
		eliminations: [
			{ cell: 22, digits: [4] },
			{ cell: 30, digits: [4] },
		],
		placements: [],
	},
	"unique-rectangle": {
		cells: [57, 58, 39, 40],
		eliminations: [{ cell: 40, digits: [2, 5] }],
		placements: [],
	},
	"bug-plus-one": {
		cells: [15],
		eliminations: [],
		placements: [{ cell: 15, digit: 7 }],
	},
};

type State = (typeof STATES)[keyof typeof STATES];

function candidatesOf(state: State) {
	return state.candidates
		.split(" ")
		.map((entry) =>
			entry === "."
				? 0
				: [...entry].reduce(
						(mask, digit) => mask | digitMask(Number(digit)),
						0,
					),
		);
}

/** The state as a game would reach it: the gap from plain candidates is history. */
function historyOf(state: State): HintHistory {
	const grid = parseGrid(state.grid);
	const plain = computeCandidates(grid);
	const reduced = candidatesOf(state);
	const eliminations = plain
		.map((mask, cell) => ({
			cell,
			digits: digitsInMask(mask & ~reduced[cell]),
		}))
		.filter((entry) => entry.digits.length > 0);
	return [{ grid, eliminations }];
}

function hintAt(state: State, options: HintOptions = {}) {
	return findHint(parseGrid(state.grid), {
		givens: parseGrid(state.givens),
		history: historyOf(state),
		...options,
	});
}

const ids = Object.keys(STATES) as (keyof typeof STATES)[];

describe("advanced sudoku hints", () => {
	it.each(ids)("finds %s as the simplest step, soundly", (id) => {
		const state = STATES[id];
		const hint = hintAt(state);
		expect(hint?.technique).toBe(id);
		expect(hint?.level).toBe("advanced");
		expect(hint).toMatchObject(EXPECTED[id]);
		const solution = parseGrid(state.solution);
		for (const { cell, digits } of hint?.eliminations ?? []) {
			expect(digits).not.toContain(solution[cell]);
		}
		for (const { cell, digit } of hint?.placements ?? []) {
			expect(solution[cell]).toBe(digit);
		}
	});

	it.each(ids)("no earlier technique fires in the %s state", (id) => {
		const state = STATES[id];
		const grid = parseGrid(state.grid);
		const candidates = candidatesOf(state);
		const index = SUDOKU_TECHNIQUES.findIndex((detector) => detector.id === id);
		expect(index).toBeGreaterThan(0);
		for (const detector of SUDOKU_TECHNIQUES.slice(0, index)) {
			expect(detector.detect(grid, candidates)?.technique ?? null).toBeNull();
		}
	});

	it("names the base and cover lines of a fish", () => {
		const hint = hintAt(STATES["x-wing"]);
		expect(hint?.baseLines).toEqual([
			{ kind: "column", index: 0 },
			{ kind: "column", index: 8 },
		]);
		expect(hint?.coverLines).toEqual([
			{ kind: "row", index: 0 },
			{ kind: "row", index: 8 },
		]);
		expect(hint && describeHint(hint, 2, en.hints).text).toBe(
			"There is an X-Wing on 5: in columns 1 and 9, it can only go in rows 1 and 9.",
		);
		expect(hint && describeHint(hint, 2, nl.hints).text).toBe(
			"Er is een X-Wing op de 5: in kolommen 1 en 9 kan hij alleen in rijen 1 en 9.",
		);
	});

	it("names the lines a single-digit pattern stands on", () => {
		expect(hintAt(STATES.skyscraper)?.baseLines).toEqual([
			{ kind: "column", index: 3 },
			{ kind: "column", index: 6 },
		]);
		const kite = hintAt(STATES["two-string-kite"]);
		expect(kite && describeHint(kite, 2, en.hints).text).toContain(
			"row 4 and column 9",
		);
	});

	it.each(ids)("describes %s at three levels in each language", (id) => {
		const hint = hintAt(STATES[id]);
		expect(hint).not.toBeNull();
		if (!hint) {
			return;
		}
		for (const copy of [en.hints, nl.hints]) {
			const texts = ([1, 2, 3] as const).map((level) =>
				describeHint(hint, level, copy),
			);
			expect(new Set(texts.map((text) => text.text)).size).toBe(3);
			for (const { title, text } of texts) {
				expect(title).not.toMatch(/\{\w+\}/);
				expect(text).not.toMatch(/\{\w+\}|undefined/);
			}
		}
		expect(describeHint(hint, 3, en.hints).text).toMatch(/R\dC\d/);
		expect(describeHint(hint, 3, nl.hints).text).toMatch(/R\dK\d/);
	});

	it("says when a step relies on candidates earlier hints removed", () => {
		const hint = hintAt(STATES["xy-wing"]);
		expect(hint?.usesEarlierHints).toBe(true);
		expect(hint && describeHint(hint, 3, en.hints).text).toContain(
			en.hints.afterEarlierHints,
		);
		const plain = hintAt(STATES.skyscraper);
		expect(plain?.usesEarlierHints).toBeUndefined();
	});

	it("skips the uniqueness techniques for Killer puzzles", () => {
		for (const id of ["unique-rectangle", "bug-plus-one"] as const) {
			expect(
				hintAt(STATES[id], { cages: [{ sum: 3, cells: [0, 1] }] })?.technique,
			).not.toBe(id);
		}
	});

	it("skips the uniqueness techniques without the givens", () => {
		const state = STATES["unique-rectangle"];
		const hint = findHint(parseGrid(state.grid), { history: historyOf(state) });
		expect(hint?.technique).not.toBe("unique-rectangle");
	});

	it("finds a hidden quad", () => {
		// Row 1: 1-4 fit only in its first four cells, which allow more.
		const grid = emptyGrid();
		const candidates = new Array<number>(81).fill(FULL_MASK);
		const high = FULL_MASK & ~0b1111;
		for (let col = 4; col < 9; col += 1) {
			candidates[col] = high;
		}
		const index = SUDOKU_TECHNIQUES.findIndex(
			(detector) => detector.id === "hidden-quad",
		);
		for (const detector of SUDOKU_TECHNIQUES.slice(0, index)) {
			expect(detector.detect(grid, candidates)).toBeNull();
		}
		const hint = SUDOKU_TECHNIQUES[index].detect(grid, candidates);
		expect(hint?.technique).toBe("hidden-quad");
		expect(hint?.candidateDigits).toEqual([1, 2, 3, 4]);
		expect(hint?.cells).toEqual([0, 1, 2, 3]);
		expect(hint?.eliminations).toEqual(
			[0, 1, 2, 3].map((cell) => ({ cell, digits: [5, 6, 7, 8, 9] })),
		);
		expect(describeHint(hint as SudokuHint, 2, en.hints).title).toBe(
			"Hidden quad",
		);
	});
});

describe("hint history", () => {
	it("moves on instead of repeating an elimination", () => {
		const state = STATES.skyscraper;
		const grid = parseGrid(state.grid);
		const givens = parseGrid(state.givens);
		let history: HintHistory = [];
		const seen: string[] = [];
		for (let step = 0; step < 20; step += 1) {
			const hint = findHint(grid, { givens, history });
			if (!hint || hint.placements.length > 0) {
				break;
			}
			const key = JSON.stringify(hint.eliminations);
			expect(seen).not.toContain(key);
			seen.push(key);
			history = rememberHint(history, grid, hint);
		}
		expect(seen.length).toBeGreaterThan(0);
	});

	it("drops an entry once a digit it relied on is erased", () => {
		const state = STATES.skyscraper;
		const grid = parseGrid(state.grid);
		const history = historyOf(state);
		const changed = [...grid];
		changed[
			changed.findIndex(
				(value, cell) => value !== 0 && parseGrid(state.givens)[cell] === 0,
			)
		] = 0;
		const withHistory = findHint(changed, { history });
		const without = findHint(changed);
		expect(withHistory).toEqual(without);
	});

	it("returns nothing when a cell has no candidates left", () => {
		const grid = emptyGrid();
		for (let col = 1; col < 9; col += 1) {
			grid[col] = col;
		}
		grid[9 * 4] = 9; // column 1 already has the 9 row 1 needs
		expect(findHint(grid)).toBeNull();
	});
});

describe("maximum hint level", () => {
	it("flags a step above the maximum instead of hiding it", () => {
		const hint = hintAt(STATES["x-wing"], { maxLevel: "intermediate" });
		expect(hint?.technique).toBe("x-wing");
		expect(hint?.aboveMaxLevel).toBe(true);
	});

	it("still points out a mistake first", () => {
		const state = STATES["x-wing"];
		const grid = parseGrid(state.grid);
		const solution = parseGrid(state.solution);
		const open = grid.indexOf(0);
		grid[open] = (solution[open] % 9) + 1;
		const hint = findHint(grid, {
			givens: parseGrid(state.givens),
			solution,
			maxLevel: "beginner",
		});
		expect(hint?.technique).toBe("mistake");
		expect(hint?.aboveMaxLevel).toBeUndefined();
	});

	it("leaves a step within the maximum unflagged", () => {
		expect(
			hintAt(STATES["x-wing"], { maxLevel: "advanced" })?.aboveMaxLevel,
		).toBeUndefined();
		const easy = findHint(parseGrid(STATES["x-wing"].solution).fill(0, 0, 1), {
			maxLevel: "beginner",
		});
		expect(easy?.technique).toBe("naked-single");
		expect(easy?.aboveMaxLevel).toBeUndefined();
	});
});

describe("hint highlights", () => {
	it("marks nothing at level 1 and the pattern's lines only at level 3", () => {
		const hint = hintAt(STATES["x-wing"]);
		expect(hintHighlights(hint, 1)).toBeUndefined();
		const two = hintHighlights(hint, 2);
		expect([...(two?.cells ?? [])].sort((a, b) => a - b)).toEqual([
			0, 8, 72, 80,
		]);
		expect(two?.lines.size).toBe(0);
		const three = hintHighlights(hint, 3);
		// Columns 1 and 9 plus rows 1 and 9, minus the marked cells.
		expect((three?.cells.size ?? 0) + (three?.lines.size ?? 0)).toBe(32);
		expect(three?.lines.has(9)).toBe(true);
		expect(three?.lines.has(40)).toBe(false);
	});
});
