import { describe, expect, it } from "vitest";
import { sudoku as en } from "../i18n/en/games/sudoku";
import { sudoku as nl } from "../i18n/nl/games/sudoku";
import { mulberry32 } from "../random";
import {
	computeCandidates,
	digitMask,
	digitsInMask,
	generatePuzzle,
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
 * solver needed that step. `candidates` lists each open cell's candidates
 * once earlier hints' eliminations are applied ("." = filled).
 */
const STATES = {
	"xy-chain": {
		givens:
			"075200000000800023000060080008000050036090700000000800050010000490005100000009370",
		grid: "875200691060857423324961587008000250236598714500000830050010948490085162080009375",
		candidates:
			". . . . 34 34 . . . 19 . 19 . . . . . . . . . . . . . . . 79 14 . 1346 347 346 . . 69 . . . . . . . . . . 14 79 146 247 246 . . 69 67 . 237 367 . 236 . . . . . 37 37 . . . . . 16 . 12 46 24 . . . .",
		solution:
			"875234691169857423324961587948173256236598714517642839752316948493785162681429375",
	},
	"als-xz": {
		givens:
			"075200000000800023000060080008000050036090700000000800050010000490005100000009370",
		grid: "875200691060857423324961587008000250236598714500000830050010948490085162080009375",
		candidates:
			". . . . 34 34 . . . 19 . 19 . . . . . . . . . . . . . . . 79 14 . 134 347 346 . . 69 . . . . . . . . . . 14 79 146 247 246 . . 69 67 . 237 367 . 236 . . . . . 37 37 . . . . . 16 . 12 46 24 . . . .",
		solution:
			"875234691169857423324961587948173256236598714517642839752316948493785162681429375",
	},
	"x-chain": {
		givens:
			"030600090075030000200000700800009030900020008010800009001000004000060175040007000",
		grid: "030670090075930000200001703800009037953726418017803009701000004300060175540007000",
		candidates:
			"14 . 48 . . 2458 258 . 12 146 . . . . 248 268 246 126 . 689 4689 45 58 . . 456 . . 26 246 15 145 . 56 . . . . . . . . . . . 46 . . . 45 . 256 256 . . 268 . 235 589 58 39 268 . . 289 289 24 . 48 . . . . . 268 13 19 . 39 268 26",
		solution:
			"438672591175934826269581743824159637953726418617843259781295364392468175546317982",
	},
	"simple-coloring-trap": {
		givens:
			"020000409400070100006200000000085003090302050300740000000007800000010002601000090",
		grid: "020000409400070120006204000000085003090362750300740000000607800000010602601020090",
		candidates:
			"578 . 3578 158 35 1368 . 3678 . . 358 3589 589 . 3689 . . 568 15789 13578 . . 359 . 35 378 578 127 1467 247 19 . . 29 146 . 18 . 48 . . . . . 148 . 1568 258 . . 19 29 168 168 259 345 23459 . 359 . . 134 145 5789 34578 345789 4589 . 389 . 347 . . 34578 . 458 . 38 35 . 457",
		solution:
			"728156439435879126916234587167985243894362751352741968243697815589413672671528394",
	},
	"reveal-cell": {
		givens:
			"020000409400070100006200000000085003090302050300740000000007800000010002601000090",
		grid: "020000409400070120006204000000085003090362750300740000000607800000010602601020090",
		candidates:
			"578 . 3578 158 35 1368 . 3678 . . 358 3589 589 . 3689 . . 568 15789 13578 . . 359 . 35 378 578 127 467 247 19 . . 29 146 . 18 . 48 . . . . . 148 . 1568 258 . . 19 29 168 168 259 345 2345 . 359 . . 134 145 578 34578 345789 4589 . 389 . 347 . . 34578 . 458 . 38 35 . 457",
		solution:
			"728156439435879126916234587167985243894362751352741968243697815589413672671528394",
	},
	"simple-coloring-wrap": {
		givens:
			"004000020000800003003040008000200400009105007006008050900020800800001205050000970",
		grid: "084050020005810043003040508508270400429105087006498052901527804847901205052084971",
		candidates:
			"167 . . 367 . 369 167 . 69 267 679 . . . 269 67 . . 1267 1679 . 67 . 269 . 19 . . 13 . . . 36 . 19 69 . . . . 36 . 36 . . 137 137 . . . . 13 . . . 36 . . . . . 36 . . . . . 36 . . 36 . 36 . . 36 . . . . .",
		solution:
			"184356729275819643693742518518273496429165387736498152961527834847931265352684971",
	},
	jellyfish: {
		givens:
			"000803010053000002001000070700406080004000700060705003080007100200000560010208000",
		grid: "472803610653070802891000370705406081004080756068705003380007120247000568510208037",
		candidates:
			". . . . 59 . . . 59 . . . 19 . 149 . 49 . . . . 56 256 24 . . 45 . 23 . . 239 . 29 . . 19 23 . 39 . 129 . . . 19 . . . 12 . 249 49 . . . 69 56 456 . . . 49 . . . 139 139 19 . . . . . 69 . 46 . 49 . .",
		solution:
			"472893615653174892891652374735426981124389756968715243386547129247931568519268437",
	},
};

const EXPECTED: Record<keyof typeof STATES, Partial<SudokuHint>> = {
	"xy-chain": {
		technique: "xy-chain",
		cells: [35, 27, 47, 11, 74, 76, 75],
		candidateDigits: [6],
		eliminations: [{ cell: 30, digits: [6] }],
		colors: [
			[35, 47, 74, 75],
			[27, 11, 76],
		],
	},
	"als-xz": {
		technique: "als-xz",
		cells: [5, 32, 46, 48],
		candidateDigits: [6, 4],
		eliminations: [{ cell: 50, digits: [4] }],
		colors: [
			[5, 32],
			[46, 48],
		],
	},
	"x-chain": {
		technique: "x-chain",
		cells: [45, 9, 17, 80, 61, 55],
		candidateDigits: [6],
		eliminations: [{ cell: 28, digits: [6] }],
		colors: [
			[45, 17, 61],
			[9, 80, 55],
		],
	},
	"simple-coloring-trap": {
		technique: "simple-coloring",
		coloring: "trap",
		cells: [11, 18, 22, 58],
		candidateDigits: [9],
		eliminations: [{ cell: 56, digits: [9] }],
		colors: [
			[11, 22],
			[18, 58],
		],
	},
	"reveal-cell": {
		technique: "reveal-cell",
		cells: [4],
		candidateDigits: [5],
		eliminations: [],
		placements: [{ cell: 4, digit: 5 }],
	},
	"simple-coloring-wrap": {
		technique: "simple-coloring",
		coloring: "wrap",
		candidateDigits: [3],
		colors: [
			[3, 32, 42, 61, 67, 72],
			[5, 28, 40, 45, 51, 55, 70, 75],
		],
	},
	jellyfish: {
		technique: "jellyfish",
		cells: [4, 8, 31, 33, 56, 62, 74, 78],
		candidateDigits: [9],
		eliminations: [
			{ cell: 67, digits: [9] },
			{ cell: 51, digits: [9] },
		],
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

describe("expert sudoku hints", () => {
	it.each(ids)("finds %s as the simplest step, soundly", (id) => {
		const state = STATES[id];
		const hint = hintAt(state);
		expect(hint?.level).toBe("expert");
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
		const technique = EXPECTED[id].technique;
		// Revealing comes after every technique, just before the notes fallback.
		const stop =
			technique === "reveal-cell"
				? SUDOKU_TECHNIQUES.length - 1
				: SUDOKU_TECHNIQUES.findIndex((detector) => detector.id === technique);
		expect(stop).toBeGreaterThan(0);
		for (const detector of SUDOKU_TECHNIQUES.slice(0, stop)) {
			expect(detector.detect(grid, candidates)?.technique ?? null).toBeNull();
		}
	});

	it("wraps on two cells of one colour that see each other", () => {
		const hint = hintAt(STATES["simple-coloring-wrap"]) as SudokuHint;
		// The wrong colour comes second, so the board shows it in pink.
		const wrong = hint.colors?.[1] ?? [];
		const [a, b] = hint.cells;
		expect(wrong).toContain(a);
		expect(wrong).toContain(b);
		expect(hint.eliminations.map((entry) => entry.cell)).toEqual(wrong);
	});

	it.each(ids)("describes %s at three levels in each language", (id) => {
		const hint = hintAt(STATES[id]) as SudokuHint;
		for (const copy of [en.hints, nl.hints]) {
			for (const level of [1, 2, 3] as const) {
				const { title, text } = describeHint(hint, level, copy);
				expect(title).not.toMatch(/[{}]/);
				expect(text).not.toMatch(/[{}]/);
				expect(text.length).toBeGreaterThan(20);
			}
		}
	});

	it("names the chain's ends and the sets of an ALS-XZ", () => {
		const chain = hintAt(STATES["x-chain"]) as SudokuHint;
		expect(describeHint(chain, 2, en.hints).text).toBe(
			"There is an X-Chain on 6 from R6C1 to R7C2.",
		);
		const als = hintAt(STATES["als-xz"]) as SudokuHint;
		expect(describeHint(als, 2, nl.hints).text).toBe(
			"Er is een ALS-XZ op R1K6, R4K6 en R6K2, R6K4, gekoppeld door de 6.",
		);
		const fish = hintAt(STATES.jellyfish) as SudokuHint;
		expect(describeHint(fish, 2, en.hints).title).toBe("Jellyfish");
	});

	it("says a revealed cell comes from the solution", () => {
		const hint = hintAt(STATES["reveal-cell"]) as SudokuHint;
		expect(describeHint(hint, 3, en.hints).text).toBe(
			"R1C5 is 5. This comes from the solution, not from a technique, so it is the one hint that doesn't explain why.",
		);
	});

	it("reveals only when it knows the solution", () => {
		const state = STATES["reveal-cell"];
		// Killer givens are not unique on their own, so nothing is revealed
		// unless the client passes the solution.
		expect(hintAt(state, { cages: [{}] })?.technique).toBe("snyder-pair");
		expect(
			hintAt(state, { cages: [{}], solution: parseGrid(state.solution) }),
		).toMatchObject(EXPECTED["reveal-cell"]);
	});

	it("reveals at any maximum, without the earlier-hints note", () => {
		const state = STATES["reveal-cell"];
		for (const maxLevel of ["beginner", "advanced", "expert"] as const) {
			const hint = hintAt(state, { maxLevel });
			expect(hint).toMatchObject(EXPECTED["reveal-cell"]);
			expect(hint).not.toHaveProperty("aboveMaxLevel");
			expect(hint).not.toHaveProperty("usesEarlierHints");
		}
	});

	it("finds a wrong digit from the solved givens before revealing", () => {
		const state = STATES["reveal-cell"];
		const grid = parseGrid(state.grid);
		const solution = parseGrid(state.solution);
		// A wrong digit that clashes with nothing on the board.
		const cell = grid.findIndex(
			(value, index) =>
				value === 0 &&
				candidatesOf(state)[index] !== digitMask(solution[index]) &&
				digitsInMask(computeCandidates(grid)[index]).length > 1,
		);
		const wrong = digitsInMask(computeCandidates(grid)[cell]).find(
			(digit) => digit !== solution[cell],
		) as number;
		grid[cell] = wrong;
		expect(findHint(grid, { givens: parseGrid(state.givens) })).toMatchObject({
			technique: "mistake",
			cells: [cell],
		});
	});

	it("flags an expert step above an advanced maximum", () => {
		const hint = hintAt(STATES["x-chain"], { maxLevel: "advanced" });
		expect(hint).toMatchObject({ technique: "x-chain", aboveMaxLevel: true });
		expect(
			hintAt(STATES["x-chain"], { maxLevel: "expert" }),
		).not.toHaveProperty("aboveMaxLevel");
	});

	it("shows a chain in two tones once explained", () => {
		const hint = hintAt(STATES["x-chain"]) as SudokuHint;
		expect(hintHighlights(hint, 2)?.tones).toBeUndefined();
		const explained = hintHighlights(hint, 3);
		expect([...(explained?.tones?.[0] ?? [])]).toEqual([45, 17, 61]);
		expect([...(explained?.tones?.[1] ?? [])]).toEqual([9, 80, 55]);
		// The hint fill is left for the cell the chain changes.
		expect([...(explained?.cells ?? [])]).toEqual([28]);
	});

	it("stays fast enough for the phone on every state", () => {
		for (const id of ids) {
			hintAt(STATES[id]);
			const start = Date.now();
			hintAt(STATES[id]);
			expect(Date.now() - start).toBeLessThan(50);
		}
	});

	it("solves generated Expert puzzles without a wrong step", () => {
		for (let seed = 1; seed <= 30; seed += 1) {
			const { givens, solution } = generatePuzzle("expert", mulberry32(seed));
			const grid = [...givens];
			let history: HintHistory = [];
			while (grid.includes(0)) {
				const hint = findHint(grid, { givens, history });
				expect(hint).not.toBeNull();
				if (!hint) {
					break;
				}
				for (const { cell, digits } of hint.eliminations) {
					expect(digits).not.toContain(solution[cell]);
				}
				for (const { cell, digit } of hint.placements) {
					expect(digit).toBe(solution[cell]);
					grid[cell] = digit;
				}
				history = rememberHint(history, grid, hint);
			}
			expect(grid).toEqual(solution);
		}
	});
});
