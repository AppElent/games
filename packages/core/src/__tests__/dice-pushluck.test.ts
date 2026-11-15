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
	type PushluckAction,
	type PushluckRules,
	type PushluckState,
	rollScores,
	scoreSetAside,
	setAsideChoices,
} from "../dice/pushluck";
import {
	lastBust,
	latestNews,
	pushluckPick,
	pushluckRuleLines,
	pushluckStep,
	standings,
} from "../dice/table-view";
import { GameRuleError } from "../errors";
import { en } from "../i18n/en";
import { fmt } from "../i18n/format";
import { nl } from "../i18n/nl";
import { mulberry32, type Rng } from "../random";

const game = DICE_GAMES.tienduizend;
const BASE = diceRules(game, []);
const FIXED = diceRules(game, ["fixedKinds"]);
const BARE = diceRules(game, ["noThreePairs", "noStraight"]);

/** A generator that rolls exactly these faces, in order. */
function dice(...faces: number[]): Rng {
	let next = 0;
	return () => {
		const face = faces[next];
		next += 1;
		if (face === undefined) {
			throw new Error("rolled more dice than the test planned");
		}
		return (face - 1) / 6 + 0.01;
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

function act(
	state: PushluckState,
	action: PushluckAction,
	random: Rng,
	options: string[] = [],
	seat = state.turn,
) {
	return applyDiceAction(game, options, state, seat, action, random);
}

/** A table whose current player has just rolled `faces`. */
function rolled(faces: number[], over: Partial<PushluckState> = {}) {
	return { ...createDiceGame(game, [], 2), dice: faces, ...over };
}

describe("10.000 scoring", () => {
	const score = (values: number[], rules: PushluckRules = BASE) =>
		scoreSetAside(rules, values);

	it("plays six dice to 10,000 with 2 to 6 players", () => {
		expect(BASE.dice).toBe(6);
		expect(BASE.target).toBe(10_000);
		expect(game.players).toEqual({ min: 2, max: 6 });
	});

	it("scores single 1s and 5s", () => {
		expect(score([1])).toBe(100);
		expect(score([5])).toBe(50);
		expect(score([1, 5])).toBe(150);
		expect(score([1, 1, 5, 5])).toBe(300);
	});

	it("scores three alike as the face times 100, three 1s as 1000", () => {
		expect(score([1, 1, 1])).toBe(1000);
		expect(score([2, 2, 2])).toBe(200);
		expect(score([3, 3, 3])).toBe(300);
		expect(score([4, 4, 4])).toBe(400);
		expect(score([5, 5, 5])).toBe(500);
		expect(score([6, 6, 6])).toBe(600);
	});

	it("doubles three alike for every extra die by default", () => {
		expect(score([2, 2, 2, 2])).toBe(400);
		expect(score([2, 2, 2, 2, 2])).toBe(800);
		expect(score([2, 2, 2, 2, 2, 2])).toBe(1600);
		expect(score([1, 1, 1, 1])).toBe(2000);
		expect(score([1, 1, 1, 1, 1])).toBe(4000);
		expect(score([1, 1, 1, 1, 1, 1])).toBe(8000);
		expect(score([6, 6, 6, 6])).toBe(1200);
	});

	it("pays fixed points for four, five and six alike under that house rule", () => {
		expect(score([2, 2, 2, 2], FIXED)).toBe(1000);
		expect(score([4, 4, 4, 4, 4], FIXED)).toBe(2000);
		expect(score([3, 3, 3, 3, 3, 3], FIXED)).toBe(3000);
		// Splitting is worth more here: three 1s and a single 1.
		expect(score([1, 1, 1, 1], FIXED)).toBe(1100);
		expect(score([1, 1, 1, 1, 1, 1], FIXED)).toBe(3000);
	});

	it("scores a straight and three pairs only as all six dice", () => {
		expect(score([1, 2, 3, 4, 5, 6])).toBe(1500);
		expect(score([6, 5, 4, 3, 2, 1])).toBe(1500);
		expect(score([2, 2, 3, 3, 6, 6])).toBe(750);
		expect(score([1, 1, 5, 5, 6, 6])).toBe(750);
		// Four alike and a pair is not three pairs.
		expect(score([2, 2, 2, 2, 3, 3])).toBeNull();
		expect(score([2, 3, 4, 5, 6])).toBeNull();
	});

	it("drops the straight and three pairs under those house rules", () => {
		expect(score([1, 2, 3, 4, 5, 6], BARE)).toBeNull();
		expect(score([2, 2, 3, 3, 6, 6], BARE)).toBeNull();
		// Three pairs that are all 1s and 5s still score as singles.
		expect(score([1, 1, 5, 5, 5, 5], BARE)).toBe(200 + 1000);
	});

	it("takes the best way to split mixed dice", () => {
		expect(score([1, 1, 1, 5])).toBe(1050);
		expect(score([2, 2, 2, 3, 3, 3])).toBe(500);
		expect(score([5, 5, 5, 1])).toBe(600);
		expect(score([1, 1, 1, 1, 5, 5])).toBe(2100);
	});

	it("refuses sets with a die that does not score", () => {
		expect(score([])).toBeNull();
		expect(score([2])).toBeNull();
		expect(score([1, 2])).toBeNull();
		expect(score([5, 5, 6])).toBeNull();
		expect(score([3, 3, 4, 4])).toBeNull();
	});

	it("knows a roll that busts", () => {
		expect(rollScores(BASE, [2, 3, 4, 6, 2, 3])).toBe(false);
		expect(rollScores(BASE, [2, 3, 4, 6])).toBe(false);
		expect(rollScores(BASE, [6])).toBe(false);
		expect(rollScores(BASE, [6, 6, 6])).toBe(true);
		expect(rollScores(BASE, [2, 5])).toBe(true);
		expect(rollScores(BASE, [2, 2, 3, 3, 4, 4])).toBe(true);
		expect(rollScores(BARE, [2, 2, 3, 3, 4, 4])).toBe(false);
	});

	it("lists every distinct scoring set-aside of a roll", () => {
		const choices = setAsideChoices(BASE, [1, 5, 2, 2, 2, 6]);
		const points = choices.map((choice) => choice.points).sort((a, b) => a - b);
		expect(points).toEqual([50, 100, 150, 200, 250, 300, 350]);
	});
});

describe("10.000 turns", () => {
	it("rolls all six to start, then sets aside and rolls the rest", () => {
		let state = createDiceGame(game, [], 2);
		state = act(state, { type: "roll", keep: [] }, dice(1, 5, 2, 3, 4, 6));
		expect(state.dice).toEqual([1, 5, 2, 3, 4, 6]);
		// The straight is worth more, but taking the 1 alone keeps five dice.
		state = act(state, { type: "roll", keep: [0] }, dice(5, 2, 2, 3, 6));
		expect(state.turnTotal).toBe(100);
		expect(state.setAside).toEqual([1]);
		expect(state.dice).toEqual([5, 2, 2, 3, 6]);
		state = act(state, { type: "bank", keep: [0] }, dice());
		expect(state.scores).toEqual([150, 0]);
		expect(state.turn).toBe(1);
		expect(state.dice).toEqual([]);
		expect(state.turnTotal).toBe(0);
		expect(state.events.at(-1)).toMatchObject({
			type: "bank",
			seat: 0,
			points: 150,
			total: 150,
		});
	});

	it("busts a roll with nothing that scores and loses the turn's points", () => {
		let state = rolled([1, 1, 1, 2, 3, 4]);
		state = act(state, { type: "roll", keep: [0, 1, 2] }, dice(2, 3, 4));
		expect(state.turn).toBe(1);
		expect(state.scores).toEqual([0, 0]);
		expect(state.turnTotal).toBe(0);
		expect(state.dice).toEqual([]);
		expect(state.events.at(-1)).toMatchObject({
			type: "bust",
			seat: 0,
			dice: [2, 3, 4],
			lost: 1000,
		});
	});

	it("busts on the very first roll too", () => {
		const state = act(
			createDiceGame(game, [], 3),
			{ type: "roll", keep: [] },
			dice(2, 2, 3, 4, 6, 6),
		);
		expect(state.turn).toBe(1);
		expect(state.events.at(-1)).toMatchObject({ type: "bust", lost: 0 });
	});

	it("hands back all six dice after hot dice, keeping the turn total", () => {
		let state = rolled([1, 1, 1, 5, 2, 3], { turnTotal: 0 });
		state = act(state, { type: "roll", keep: [0, 1, 2, 3] }, dice(5, 1));
		expect(state.turnTotal).toBe(1050);
		state = act(state, { type: "roll", keep: [0, 1] }, dice(2, 2, 2, 3, 4, 6));
		expect(state.turnTotal).toBe(1200);
		expect(state.dice).toEqual([2, 2, 2, 3, 4, 6]);
		expect(state.setAside).toEqual([]);
		const types = state.events.slice(-2).map((event) => event.type);
		expect(types).toEqual(["hotDice", "roll"]);
		state = act(state, { type: "bank", keep: [0, 1, 2] }, dice());
		expect(state.scores[0]).toBe(1400);
	});

	it("banks hot dice without rolling again", () => {
		const state = act(
			rolled([1, 2, 3, 4, 5, 6]),
			{ type: "bank", keep: [0, 1, 2, 3, 4, 5] },
			dice(),
		);
		expect(state.scores[0]).toBe(1500);
	});

	it("counts the rounds as the turn comes back to the starter", () => {
		let state = createDiceGame(game, [], 2);
		for (let turn = 0; turn < 4; turn += 1) {
			state = act(state, { type: "roll", keep: [] }, dice(2, 2, 3, 4, 6, 6));
		}
		expect(state.round).toBe(3);
		expect(state.turn).toBe(0);
	});

	it("refuses illegal set-asides without changing the state", () => {
		const fresh = createDiceGame(game, [], 2);
		const state = rolled([1, 5, 2, 3, 4, 6]);
		const before = JSON.stringify(state);
		expectRule(
			() => act(fresh, { type: "bank", keep: [] }, dice()),
			"diceRollFirst",
		);
		expectRule(
			() => act(fresh, { type: "roll", keep: [0] }, dice()),
			"diceInvalidHold",
		);
		expectRule(
			() => act(state, { type: "roll", keep: [] }, dice()),
			"diceSetAsideFirst",
		);
		expectRule(
			() => act(state, { type: "bank", keep: [] }, dice()),
			"diceSetAsideFirst",
		);
		expectRule(
			() => act(state, { type: "roll", keep: [0, 2] }, dice()),
			"diceNotScoring",
		);
		expectRule(
			() => act(state, { type: "roll", keep: [0, 0] }, dice()),
			"diceInvalidHold",
		);
		expectRule(
			() => act(state, { type: "roll", keep: [6] }, dice()),
			"diceInvalidHold",
		);
		expectRule(
			() => act(state, { type: "roll", keep: [-1] }, dice()),
			"diceInvalidHold",
		);
		expectRule(
			() => act(state, { type: "roll", keep: [1.5] }, dice()),
			"diceInvalidHold",
		);
		expectRule(
			() => act(state, { type: "roll", keep: [0] }, dice(), [], 1),
			"notYourTurn",
		);
		expectRule(
			() =>
				applyDiceAction(
					game,
					[],
					state,
					0,
					{ type: "score", category: "chance" } as unknown as PushluckAction,
					dice(),
				),
			"cardsWrongAction",
		);
		expectRule(
			() =>
				act(
					{ ...state, phase: "finished" },
					{ type: "roll", keep: [0] },
					dice(),
				),
			"noActiveGame",
		);
		expect(JSON.stringify(state)).toBe(before);
	});

	it("needs the opening score in one turn to get on the board", () => {
		const options = ["opening350"];
		const state = rolled([1, 5, 2, 3, 4, 6], { turnTotal: 200 });
		try {
			act(state, { type: "bank", keep: [0] }, dice(), options);
			throw new Error("expected a refusal");
		} catch (caught) {
			expect((caught as GameRuleError).code).toBe("diceBelowOpening");
			expect((caught as GameRuleError).params).toEqual({
				needed: 350,
				have: 300,
			});
		}
		const enough = act(state, { type: "bank", keep: [0, 1] }, dice(), options);
		expect(enough.scores[0]).toBe(350);
		expect(diceRules(game, ["opening500"]).openingScore).toBe(500);
	});

	it("lets a player already on the board bank anything", () => {
		const state = rolled([5, 2, 3, 4, 6, 6], { scores: [400, 0] });
		const next = act(state, { type: "bank", keep: [0] }, dice(), [
			"opening500",
		]);
		expect(next.scores[0]).toBe(450);
	});

	it("refuses two opening thresholds at once", () => {
		expectRule(
			() =>
				DICE_ENGINE.normalizeOptions("tienduizend", [
					"opening350",
					"opening500",
				]),
			"cardsOptionsClash",
		);
	});

	it("needs two to six players", () => {
		expectRule(() => createDiceGame(game, [], 1), "notEnoughPlayers");
		expectRule(() => createDiceGame(game, [], 7), "notEnoughPlayers");
		expect(createDiceGame(game, [], 6).scores).toHaveLength(6);
	});
});

describe("10.000 endings", () => {
	it("gives everyone else one final turn once someone passes 10,000", () => {
		let state = createDiceGame(game, [], 3);
		state = { ...state, scores: [9900, 9000, 2000], dice: [1, 2, 3, 4, 6, 6] };
		state = act(state, { type: "bank", keep: [0] }, dice());
		expect(state.scores[0]).toBe(10_000);
		expect(state.finalRoundBy).toBe(0);
		expect(state.phase).toBe("playing");
		expect(state.turn).toBe(1);
		expect(state.events.at(-1)).toMatchObject({ type: "finalRound", seat: 0 });
		// Seat 1 overtakes.
		state = act(state, { type: "roll", keep: [] }, dice(1, 1, 1, 1, 2, 3));
		state = act(state, { type: "bank", keep: [0, 1, 2, 3] }, dice());
		expect(state.scores[1]).toBe(11_000);
		expect(state.phase).toBe("playing");
		// Seat 2 busts, and the final round is over.
		state = act(state, { type: "roll", keep: [] }, dice(2, 2, 3, 4, 6, 6));
		expect(state.phase).toBe("finished");
		expect(state.winners).toEqual([1]);
		expect(state.events.at(-1)).toMatchObject({ type: "win", seats: [1] });
	});

	it("does not restart the final round when someone else passes the target", () => {
		let state = createDiceGame(game, [], 2);
		state = { ...state, scores: [9950, 9950], dice: [5, 2, 3, 4, 6, 6] };
		state = act(state, { type: "bank", keep: [0] }, dice());
		state = act(state, { type: "roll", keep: [] }, dice(5, 2, 3, 4, 6, 6));
		state = act(state, { type: "bank", keep: [0] }, dice());
		expect(state.phase).toBe("finished");
		expect(state.winners).toEqual([0, 1]);
	});

	it("ends at once without the final round", () => {
		const options = ["noFinalRound"];
		const state = act(
			rolled([1, 2, 3, 4, 6, 6], { scores: [9900, 9950] }),
			{ type: "bank", keep: [0] },
			dice(),
			options,
		);
		expect(state.phase).toBe("finished");
		expect(state.winners).toEqual([0]);
		expectRule(
			() => act(state, { type: "roll", keep: [] }, dice(), options, 1),
			"noActiveGame",
		);
	});
});

describe("10.000 bots", () => {
	const OPTION_SETS = [
		[],
		["opening350"],
		["opening500", "fixedKinds"],
		["noThreePairs", "noStraight"],
		["noFinalRound"],
	];

	it("finish games over many seeds", () => {
		for (let seed = 1; seed <= 40; seed += 1) {
			const random = mulberry32(seed);
			const options = OPTION_SETS[seed % OPTION_SETS.length];
			const seats = 2 + (seed % 5);
			const bots = Array.from({ length: seats }, (_, seat) => seat);
			let state = createDiceGame(game, options, seats, seed % seats);
			let steps = 0;
			while (state.phase === "playing") {
				const move = diceBotMove(game, options, state, bots);
				if (!move) {
					throw new Error(`seed ${seed}: no move at step ${steps}`);
				}
				state = applyDiceAction(
					game,
					options,
					state,
					move.seat,
					move.action,
					random,
				);
				steps += 1;
				if (steps > 20_000) {
					throw new Error(`seed ${seed}: game did not finish`);
				}
			}
			expect(state.winners.length).toBeGreaterThan(0);
			const best = Math.max(...state.scores);
			expect(best).toBeGreaterThanOrEqual(BASE.target);
			for (const winner of state.winners) {
				expect(state.scores[winner]).toBe(best);
			}
		}
	});

	it("starts its turn with a roll and only moves for its own seat", () => {
		const state = createDiceGame(game, [], 2);
		expect(diceBotMove(game, [], state, [1])).toBeNull();
		expect(diceBotMove(game, [], state, [0])).toEqual({
			seat: 0,
			action: { type: "roll", keep: [] },
			pace: "turn",
		});
	});

	it("banks a good total with few dice left, and rolls on with many", () => {
		const safe = diceBotMove(
			game,
			[],
			rolled([1, 2, 3, 4, 6, 6], { turnTotal: 900 }),
			[0],
		);
		expect(safe?.action.type).toBe("roll");
		const risky = diceBotMove(
			game,
			[],
			rolled([5, 2], { turnTotal: 900 }),
			[0],
		);
		expect(risky?.action).toEqual({ type: "bank", keep: [0] });
	});

	it("keeps rolling until it is on the board", () => {
		const move = diceBotMove(
			game,
			["opening500"],
			rolled([5, 2], { turnTotal: 300 }),
			[0],
		);
		expect(move?.action).toEqual({ type: "roll", keep: [0] });
	});

	it("chases the leader in the final round, and banks once past", () => {
		const behind = rolled([5, 2], {
			turn: 1,
			scores: [10_200, 9000],
			turnTotal: 900,
			finalRoundBy: 0,
		});
		expect(diceBotMove(game, [], behind, [1])?.action.type).toBe("roll");
		const past = { ...behind, turnTotal: 1300, dice: [5, 2, 3, 4, 6, 6] };
		expect(diceBotMove(game, [], past, [1])?.action).toEqual({
			type: "bank",
			keep: [0],
		});
	});

	it("banks the winning points when there is no final round", () => {
		const move = diceBotMove(
			game,
			["noFinalRound"],
			rolled([5, 2, 3, 4, 6, 6], { scores: [9950, 0] }),
			[0],
		);
		expect(move?.action).toEqual({ type: "bank", keep: [0] });
	});

	it("hands the next game's first turn round the table", () => {
		const state = createDiceGame(game, [], 3, 2);
		expect(DICE_ENGINE.nextStarter(state)).toBe(0);
	});
});

describe("10.000 table view", () => {
	const words = { dice: en.games.dice, fmt, locale: "en" };
	const seats = {
		seats: [
			{ botIndex: null, name: "Eric" },
			{ botIndex: 0, name: null },
		],
		you: 0,
	};

	it("tells the viewer what to do", () => {
		const view = (state: PushluckState) => viewDiceGame(game, [], state, 0);
		const fresh = createDiceGame(game, [], 2);
		expect(pushluckStep(view(fresh), 0)).toBe("start");
		expect(pushluckStep(view(fresh), 1)).toBe("waiting");
		expect(pushluckStep(view(fresh), null)).toBe("waiting");
		expect(pushluckStep(view(rolled([1, 2, 3, 4, 6, 6])), 0)).toBe("pick");
		expect(pushluckStep(view({ ...fresh, phase: "finished" }), 0)).toBe("over");
	});

	it("works out what the picked dice would do", () => {
		const view = viewDiceGame(
			game,
			["opening350"],
			rolled([1, 5, 2, 2, 2, 6], { turnTotal: 100 }),
			0,
		);
		expect(pushluckPick(view, [])).toMatchObject({
			problem: "pickFirst",
			canRoll: false,
			canBank: false,
		});
		expect(
			pushluckPick(view, [true, false, false, false, false, true]),
		).toMatchObject({ problem: "notScoring", canRoll: false });
		expect(pushluckPick(view, [true])).toMatchObject({
			points: 100,
			total: 200,
			rollCount: 5,
			canRoll: true,
			canBank: false,
			problem: "needOpening",
		});
		expect(
			pushluckPick(view, [true, true, true, true, true, false]),
		).toMatchObject({
			keep: [0, 1, 2, 3, 4],
			points: 350,
			total: 450,
			rollCount: 1,
			canBank: true,
			problem: null,
		});
		const hot = viewDiceGame(game, [], rolled([1, 5]), 0);
		expect(pushluckPick(hot, [true, true])).toMatchObject({
			hotDice: true,
			rollCount: 6,
		});
	});

	it("announces busts, banks and the final round", () => {
		let state = rolled([1, 2, 3, 4, 6, 6], { scores: [9950, 0] });
		state = act(state, { type: "bank", keep: [0] }, dice());
		expect(latestNews(words, seats, state.events)?.text).toBe(
			"You reached the target: final round",
		);
		const banked = act(
			rolled([1, 2, 3, 4, 6, 6]),
			{ type: "bank", keep: [0] },
			dice(),
		);
		expect(latestNews(words, seats, banked.events)?.text).toBe(
			"You banked 100, now 100",
		);
		state = act(
			rolled([1, 1, 1, 2, 3, 4], { turn: 1, turnTotal: 1500 }),
			{ type: "roll", keep: [0, 1, 2] },
			dice(2, 3, 4),
		);
		expect(latestNews(words, seats, state.events)?.text).toBe(
			"Anna bust and lost 2,500",
		);
		expect(
			latestNews(
				{ ...words, dice: nl.games.dice, locale: "nl" },
				seats,
				state.events,
			)?.text,
		).toBe("Anna gooide mis en verloor 2.500");
		expect(lastBust(viewDiceGame(game, [], state, 0))).toMatchObject({
			dice: [2, 3, 4],
		});
		expect(lastBust(viewDiceGame(game, [], rolled([1]), 0))).toBeNull();
		const firstRoll = act(
			createDiceGame(game, [], 2),
			{ type: "roll", keep: [] },
			dice(2, 2, 3, 4, 6, 6),
		);
		expect(latestNews(words, seats, firstRoll.events)?.text).toBe("You bust");
	});

	it("ranks seats by banked score", () => {
		const view = viewDiceGame(
			game,
			[],
			{ ...createDiceGame(game, [], 3), scores: [500, 2000, 500] },
			0,
		);
		expect(standings(view)).toEqual([
			{ seat: 1, total: 2000 },
			{ seat: 0, total: 500 },
			{ seat: 2, total: 500 },
		]);
	});

	it("words the rules for every house rule with no placeholder left", () => {
		for (const options of [
			[],
			[
				"opening350",
				"fixedKinds",
				"noThreePairs",
				"noStraight",
				"noFinalRound",
			],
		]) {
			for (const messages of [en, nl]) {
				const lines = pushluckRuleLines(
					{ dice: messages.games.dice, fmt },
					diceRules(game, options),
				);
				for (const line of [...lines.goal, ...lines.turn, ...lines.scoring]) {
					expect(line).not.toMatch(/[{}]/);
				}
			}
		}
		const fixed = pushluckRuleLines(words, FIXED);
		expect(fixed.scoring).toContain(
			"Four alike 1,000, five alike 2,000, six alike 3,000.",
		);
		expect(pushluckRuleLines(words, BASE).goal[0]).toBe(
			"Bank 10,000 points before anyone else.",
		);
	});

	it("names the game in both languages", () => {
		expect(en.games.dice.games.tienduizend.name).toBe("Ten Thousand");
		expect(nl.games.dice.games.tienduizend.name).toBe("10.000");
	});
});
