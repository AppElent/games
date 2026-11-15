import { describe, expect, it } from "vitest";
import {
	applyDiceAction,
	createDiceGame,
	DICE_ENGINE,
	DICE_GAMES,
	diceBotMove,
	diceRules,
	viewDiceGame,
} from "../dice/engine";
import {
	type ScoreCategory,
	type ScoresheetRules,
	type ScoresheetState,
	scoreCategory,
	scoreOptions,
	sheetTotals,
} from "../dice/scoresheet";
import { nextSeat, rollCup, rollDice } from "../dice/table";
import {
	categoryEffect,
	diceSeatName,
	latestNews,
	turnStep,
} from "../dice/table-view";
import { GameRuleError } from "../errors";
import { en } from "../i18n/en";
import { fmt } from "../i18n/format";
import { mulberry32 } from "../random";

const yatzy = DICE_GAMES.yatzy;
const SCANDI = diceRules(yatzy, []);
const YAHTZEE = diceRules(yatzy, ["yahtzeeSheet"]);

function scorer(rules: ScoresheetRules) {
	return (category: ScoreCategory, dice: number[]) => {
		const entry = rules.sheet.find((candidate) => candidate.id === category);
		if (!entry) {
			throw new Error(`no ${category} on this sheet`);
		}
		return scoreCategory(entry.rule, dice);
	};
}

function expectRule(run: () => unknown, code: string) {
	try {
		run();
	} catch (caught) {
		expect(caught).toBeInstanceOf(GameRuleError);
		expect((caught as GameRuleError).code).toBe(code);
		return;
	}
	throw new Error(`expected ${code}`);
}

/** A game whose next roll is whatever `dice` says, for scoring through the engine. */
function withDice(
	state: ScoresheetState,
	dice: number[],
	rollsUsed = 1,
): ScoresheetState {
	return {
		...state,
		dice,
		held: dice.map(() => false),
		rollsUsed,
	};
}

describe("Scandinavian sheet scoring", () => {
	const score = scorer(SCANDI);

	it("has fifteen boxes and a 50-point bonus at 63", () => {
		expect(SCANDI.sheet).toHaveLength(15);
		expect(SCANDI.upperBonus).toEqual({ threshold: 63, points: 50 });
	});

	it("scores the upper section by face", () => {
		expect(score("ones", [1, 1, 2, 3, 1])).toBe(3);
		expect(score("twos", [2, 2, 2, 2, 5])).toBe(8);
		expect(score("threes", [3, 1, 1, 1, 1])).toBe(3);
		expect(score("fours", [4, 4, 1, 2, 3])).toBe(8);
		expect(score("fives", [5, 5, 5, 5, 5])).toBe(25);
		expect(score("sixes", [1, 2, 3, 4, 5])).toBe(0);
	});

	it("scores the highest pair", () => {
		expect(score("onePair", [3, 3, 5, 5, 1])).toBe(10);
		expect(score("onePair", [6, 6, 6, 2, 1])).toBe(12);
		expect(score("onePair", [1, 2, 3, 4, 6])).toBe(0);
	});

	it("scores two different pairs", () => {
		expect(score("twoPairs", [3, 3, 5, 5, 1])).toBe(16);
		expect(score("twoPairs", [2, 2, 2, 6, 6])).toBe(16);
		expect(score("twoPairs", [4, 4, 4, 4, 1])).toBe(0);
		expect(score("twoPairs", [4, 4, 1, 2, 3])).toBe(0);
	});

	it("scores three and four of a kind as the matching dice", () => {
		expect(score("threeKind", [5, 5, 5, 2, 1])).toBe(15);
		expect(score("threeKind", [2, 2, 2, 2, 6])).toBe(6);
		expect(score("threeKind", [5, 5, 4, 4, 1])).toBe(0);
		expect(score("fourKind", [3, 3, 3, 3, 6])).toBe(12);
		expect(score("fourKind", [6, 6, 6, 6, 6])).toBe(24);
		expect(score("fourKind", [6, 6, 6, 1, 1])).toBe(0);
	});

	it("scores the fixed straights as their sum", () => {
		expect(score("smallStraight", [5, 4, 3, 2, 1])).toBe(15);
		expect(score("smallStraight", [2, 3, 4, 5, 6])).toBe(0);
		expect(score("largeStraight", [6, 2, 5, 3, 4])).toBe(20);
		expect(score("largeStraight", [1, 2, 3, 4, 5])).toBe(0);
	});

	it("scores a full house as the sum, but not five alike", () => {
		expect(score("fullHouse", [2, 2, 6, 6, 6])).toBe(22);
		expect(score("fullHouse", [4, 4, 4, 4, 4])).toBe(0);
		expect(score("fullHouse", [2, 2, 6, 6, 1])).toBe(0);
	});

	it("scores chance and yatzy", () => {
		expect(score("chance", [1, 2, 3, 4, 6])).toBe(16);
		expect(score("yatzy", [3, 3, 3, 3, 3])).toBe(50);
		expect(score("yatzy", [3, 3, 3, 3, 2])).toBe(0);
	});

	it("adds the upper bonus from 63", () => {
		const scores = {
			ones: 3,
			twos: 6,
			threes: 9,
			fours: 12,
			fives: 15,
			sixes: 18,
		};
		expect(sheetTotals(SCANDI, scores, 0)).toEqual({
			upper: 63,
			upperBonus: 50,
			lower: 0,
			extra: 0,
			total: 113,
		});
		expect(sheetTotals(SCANDI, { ...scores, ones: 2 }, 0).upperBonus).toBe(0);
	});
});

describe("Yahtzee sheet scoring", () => {
	const score = scorer(YAHTZEE);

	it("has thirteen boxes and a 35-point bonus at 63", () => {
		expect(YAHTZEE.sheet).toHaveLength(13);
		expect(YAHTZEE.sheet.map((entry) => entry.id)).not.toContain("onePair");
		expect(YAHTZEE.upperBonus).toEqual({ threshold: 63, points: 35 });
	});

	it("scores the upper section by face", () => {
		expect(score("ones", [1, 1, 1, 3, 4])).toBe(3);
		expect(score("twos", [2, 1, 1, 1, 1])).toBe(2);
		expect(score("threes", [3, 3, 3, 3, 3])).toBe(15);
		expect(score("fours", [4, 4, 1, 2, 3])).toBe(8);
		expect(score("fives", [5, 5, 1, 1, 1])).toBe(10);
		expect(score("sixes", [6, 6, 6, 1, 1])).toBe(18);
	});

	it("scores three and four of a kind as every die", () => {
		expect(score("threeKind", [5, 5, 5, 2, 1])).toBe(18);
		expect(score("threeKind", [5, 5, 4, 2, 1])).toBe(0);
		expect(score("fourKind", [3, 3, 3, 3, 6])).toBe(18);
		expect(score("fourKind", [3, 3, 3, 6, 6])).toBe(0);
	});

	it("scores a full house as 25", () => {
		expect(score("fullHouse", [2, 2, 6, 6, 6])).toBe(25);
		expect(score("fullHouse", [6, 6, 6, 6, 2])).toBe(0);
	});

	it("scores any four in a row as 30 and five as 40", () => {
		expect(score("smallStraight", [1, 2, 3, 4, 6])).toBe(30);
		expect(score("smallStraight", [3, 4, 5, 6, 6])).toBe(30);
		expect(score("smallStraight", [1, 2, 3, 5, 6])).toBe(0);
		expect(score("largeStraight", [1, 2, 3, 4, 5])).toBe(40);
		expect(score("largeStraight", [2, 3, 4, 5, 6])).toBe(40);
		expect(score("largeStraight", [1, 2, 3, 4, 6])).toBe(0);
	});

	it("scores yahtzee and chance", () => {
		expect(score("yatzy", [2, 2, 2, 2, 2])).toBe(50);
		expect(score("chance", [6, 6, 5, 5, 4])).toBe(26);
	});

	it("pays 100 for an extra yahtzee and plays it as a joker", () => {
		let state = createDiceGame(yatzy, ["yahtzeeSheet"], 1);
		state.sheets[0] = { yatzy: 50, fours: 8 };
		// Fours is taken, so the joker may fill any open lower box as made.
		const options = scoreOptions(YAHTZEE, state.sheets[0], [4, 4, 4, 4, 4]);
		expect(options).toContainEqual({ category: "fullHouse", points: 25 });
		expect(options).toContainEqual({ category: "largeStraight", points: 40 });
		expect(options.some((option) => option.category === "sixes")).toBe(false);
		state = applyDiceAction(
			yatzy,
			["yahtzeeSheet"],
			withDice(state, [4, 4, 4, 4, 4]),
			0,
			{ type: "score", category: "largeStraight" },
		);
		expect(state.sheets[0].largeStraight).toBe(40);
		expect(state.extras[0]).toBe(100);
		expect(
			viewDiceGame(yatzy, ["yahtzeeSheet"], state, 0).sheets[0].extra,
		).toBe(100);
	});

	it("forces an extra yahtzee into its own upper box when that is open", () => {
		const state = createDiceGame(yatzy, ["yahtzeeSheet"], 1);
		state.sheets[0] = { yatzy: 50 };
		expect(scoreOptions(YAHTZEE, state.sheets[0], [3, 3, 3, 3, 3])).toEqual([
			{ category: "threes", points: 15 },
		]);
		expectRule(
			() =>
				applyDiceAction(
					yatzy,
					["yahtzeeSheet"],
					withDice(state, [3, 3, 3, 3, 3]),
					0,
					{ type: "score", category: "chance" },
				),
			"diceJokerRule",
		);
	});

	it("pays no bonus after a scratched yahtzee, but keeps the joker", () => {
		let state = createDiceGame(yatzy, ["yahtzeeSheet"], 1);
		state.sheets[0] = { yatzy: 0, twos: 4 };
		state = applyDiceAction(
			yatzy,
			["yahtzeeSheet"],
			withDice(state, [2, 2, 2, 2, 2]),
			0,
			{ type: "score", category: "smallStraight" },
		);
		expect(state.sheets[0].smallStraight).toBe(30);
		expect(state.extras[0]).toBe(0);
	});

	it("makes a joker zero an upper box when the lower section is full", () => {
		const lower = {
			threeKind: 20,
			fourKind: 20,
			fullHouse: 25,
			smallStraight: 30,
			largeStraight: 40,
			yatzy: 50,
			chance: 20,
		};
		expect(
			scoreOptions(YAHTZEE, { ...lower, fives: 10 }, [5, 5, 5, 5, 5]),
		).toEqual([
			{ category: "ones", points: 0 },
			{ category: "twos", points: 0 },
			{ category: "threes", points: 0 },
			{ category: "fours", points: 0 },
			{ category: "sixes", points: 0 },
		]);
	});

	it("lets the Scandinavian sheet score a second yatzy anywhere, with no bonus", () => {
		const options = scoreOptions(SCANDI, { yatzy: 50 }, [4, 4, 4, 4, 4]);
		expect(options).toHaveLength(14);
		expect(options).toContainEqual({ category: "fullHouse", points: 0 });
	});
});

describe("dice table", () => {
	it("rolls from the generator it is given", () => {
		expect(rollDice(mulberry32(42), 5)).toEqual(rollDice(mulberry32(42), 5));
		for (const value of rollDice(mulberry32(1), 200)) {
			expect(value).toBeGreaterThanOrEqual(1);
			expect(value).toBeLessThanOrEqual(6);
		}
	});

	it("keeps held dice in place", () => {
		const rolled = rollCup(mulberry32(7), [6, 1, 6, 2, 6], [0, 2, 4]);
		expect(rolled.held).toEqual([true, false, true, false, true]);
		expect([rolled.values[0], rolled.values[2], rolled.values[4]]).toEqual([
			6, 6, 6,
		]);
	});

	it("refuses holds that are not dice in the cup", () => {
		for (const keep of [[5], [-1], [0, 0], [1.5]]) {
			expectRule(
				() => rollCup(mulberry32(1), [1, 2, 3, 4, 5], keep),
				"diceInvalidHold",
			);
		}
	});

	it("skips seats that are out", () => {
		expect(nextSeat(0, 4)).toBe(1);
		expect(nextSeat(3, 4)).toBe(0);
		expect(nextSeat(0, 4, [false, true, true, false])).toBe(3);
	});
});

describe("Yatzy turns", () => {
	const fresh = (seats = 2) => createDiceGame(yatzy, [], seats);

	it("takes 1 to 6 players", () => {
		expect(() => fresh(1)).not.toThrow();
		expect(() => fresh(6)).not.toThrow();
		expectRule(() => fresh(7), "notEnoughPlayers");
		expectRule(() => fresh(0), "notEnoughPlayers");
	});

	it("rolls three times, holding dice, then must score", () => {
		let state = fresh();
		state = applyDiceAction(yatzy, [], state, 0, { type: "roll", keep: [] });
		expect(state.dice).toHaveLength(5);
		const first = state.dice;
		state = applyDiceAction(yatzy, [], state, 0, {
			type: "roll",
			keep: [0, 1],
		});
		expect(state.dice.slice(0, 2)).toEqual(first.slice(0, 2));
		expect(state.held).toEqual([true, true, false, false, false]);
		state = applyDiceAction(yatzy, [], state, 0, { type: "roll", keep: [] });
		expectRule(
			() => applyDiceAction(yatzy, [], state, 0, { type: "roll", keep: [] }),
			"diceNoRollsLeft",
		);
		state = applyDiceAction(yatzy, [], state, 0, {
			type: "score",
			category: "chance",
		});
		expect(state.sheets[0].chance).toBeGreaterThan(0);
		expect(state.turn).toBe(1);
		expect(state.rollsUsed).toBe(0);
		expect(state.dice).toEqual([]);
	});

	it("refuses illegal moves without changing the state", () => {
		const state = fresh();
		const before = JSON.stringify(state);
		expectRule(
			() => applyDiceAction(yatzy, [], state, 1, { type: "roll", keep: [] }),
			"notYourTurn",
		);
		expectRule(
			() =>
				applyDiceAction(yatzy, [], state, 0, {
					type: "score",
					category: "ones",
				}),
			"diceRollFirst",
		);
		expectRule(
			() => applyDiceAction(yatzy, [], state, 0, { type: "roll", keep: [0] }),
			"diceInvalidHold",
		);
		const rolled = applyDiceAction(yatzy, [], state, 0, {
			type: "roll",
			keep: [],
		});
		expectRule(
			() => applyDiceAction(yatzy, [], rolled, 0, { type: "roll", keep: [9] }),
			"diceInvalidHold",
		);
		expectRule(
			() =>
				applyDiceAction(yatzy, [], rolled, 0, {
					type: "roll",
					keep: [0, 1, 2, 3, 4],
				}),
			"diceInvalidHold",
		);
		expectRule(
			() =>
				applyDiceAction(yatzy, ["yahtzeeSheet"], rolled, 0, {
					type: "score",
					category: "onePair",
				}),
			"diceUnknownCategory",
		);
		const scored = applyDiceAction(yatzy, [], { ...rolled, turn: 0 }, 0, {
			type: "score",
			category: "ones",
		});
		const again = applyDiceAction(yatzy, [], { ...scored, turn: 0 }, 0, {
			type: "roll",
			keep: [],
		});
		expectRule(
			() =>
				applyDiceAction(yatzy, [], again, 0, {
					type: "score",
					category: "ones",
				}),
			"diceCategoryTaken",
		);
		expectRule(
			() =>
				applyDiceAction(yatzy, [], state, 0, {
					type: "draw",
				} as unknown as Parameters<typeof applyDiceAction>[4]),
			"cardsWrongAction",
		);
		expect(JSON.stringify(state)).toBe(before);
	});

	it("refuses a move once the game is over", () => {
		const state = { ...fresh(), phase: "finished" as const };
		expectRule(
			() => applyDiceAction(yatzy, [], state, 0, { type: "roll", keep: [] }),
			"noActiveGame",
		);
	});

	it("rejects unknown house rules", () => {
		expectRule(
			() => DICE_ENGINE.normalizeOptions("yatzy", ["loadedDice"]),
			"cardsUnknownOption",
		);
		expect(DICE_ENGINE.normalizeOptions("yatzy", ["yahtzeeSheet"])).toEqual([
			"yahtzeeSheet",
		]);
		expectRule(() => DICE_ENGINE.players("farkle"), "gameNotFound");
	});

	it("offers no boxes before the first roll", () => {
		const view = viewDiceGame(yatzy, [], fresh(), null);
		expect(view.options).toEqual([]);
	});

	it("offers where the rolled dice may go", () => {
		const state = applyDiceAction(yatzy, [], fresh(), 0, {
			type: "roll",
			keep: [],
		});
		const view = viewDiceGame(yatzy, [], state, 1);
		expect(view.options).toHaveLength(15);
	});
});

/** Plays a whole game with bots in every seat; returns the final state. */
function playOut(options: string[], seats: number, seed: number) {
	const bots = Array.from({ length: seats }, (_, seat) => seat);
	const random = mulberry32(seed);
	let state = createDiceGame(yatzy, options, seats, seed % seats);
	const limit = seats * yatzy.rules.sheet.length * 4;
	for (let step = 0; step < limit; step += 1) {
		const move = diceBotMove(yatzy, options, state, bots);
		if (!move) {
			break;
		}
		state = applyDiceAction(
			yatzy,
			options,
			state,
			move.seat,
			move.action,
			random,
		);
	}
	return state;
}

describe("Yatzy bots", () => {
	it("finish games on both sheets over many seeds", () => {
		const totals: number[] = [];
		for (let seed = 1; seed <= 24; seed += 1) {
			const options = seed % 2 ? [] : ["yahtzeeSheet"];
			const rules = diceRules(yatzy, options);
			const seats = 1 + (seed % 3);
			const state = playOut(options, seats, seed);
			expect(state.phase).toBe("finished");
			expect(state.winners.length).toBeGreaterThan(0);
			for (const scores of state.sheets) {
				expect(Object.keys(scores)).toHaveLength(rules.sheet.length);
			}
			totals.push(
				...state.sheets.map(
					(scores, seat) =>
						sheetTotals(rules, scores, state.extras[seat]).total,
				),
			);
		}
		// A sensible player averages well over 150; random play is near 100.
		const average = totals.reduce((a, b) => a + b, 0) / totals.length;
		expect(average).toBeGreaterThan(150);
	});

	it("only moves for a computer seat whose turn it is", () => {
		const state = createDiceGame(yatzy, [], 2);
		expect(diceBotMove(yatzy, [], state, [1])).toBeNull();
		expect(diceBotMove(yatzy, [], state, [0])).toMatchObject({
			seat: 0,
			pace: "turn",
		});
	});
});

describe("dice table view", () => {
	it("words every box on both sheets with no placeholder left", () => {
		for (const rules of [SCANDI, YAHTZEE]) {
			for (const entry of rules.sheet) {
				const text = categoryEffect(
					{ dice: en.games.dice, fmt },
					entry.rule,
					5,
				);
				expect(text).not.toMatch(/[{}]/);
				expect(en.games.dice.categories[entry.id]).toBeTruthy();
			}
		}
		expect(
			categoryEffect({ dice: en.games.dice, fmt }, SCANDI.sheet[11].rule, 5),
		).toBe("2-6: the sum, 20 points.");
	});

	it("tells the viewer what to do", () => {
		let state = createDiceGame(yatzy, [], 2);
		const view = () => viewDiceGame(yatzy, [], state, 0);
		expect(turnStep(view(), 0)).toBe("start");
		expect(turnStep(view(), 1)).toBe("waiting");
		expect(turnStep(view(), null)).toBe("waiting");
		state = applyDiceAction(yatzy, [], state, 0, { type: "roll", keep: [] });
		expect(turnStep(view(), 0)).toBe("hold");
		const seats = { seats: [{ botIndex: null, name: "Eric" }], you: 0 };
		const news = () =>
			latestNews({ dice: en.games.dice, fmt }, seats, state.events);
		expect(news()).toMatch(/^You rolled [1-6](, [1-6]){4}$/);
		state = applyDiceAction(yatzy, [], withDice(state, [1, 1, 1, 1, 1], 3), 0, {
			type: "score",
			category: "yatzy",
		});
		expect(news()).toBe("You scored 50 in Yatzy");
		state = { ...state, phase: "finished" };
		expect(turnStep(view(), 0)).toBe("over");
	});

	it("names seats", () => {
		const table = {
			seats: [
				{ botIndex: null, name: "Eric" },
				{ botIndex: 2, name: null },
			],
			you: 0,
		};
		expect(diceSeatName(en.games.dice, table, 0)).toBe("You");
		expect(diceSeatName(en.games.dice, table, 1)).toBe("Cato");
		expect(diceSeatName(en.games.dice, { ...table, you: null }, 0)).toBe(
			"Eric",
		);
	});
});
