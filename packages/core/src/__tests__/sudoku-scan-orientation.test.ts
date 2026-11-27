import { beforeAll, describe, expect, it } from "vitest";
import { mulberry32 } from "../random";
import { generateSolvedGrid } from "../sudoku";
import { generateKillerCages } from "../sudoku-killer";
import { readCages } from "../sudoku-scan-cages";
import {
	CLASSIC_TURNS,
	findUprightTurns,
	gridDigitGuesses,
	KILLER_TURNS,
	killerSumScore,
	turnCorners,
	uprightDigitScore,
} from "../sudoku-scan-orientation";
import { drawGrid } from "../testing/drawn-grid";
import { CELL, paintGlyph, renderKiller, SIZE } from "../testing/drawn-killer";
import { turned } from "../testing/turned";

/** Equal pixel for pixel (`toEqual` takes seconds on an image). */
const sameImage = (a: ArrayLike<number>, b: ArrayLike<number>) =>
	a.length === b.length &&
	Array.prototype.every.call(
		a,
		(value: number, index: number) => value === b[index],
	);

/**
 * What the scan warps at each turn of a photo taken `quarters` turns
 * clockwise: turning the corners by one turns the warp a quarter back.
 */
const viewAt = <T extends Uint8Array | Uint8ClampedArray>(
	photo: T,
	size: number,
	channels: number,
	turns: number,
) => turned(photo, size, channels, 4 - turns);

describe("turnCorners", () => {
	it("starts the corners further along, keeping their order", () => {
		expect(turnCorners(["tl", "tr", "br", "bl"], 1)).toEqual([
			"tr",
			"br",
			"bl",
			"tl",
		]);
		expect(turnCorners([1, 2, 3, 4], 0)).toEqual([1, 2, 3, 4]);
		expect(turnCorners([1, 2, 3, 4], 6)).toEqual([3, 4, 1, 2]);
	});
});

describe("findUprightTurns", () => {
	it("keeps the photo as taken when it scores enough, without trying others", async () => {
		const tried: number[] = [];
		const turns = await findUprightTurns(
			(turn) => {
				tried.push(turn);
				return 0.9;
			},
			{ enough: 0.8, margin: 0.1 },
		);
		expect(turns).toBe(0);
		expect(tried).toEqual([0]);
	});

	it("takes the best turn only when it wins by the margin", async () => {
		const scores = [0.5, 0.1, 0.95, 0.2];
		expect(await findUprightTurns((turn) => scores[turn], CLASSIC_TURNS)).toBe(
			2,
		);
		const close = [0.5, 0.55, 0.3, 0.2];
		expect(await findUprightTurns((turn) => close[turn], CLASSIC_TURNS)).toBe(
			0,
		);
	});
});

describe("a Killer photo taken sideways or upside down", () => {
	const rng = mulberry32(7);
	const cages = generateKillerCages(generateSolvedGrid(rng), rng).map((cage) =>
		[...cage.cells].sort((a, b) => a - b),
	);
	const upright = renderKiller(cages, { rng: mulberry32(8) });
	for (const cage of cages) {
		// Every cage's sum, two digits in its first cell's top-left corner.
		const x = (cage[0] % 9) * CELL;
		const y = Math.floor(cage[0] / 9) * CELL;
		paintGlyph(upright, x + 11, y + 11);
		paintGlyph(upright, x + 26, y + 11);
	}

	// The view at turn t of a photo taken q turns is the upright grid turned
	// q - t, so four reads score every photo at every turn.
	const scoreOf = (view: Uint8ClampedArray) =>
		killerSumScore(view, SIZE, readCages(view, SIZE));
	let scores: number[] = [];
	beforeAll(() => {
		scores = [0, 1, 2, 3].map((quarters) =>
			scoreOf(turned(upright, SIZE, 4, quarters)),
		);
	}, 60_000);

	it.each([0, 1, 2, 3])(
		"is read upright when turned %i quarters",
		async (quarters) => {
			const photo = turned(upright, SIZE, 4, quarters);
			const turns = await findUprightTurns(
				(turn) => scores[(quarters - turn + 4) % 4],
				KILLER_TURNS,
			);
			expect(turns).toBe(quarters);
			// So the sums are read from the same image as an upright photo's.
			expect(sameImage(viewAt(photo, SIZE, 4, turns), upright)).toBe(true);
		},
	);

	it("finds the sums upright by far more than turned", () => {
		expect(scores[0]).toBeGreaterThan(KILLER_TURNS.enough);
		expect(scores[0] - Math.max(...scores.slice(1))).toBeGreaterThan(
			KILLER_TURNS.margin,
		);
	});

	it("scores a turned photo from the cages it reads there", () => {
		const view = viewAt(turned(upright, SIZE, 4, 1), SIZE, 4, 0);
		expect(scoreOf(view)).toBeCloseTo(scores[1]);
	}, 30_000);
});

describe("a classic photo taken sideways or upside down", () => {
	const margin = 0.7;
	const margins = { left: margin, top: margin, right: margin, bottom: margin };
	const { gray, size } = drawGrid({
		margin,
		digits: [
			{ row: 0, column: 1, digit: 7 },
			{ row: 1, column: 5, digit: 4 },
			{ row: 2, column: 7, digit: 2 },
			{ row: 4, column: 3, digit: 7 },
			{ row: 5, column: 0, digit: 2 },
			{ row: 6, column: 8, digit: 4 },
			{ row: 7, column: 2, digit: 1 },
			{ row: 8, column: 6, digit: 7 },
		],
	});

	it.each([0, 1, 2, 3])(
		"is read upright when turned %i quarters",
		async (quarters) => {
			const photo = turned(gray, size, 1, quarters);
			const turns = await findUprightTurns(
				async (turn) =>
					uprightDigitScore(
						await gridDigitGuesses(
							{ pixels: viewAt(photo, size, 1, turn), size },
							margins,
						),
					),
				CLASSIC_TURNS,
			);
			expect(turns).toBe(quarters);
		},
	);

	it("scores the digits low on their side", async () => {
		const scoreAt = async (turn: number) =>
			uprightDigitScore(
				await gridDigitGuesses(
					{ pixels: viewAt(gray, size, 1, turn), size },
					margins,
				),
			);
		expect(await scoreAt(0)).toBeGreaterThan(CLASSIC_TURNS.enough);
		expect(await scoreAt(1)).toBeLessThan(0.5);
	});
});
