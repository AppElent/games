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
	chanceToBeat,
	type MexenAction,
	type MexenState,
	readThrow,
} from "../dice/mexen";
import {
	latestNews,
	mexenLivesPerRow,
	mexenStandings,
	mexenThrowLabel,
	mexenTurnStep,
} from "../dice/table-view";
import { GameRuleError } from "../errors";
import { en } from "../i18n/en";
import { fmt } from "../i18n/format";
import { mulberry32 } from "../random";

const mexen = DICE_GAMES.mexen;
const RULES = diceRules(mexen, []);

/** A generator that throws exactly these dice, in order. */
function rigged(...dice: number[]) {
	const queue = [...dice];
	return () => {
		const face = queue.shift();
		if (face === undefined) {
			throw new Error("rigged dice ran out");
		}
		return (face - 1) / 6 + 0.01;
	};
}

const ROLL: MexenAction = { type: "roll", keep: [] };
const STAND: MexenAction = { type: "stand" };

function act(
	state: MexenState,
	action: MexenAction,
	random = rigged(),
	options: string[] = [],
) {
	return applyDiceAction(mexen, options, state, state.turn, action, random);
}

/** Plays one round: each entry is a seat's throws, the last one kept. */
function playRound(
	state: MexenState,
	throws: number[][][],
	options: string[] = [],
) {
	let next = state;
	for (const seatThrows of throws) {
		const seat = next.turn;
		for (const [index, dice] of seatThrows.entries()) {
			next = act(next, ROLL, rigged(...dice), options);
			const last = index === seatThrows.length - 1;
			if (last && next.turn === seat && next.rollsUsed > 0) {
				next = act(next, STAND, rigged(), options);
			}
		}
	}
	return next;
}

function code(run: () => unknown) {
	try {
		run();
	} catch (error) {
		if (error instanceof GameRuleError) {
			return error.code;
		}
		throw error;
	}
	return null;
}

describe("Mexen throws", () => {
	it("reads the high die as tens", () => {
		expect(readThrow([3, 6], RULES)).toEqual({
			kind: "plain",
			value: 63,
			rank: 63,
		});
		expect(readThrow([1, 3], RULES).value).toBe(31);
	});

	it("ranks Mex over doubles over plain numbers", () => {
		const order = [
			[2, 1],
			[6, 6],
			[5, 5],
			[1, 1],
			[6, 5],
			[6, 1],
			[5, 4],
			[3, 2],
			[3, 1],
		].map((dice) => readThrow(dice, RULES));
		expect(order[0].kind).toBe("mex");
		for (let index = 1; index < order.length; index += 1) {
			expect(order[index - 1].rank).toBeGreaterThan(order[index].rank);
		}
		expect(readThrow([1, 2], RULES).rank).toBe(readThrow([2, 1], RULES).rank);
	});

	it("puts Little Mex between Mex and the doubles only when it is on", () => {
		const little = diceRules(mexen, ["littleMex"]);
		expect(readThrow([3, 1], RULES).kind).toBe("plain");
		const read = readThrow([1, 3], little);
		expect(read.kind).toBe("littleMex");
		expect(read.rank).toBeLessThan(readThrow([2, 1], little).rank);
		expect(read.rank).toBeGreaterThan(readThrow([6, 6], little).rank);
	});

	it("knows how likely a fresh throw beats one", () => {
		expect(chanceToBeat(RULES, readThrow([2, 1], RULES).rank)).toBe(0);
		// Only Mex (2 of 36) beats double six.
		expect(chanceToBeat(RULES, readThrow([6, 6], RULES).rank)).toBeCloseTo(
			2 / 36,
		);
	});

	it("names throws for people", () => {
		const dice = en.games.dice;
		const label = (values: number[]) =>
			mexenThrowLabel(dice, fmt, readThrow(values, RULES));
		expect(label([2, 1])).toBe("Mex");
		expect(label([4, 4])).toBe("Double 4");
		expect(label([3, 6])).toBe("63");
	});
});

describe("a Mexen round", () => {
	it("starts every player with six lives and the starter leading", () => {
		const state = createDiceGame(mexen, [], 3, 1);
		const view = viewDiceGame(mexen, [], state, 0);
		expect(view.livesLeft).toEqual([6, 6, 6]);
		expect(view.turn).toBe(1);
		expect(view.leader).toBe(1);
		expect(view.order).toEqual([1, 2, 0]);
		expect(view.throwCap).toBe(3);
		expect(view.limitSet).toBe(false);
	});

	it("caps everyone at the number of throws the leader used", () => {
		let state = createDiceGame(mexen, [], 3);
		state = act(state, ROLL, rigged(6, 3));
		state = act(state, ROLL, rigged(5, 4));
		state = act(state, STAND);
		expect(state.limit).toBe(2);
		expect(state.turn).toBe(1);
		expect(viewDiceGame(mexen, [], state, 1).throwCap).toBe(2);
		state = act(state, ROLL, rigged(3, 2));
		// The second throw is the last allowed, so it is kept without asking.
		state = act(state, ROLL, rigged(4, 1));
		expect(state.results[1]).toEqual([4, 1]);
		expect(state.turn).toBe(2);
		expect(code(() => act(state, STAND))).toBe("diceRollFirst");
	});

	it("keeps the last throw, not the best one", () => {
		let state = createDiceGame(mexen, [], 2);
		state = act(state, ROLL, rigged(6, 6));
		state = act(state, ROLL, rigged(3, 2));
		state = act(state, STAND);
		expect(state.results[0]).toEqual([3, 2]);
	});

	it("keeps the leader's third throw without asking", () => {
		let state = createDiceGame(mexen, [], 2);
		state = act(state, ROLL, rigged(4, 2));
		state = act(state, ROLL, rigged(4, 3));
		state = act(state, ROLL, rigged(5, 2));
		expect(state.results[0]).toEqual([5, 2]);
		expect(state.limit).toBe(3);
		expect(state.turn).toBe(1);
		// The dice leave the table, but the kept throw still shows.
		const view = viewDiceGame(mexen, [], state, 1);
		expect(view.dice).toEqual([]);
		expect(view.lastKept).toMatchObject({
			seat: 0,
			dice: [5, 2],
			kind: "plain",
			value: 52,
		});
	});

	it("costs the lowest throw a life, and the loser leads the next round", () => {
		let state = createDiceGame(mexen, [], 3);
		state = playRound(state, [[[6, 5]], [[4, 3]], [[5, 5]]]);
		expect(state.penalties).toEqual([0, 1, 0]);
		expect(state.round).toBe(2);
		expect(state.leader).toBe(1);
		expect(state.turn).toBe(1);
		expect(state.order).toEqual([1, 2, 0]);
		expect(state.results).toEqual([null, null, null]);
		expect(state.limit).toBeNull();
		// The round ended on seat 2's throw; it shows until seat 1 throws.
		expect(viewDiceGame(mexen, [], state, 1).lastKept).toMatchObject({
			seat: 2,
			dice: [5, 5],
		});
		state = act(state, ROLL, rigged(6, 1));
		expect(viewDiceGame(mexen, [], state, 1).lastKept).toBeNull();
	});

	it("doubles the loss in a round with a Mex", () => {
		let state = createDiceGame(mexen, [], 2);
		state = playRound(state, [[[2, 1]], [[6, 6]]]);
		expect(state.penalties).toEqual([0, 2]);
	});

	it("costs one with the Mex-costs-one house rule", () => {
		let state = createDiceGame(mexen, ["mexSingle"], 2);
		state = playRound(state, [[[1, 2]], [[6, 6]]], ["mexSingle"]);
		expect(state.penalties).toEqual([0, 1]);
	});

	it("throws off ties for lowest, one throw each, until one is lowest", () => {
		let state = createDiceGame(mexen, [], 3);
		state = playRound(state, [[[4, 2]], [[6, 5]], [[2, 4]]]);
		expect(state.throwOff).toBe(true);
		expect(state.order).toEqual([0, 2]);
		expect(state.turn).toBe(0);
		expect(state.results[1]).toEqual([6, 5]);
		expect(viewDiceGame(mexen, [], state, 0).throwCap).toBe(1);
		// Tied again: another throw-off between the same two.
		state = act(state, ROLL, rigged(5, 3));
		state = act(state, ROLL, rigged(3, 5));
		expect(state.throwOff).toBe(true);
		expect(state.order).toEqual([0, 2]);
		expect(state.penalties).toEqual([0, 0, 0]);
		state = act(state, ROLL, rigged(3, 3));
		state = act(state, ROLL, rigged(6, 4));
		expect(state.penalties).toEqual([0, 0, 1]);
		expect(state.throwOff).toBe(false);
		expect(state.leader).toBe(2);
		expect(state.events.some((event) => event.type === "mexenThrowOff")).toBe(
			true,
		);
	});

	it("still doubles the loss when the Mex came before a throw-off", () => {
		let state = createDiceGame(mexen, [], 3);
		state = playRound(state, [[[2, 1]], [[4, 1]], [[1, 4]]]);
		expect(state.throwOff).toBe(true);
		state = act(state, ROLL, rigged(5, 1));
		state = act(state, ROLL, rigged(6, 1));
		expect(state.penalties).toEqual([0, 2, 0]);
	});

	it("refuses moves out of turn, kept dice, and a stand before a throw", () => {
		const state = createDiceGame(mexen, [], 2);
		expect(
			code(() => applyDiceAction(mexen, [], state, 1, ROLL, rigged(1, 1))),
		).toBe("notYourTurn");
		expect(
			code(() => act(state, { type: "roll", keep: [0] }, rigged(1, 1))),
		).toBe("diceInvalidHold");
		expect(code(() => act(state, STAND))).toBe("diceRollFirst");
		expect(
			code(() =>
				applyDiceAction(
					mexen,
					[],
					state,
					0,
					{ type: "score", category: "chance" },
					rigged(),
				),
			),
		).toBe("cardsWrongAction");
		// Nothing above touched the state.
		expect(state.rollsUsed).toBe(0);
		expect(state.events).toEqual([]);
	});

	it("refuses a Mexen move in Yatzy", () => {
		const yatzy = createDiceGame(DICE_GAMES.yatzy, [], 1);
		expect(
			code(() =>
				applyDiceAction(DICE_GAMES.yatzy, [], yatzy, 0, STAND, rigged()),
			),
		).toBe("cardsWrongAction");
	});
});

describe("Mexen lives and the end", () => {
	it("drops a player with no lives left and skips them", () => {
		let state = createDiceGame(mexen, ["lives3"], 3);
		const opts = ["lives3"];
		for (let round = 0; round < 3; round += 1) {
			// Seat 1 always throws lowest; as leader it throws first.
			const throws =
				state.leader === 1
					? [[[3, 2]], [[6, 5]], [[6, 4]]]
					: [[[6, 5]], [[3, 2]], [[6, 4]]];
			state = playRound(state, throws, opts);
		}
		const view = viewDiceGame(mexen, opts, state, 0);
		expect(view.livesLeft).toEqual([3, 0, 3]);
		expect(view.out).toEqual([false, true, false]);
		expect(state.phase).toBe("playing");
		// Seat 1 dropped out leading, so the next seat still in leads.
		expect(state.leader).toBe(2);
		expect(state.order).toEqual([2, 0]);
		const lose = [...state.events]
			.reverse()
			.find((event) => event.type === "mexenLose");
		expect(lose).toMatchObject({ seat: 1, out: true, unit: "lives" });

		// Seat 0 goes out later, on a doubled loss: more lives lost, but it
		// outlasted seat 1, so it ranks above it.
		state = playRound(state, [[[6, 5]], [[3, 2]]], opts);
		state = playRound(state, [[[3, 2]], [[6, 5]]], opts);
		state = playRound(state, [[[4, 1]], [[2, 1]]], opts);
		expect(state.phase).toBe("finished");
		expect(state.penalties).toEqual([4, 3, 0]);
		expect(state.eliminated).toEqual([1, 0]);
		expect(mexenStandings(viewDiceGame(mexen, opts, state, 0))).toEqual([
			2, 0, 1,
		]);
	});

	it("ends when one player has lives left, and they win", () => {
		let state = createDiceGame(mexen, ["lives3"], 2);
		const opts = ["lives3"];
		// A Mex each round: seat 1 loses two lives, then the rest.
		state = playRound(state, [[[2, 1]], [[3, 2]]], opts);
		expect(state.penalties).toEqual([0, 2]);
		state = playRound(state, [[[4, 1]], [[6, 6]]], opts);
		expect(state.phase).toBe("finished");
		expect(state.winners).toEqual([0]);
		expect(DICE_ENGINE.outcome(state)).toEqual({
			finished: true,
			winners: [0],
		});
		expect(code(() => act(state, ROLL, rigged(1, 1), opts))).toBe(
			"noActiveGame",
		);
		const view = viewDiceGame(mexen, opts, state, 0);
		expect(mexenTurnStep(view, 0)).toBe("over");
		expect(mexenStandings(view)).toEqual([0, 1]);
		expect(view.livesLeft).toEqual([3, 0]);
	});

	it("goes to the point limit in points mode, and the fewest points win", () => {
		const opts = ["points", "lives3"];
		let state = createDiceGame(mexen, opts, 3);
		const lowest = [1, 2, 1, 1];
		for (const loser of lowest) {
			const throws = state.order.map((seat) =>
				seat === loser ? [[3, 2]] : [[6, seat + 1 === 6 ? 5 : seat + 1]],
			);
			state = playRound(state, throws, opts);
		}
		expect(state.penalties).toEqual([0, 3, 1]);
		expect(state.phase).toBe("finished");
		expect(state.winners).toEqual([0]);
		const view = viewDiceGame(mexen, opts, state, null);
		expect(view.out).toEqual([false, false, false]);
		expect(mexenStandings(view)).toEqual([0, 2, 1]);
	});

	it("starts with 10 lives under that house rule", () => {
		const state = createDiceGame(mexen, ["lives10"], 2);
		expect(viewDiceGame(mexen, ["lives10"], state, 0).livesLeft).toEqual([
			10, 10,
		]);
		expect(
			code(() => DICE_ENGINE.normalizeOptions("mexen", ["lives3", "lives10"])),
		).toBe("cardsOptionsClash");
	});

	it("needs two to eight players", () => {
		expect(code(() => createDiceGame(mexen, [], 1))).toBe("notEnoughPlayers");
		expect(code(() => createDiceGame(mexen, [], 9))).toBe("notEnoughPlayers");
		expect(createDiceGame(mexen, [], 8).seats).toBe(8);
	});
});

describe("Mexen views and news", () => {
	it("draws up to six lives on one row and more in two even rows", () => {
		expect(mexenLivesPerRow(3)).toBe(3);
		expect(mexenLivesPerRow(6)).toBe(6);
		expect(mexenLivesPerRow(10)).toBe(5);
	});

	it("tells the player on turn what to do", () => {
		let state = createDiceGame(mexen, [], 2);
		let view = viewDiceGame(mexen, [], state, 0);
		expect(mexenTurnStep(view, 0)).toBe("start");
		expect(mexenTurnStep(view, 1)).toBe("waiting");
		expect(mexenTurnStep(view, null)).toBe("waiting");
		state = act(state, ROLL, rigged(6, 3));
		view = viewDiceGame(mexen, [], state, 0);
		expect(mexenTurnStep(view, 0)).toBe("decide");
		expect(view.current).toMatchObject({ kind: "plain", value: 63 });
	});

	it("reads a kept throw and the round's loss out together", () => {
		const table = {
			seats: [
				{ botIndex: null, name: "Ann" },
				{ botIndex: null, name: "Bo" },
			],
			you: null,
		};
		let state = createDiceGame(mexen, [], 2);
		state = act(state, ROLL, rigged(6, 3));
		const dice = en.games.dice;
		expect(latestNews({ dice, fmt }, table, state.events)?.text).toBe(
			"Ann rolled 6, 3",
		);
		state = act(state, STAND);
		expect(latestNews({ dice, fmt }, table, state.events)?.text).toBe(
			"Ann keeps 63",
		);
		state = playRound(state, [[[2, 1]]]);
		expect(latestNews({ dice, fmt }, table, state.events)?.text).toBe(
			"Bo keeps Mex. Ann loses 2 lives",
		);
	});
});

/** Plays a whole game with bots in every seat; returns the final state. */
function playOut(options: string[], seats: number, seed: number) {
	const bots = Array.from({ length: seats }, (_, seat) => seat);
	const random = mulberry32(seed);
	let state = createDiceGame(mexen, options, seats, seed % seats);
	for (let step = 0; step < 20_000; step += 1) {
		const move = diceBotMove(mexen, options, state, bots);
		if (!move) {
			break;
		}
		state = applyDiceAction(
			mexen,
			options,
			state,
			move.seat,
			move.action,
			random,
		);
	}
	return state;
}

describe("Mexen bots", () => {
	const SETS = [
		[],
		["lives3"],
		["lives10", "littleMex"],
		["points"],
		["mexSingle", "points", "lives3"],
	];

	it("finish games over many seeds and every house rule", () => {
		for (let seed = 1; seed <= 60; seed += 1) {
			const options = SETS[seed % SETS.length];
			const seats = 2 + (seed % 7);
			const state = playOut(options, seats, seed);
			expect(state.phase).toBe("finished");
			expect(state.winners.length).toBeGreaterThan(0);
			const rules = diceRules(mexen, options);
			if (rules.scoring === "lives") {
				expect(state.winners).toHaveLength(1);
				const alive = state.penalties.filter((lost) => lost < rules.lives);
				expect(alive).toHaveLength(1);
			} else {
				expect(Math.max(...state.penalties)).toBeGreaterThanOrEqual(
					rules.lives,
				);
			}
		}
	});

	it("stands on a throw that cannot lose, and throws again when lowest", () => {
		let state = createDiceGame(mexen, [], 3);
		state = act(state, ROLL, rigged(4, 2));
		state = act(state, ROLL, rigged(4, 3));
		state = act(state, STAND);
		state = act(state, ROLL, rigged(5, 1));
		expect(diceBotMove(mexen, [], state, [1])?.action).toEqual(STAND);
		state = act(state, STAND);
		state = act(state, ROLL, rigged(3, 2));
		expect(diceBotMove(mexen, [], state, [2])?.action).toEqual(ROLL);
	});

	it("leads by standing on a strong first throw and rethrowing a weak one", () => {
		let state = createDiceGame(mexen, [], 2);
		state = act(state, ROLL, rigged(5, 5));
		expect(diceBotMove(mexen, [], state, [0])?.action).toEqual(STAND);
		state = createDiceGame(mexen, [], 2);
		state = act(state, ROLL, rigged(4, 1));
		expect(diceBotMove(mexen, [], state, [0])?.action).toEqual(ROLL);
		expect(diceBotMove(mexen, [], state, [1])).toBeNull();
	});

	it("hands the next game's first turn round the table", () => {
		const state = createDiceGame(mexen, [], 3, 2);
		expect(DICE_ENGINE.nextStarter(state)).toBe(0);
	});
});
