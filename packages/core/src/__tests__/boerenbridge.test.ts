import { describe, expect, it } from "vitest";
import { parseCard } from "../cards/deck";
import {
	applyCardAction,
	botMove,
	type CardAction,
	createCardGame,
	getCardGame,
	normalizeOptions,
	resolvedRules,
	viewCardGame,
} from "../cards/engine";
import {
	blockedBid,
	chooseBid,
	chooseBidCard,
	dealsInMatch,
	estimateBid,
	handSizeFor,
	legalBids,
	type TricksRules,
	type TricksState,
	type TricksView,
} from "../cards/tricks";
import { GameRuleError } from "../errors";
import { mulberry32 } from "../random";
import { toggleHouseRule } from "../table-engine";

const game = getCardGame("boerenbridge");

function rulesWith(options: string[] = []): TricksRules {
	const resolved = resolvedRules(game, options, null);
	if (resolved.family !== "tricks") {
		throw new Error("boerenbridge plays tricks");
	}
	return resolved.rules;
}

function start(seats: number, seed = 1, options: string[] = []) {
	return createCardGame(game, options, seats, mulberry32(seed)) as TricksState;
}

function act(
	state: TricksState,
	seat: number,
	action: CardAction,
	options: string[] = [],
) {
	return applyCardAction(
		game,
		options,
		state,
		seat,
		action,
		mulberry32(2),
	) as TricksState;
}

function view(state: TricksState, seat: number | null, options: string[] = []) {
	return viewCardGame(game, options, state, seat) as TricksView;
}

function expectRule(action: () => unknown, code: string) {
	try {
		action();
	} catch (caught) {
		expect(caught).toBeInstanceOf(GameRuleError);
		expect((caught as GameRuleError).code).toBe(code);
		return;
	}
	throw new Error(`expected rule error ${code}`);
}

/** A deal of hand-picked cards, waiting for bids from the seat left of the dealer. */
function bidding(
	hands: string[][],
	overrides: Partial<TricksState> = {},
): TricksState {
	const base = start(hands.length);
	return {
		...base,
		hands,
		dealer: hands.length - 1,
		turn: 0,
		phase: "bidding",
		bids: hands.map(() => null),
		trump: "H",
		turnedUp: "H2#0",
		taken: hands.map(() => []),
		tricksTaken: hands.map(() => 0),
		events: [],
		...overrides,
	};
}

describe("the round schedule", () => {
	it.each([
		[3, 17],
		[4, 13],
		[5, 10],
		[6, 8],
		[7, 7],
	])("%i seats go 1 up to %i cards and back down", (seats, most) => {
		const rules = rulesWith();
		const sizes = Array.from({ length: most * 2 - 1 }, (_, index) =>
			handSizeFor(rules, seats, index + 1),
		);
		expect(sizes).toEqual([
			...Array.from({ length: most }, (_, index) => index + 1),
			...Array.from({ length: most - 1 }, (_, index) => most - 1 - index),
		]);
		expect(handSizeFor(rules, seats, most * 2)).toBeNull();
		expect(dealsInMatch(rules, seats)).toBe(most * 2 - 1);
	});

	it("only goes up, or only down, under the house rules", () => {
		const up = rulesWith(["upOnly"]);
		const down = rulesWith(["downOnly"]);
		expect(dealsInMatch(up, 5)).toBe(10);
		expect([1, 2, 10].map((round) => handSizeFor(up, 5, round))).toEqual([
			1, 2, 10,
		]);
		expect(dealsInMatch(down, 5)).toBe(10);
		expect([1, 2, 10].map((round) => handSizeFor(down, 5, round))).toEqual([
			10, 9, 1,
		]);
	});

	it("caps the hand at seven cards under shortHands, with any schedule", () => {
		const base = rulesWith([]);
		expect(dealsInMatch(base, 3)).toBe(33);
		const short = rulesWith(["shortHands"]);
		expect(dealsInMatch(short, 3)).toBe(13);
		expect([1, 7, 8, 13].map((round) => handSizeFor(short, 3, round))).toEqual([
			1, 7, 6, 1,
		]);
		expect(handSizeFor(short, 3, 14)).toBeNull();
		// It combines with the other schedules, and changes nothing where the deck
		// already deals no more than seven (seven players deal seven at most).
		expect(dealsInMatch(rulesWith(["shortHands", "upOnly"]), 3)).toBe(7);
		expect(handSizeFor(rulesWith(["shortHands", "downOnly"]), 3, 1)).toBe(7);
		expect(dealsInMatch(short, 7)).toBe(dealsInMatch(base, 7));
		expect(normalizeOptions(game, ["shortHands", "upOnly"])).toEqual([
			"upOnly",
			"shortHands",
		]);
	});

	it("can't have both house rules: switching one on switches the other off", () => {
		expect(toggleHouseRule(game.options, ["upOnly"], "downOnly")).toEqual([
			"downOnly",
		]);
		expect(
			toggleHouseRule(game.options, ["upOnly", "dealerFree"], "upOnly"),
		).toEqual(["dealerFree"]);
		expectRule(
			() => normalizeOptions(game, ["upOnly", "downOnly"]),
			"cardsOptionsClash",
		);
		expect(normalizeOptions(game, ["dealerFree", "upOnly"])).toEqual([
			"upOnly",
			"dealerFree",
		]);
	});

	it("deals the scheduled number of cards each round", () => {
		let state = start(4, 3);
		expect(state.hands.map((hand) => hand.length)).toEqual([1, 1, 1, 1]);
		expect(state.round).toBe(1);
		state = { ...state, phase: "roundOver", scores: [[0, 0, 0, 0]] };
		state = act(state, 0, { type: "nextRound" });
		expect(state.hands.map((hand) => hand.length)).toEqual([2, 2, 2, 2]);
	});
});

describe("trump", () => {
	it("is turned up from the cards left over, and everyone sees it", () => {
		const state = start(5, 4);
		const dealt = state.hands.flat();
		expect(state.turnedUp).toBeTruthy();
		expect(dealt).not.toContain(state.turnedUp);
		expect(state.trump).toBe(parseCard(state.turnedUp as string).suit);
		expect(view(state, null).turnedUp).toBe(state.turnedUp);
	});

	it("is none when the deck deals out exactly", () => {
		const rules = rulesWith(["downOnly"]);
		expect(handSizeFor(rules, 4, 1)).toBe(13);
		const state = start(4, 5, ["downOnly"]);
		expect(state.hands.flat()).toHaveLength(52);
		expect(state.trump).toBeNull();
		expect(state.turnedUp).toBeNull();
	});

	it("beats the suit led", () => {
		let state = bidding([["S9#0"], ["H2#0"], ["SA#0"]], {
			bids: [0, 1, 0],
			phase: "playing",
			turn: 0,
		});
		state = act(state, 0, { type: "play", card: "S9#0" });
		state = act(state, 1, { type: "play", card: "H2#0" });
		state = act(state, 2, { type: "play", card: "SA#0" });
		expect(state.tricksTaken).toEqual([0, 1, 0]);
	});
});

describe("bidding", () => {
	const hands = [
		["SA#0", "S2#0"],
		["HA#0", "D3#0"],
		["CK#0", "C4#0"],
	];

	it("goes round from left of the dealer, who bids last, then left of the dealer leads", () => {
		let state = start(3, 7);
		expect(state.phase).toBe("bidding");
		const first = (state.dealer + 1) % 3;
		expect(state.turn).toBe(first);
		for (let step = 0; step < 3; step += 1) {
			state = act(state, state.turn, {
				type: "bid",
				count: legalBids(rulesWith(), state, state.turn)[0],
			});
		}
		expect(state.phase).toBe("playing");
		expect(state.turn).toBe(first);
		expect(state.events.filter((event) => event.type === "bid")).toHaveLength(
			3,
		);
	});

	it("refuses bids out of turn, out of range, and outside the bidding", () => {
		const state = bidding(hands);
		expectRule(() => act(state, 1, { type: "bid", count: 1 }), "notYourTurn");
		expectRule(() => act(state, 0, { type: "bid", count: 3 }), "cardsBidRange");
		expectRule(
			() => act(state, 0, { type: "bid", count: -1 }),
			"cardsBidRange",
		);
		expectRule(
			() => act(state, 0, { type: "bid", count: 1.5 }),
			"cardsBidRange",
		);
		expectRule(
			() => act(state, 0, { type: "play", card: "SA#0" }),
			"cardsBidFirst",
		);
		const played = { ...state, phase: "playing" as const, bids: [1, 0, 1] };
		expectRule(
			() => act(played, 0, { type: "bid", count: 1 }),
			"cardsNotBidding",
		);
	});

	it("won't let the dealer make the bids add up", () => {
		let state = bidding(hands);
		state = act(state, 0, { type: "bid", count: 1 });
		state = act(state, 1, { type: "bid", count: 0 });
		expect(blockedBid(rulesWith(), state)).toBe(1);
		expect(legalBids(rulesWith(), state, 2)).toEqual([0, 2]);
		expect(view(state, 2).blockedBid).toBe(1);
		expectRule(
			() => act(state, 2, { type: "bid", count: 1 }),
			"cardsDealerBid",
		);
		expect(act(state, 2, { type: "bid", count: 2 }).phase).toBe("playing");
	});

	it("blocks a bid of none, or of every trick, when that adds up", () => {
		for (const [first, second, blocked, allowed] of [
			[1, 1, 0, [1, 2]],
			[0, 0, 2, [0, 1]],
		] as const) {
			let state = bidding(hands);
			state = act(state, 0, { type: "bid", count: first });
			state = act(state, 1, { type: "bid", count: second });
			expect(legalBids(rulesWith(), state, 2)).toEqual(allowed);
			expectRule(
				() => act(state, 2, { type: "bid", count: blocked }),
				"cardsDealerBid",
			);
		}
	});

	it("blocks nothing when the others already bid past the tricks", () => {
		let state = bidding(hands);
		state = act(state, 0, { type: "bid", count: 2 });
		state = act(state, 1, { type: "bid", count: 2 });
		expect(blockedBid(rulesWith(), state)).toBeNull();
		expect(legalBids(rulesWith(), state, 2)).toEqual([0, 1, 2]);
	});

	it("lets the dealer bid anything under the house rule", () => {
		const options = ["dealerFree"];
		let state = bidding(hands);
		state = act(state, 0, { type: "bid", count: 1 }, options);
		state = act(state, 1, { type: "bid", count: 0 }, options);
		expect(blockedBid(rulesWith(options), state)).toBeNull();
		expect(act(state, 2, { type: "bid", count: 1 }, options).phase).toBe(
			"playing",
		);
	});
});

describe("scoring", () => {
	it("scores 10 plus 2 a trick for a bid met, and 2 off a trick for a miss", () => {
		// Hearts are trump; seat 0 bid 1 and takes one, seat 1 bid 0 and takes
		// one, seat 2 bid 1 and takes none.
		let state = bidding([["SA#0"], ["H3#0"], ["S2#0"]], {
			bids: [1, 0, 1],
			phase: "playing",
			turn: 0,
		});
		state = act(state, 0, { type: "play", card: "SA#0" });
		state = act(state, 1, { type: "play", card: "H3#0" });
		state = act(state, 2, { type: "play", card: "S2#0" });
		expect(state.scores.at(-1)).toEqual([-2, -2, -2]);

		let met = bidding([["SA#0"], ["S3#0"], ["S2#0"]], {
			bids: [1, 0, 0],
			phase: "playing",
			turn: 0,
		});
		for (const card of ["SA#0", "S3#0", "S2#0"]) {
			met = act(met, met.turn, { type: "play", card });
		}
		expect(met.scores.at(-1)).toEqual([12, 10, 10]);
		expect(met.phase).toBe("roundOver");
	});

	it("loses 2 for every trick off, either way", () => {
		let state = bidding(
			[
				["SA#0", "SK#0", "SQ#0"],
				["S2#0", "S3#0", "S4#0"],
				["C2#0", "C3#0", "C4#0"],
			],
			{ bids: [0, 3, 1], phase: "playing", turn: 0 },
		);
		for (let trick = 0; trick < 3; trick += 1) {
			for (let play = 0; play < 3; play += 1) {
				state = act(state, state.turn, {
					type: "play",
					card: view(state, state.turn).legal[0],
				});
			}
		}
		expect(state.tricksTaken).toEqual([3, 0, 0]);
		expect(state.scores.at(-1)).toEqual([-6, -6, -2]);
	});

	it("ends after the last scheduled round, and the highest total wins", () => {
		const rules = rulesWith(["upOnly"]);
		const last = dealsInMatch(rules, 3) as number;
		let state = bidding([["SA#0"], ["S3#0"], ["S2#0"]], {
			bids: [1, 0, 1],
			phase: "playing",
			turn: 0,
			round: last,
			scores: [[0, 5, 0]],
		});
		const options = ["upOnly"];
		for (const card of ["SA#0", "S3#0", "S2#0"]) {
			state = act(state, state.turn, { type: "play", card }, options);
		}
		// Round scores 12, 10, -2 on top of 0, 5, 0.
		expect(state.phase).toBe("finished");
		expect(state.winners).toEqual([1]);
	});

	it("shares the win between tied highest totals", () => {
		const options = ["upOnly"];
		let state = bidding([["SA#0"], ["S3#0"], ["S2#0"]], {
			bids: [1, 0, 1],
			phase: "playing",
			turn: 0,
			round: dealsInMatch(rulesWith(options), 3) as number,
			scores: [[5, 7, 0]],
		});
		for (const card of ["SA#0", "S3#0", "S2#0"]) {
			state = act(state, state.turn, { type: "play", card }, options);
		}
		// Round scores 12, 10, -2 on top of 5, 7, 0: 17, 17, -2.
		expect(state.winners).toEqual([0, 1]);
	});
});

describe("views keep hands private and bids public", () => {
	it("shows only your own hand, and everyone's bids and the turned-up card", () => {
		let state = start(4, 11);
		state = { ...state, phase: "roundOver", scores: [[0, 0, 0, 0]], round: 4 };
		state = act(state, 0, { type: "nextRound" });
		state = act(state, state.turn, { type: "bid", count: 2 });
		const mine = view(state, 0);
		const serialized = JSON.stringify(mine);
		for (const seat of [1, 2, 3]) {
			for (const card of state.hands[seat]) {
				expect(serialized).not.toContain(`"${card}"`);
			}
		}
		expect(mine.hand).toEqual(state.hands[0]);
		expect(mine.bids?.filter((bid) => bid !== null)).toEqual([2]);
		expect(mine.handSize).toBe(5);
		expect(mine.deals).toBe(25);
		const spectator = view(state, null);
		expect(spectator.hand).toEqual([]);
		expect(spectator.legalBids).toEqual([]);
		expect(spectator.turnedUp).toBe(state.turnedUp);
	});

	it("offers bids only to the seat whose turn it is", () => {
		const state = start(3, 12);
		const other = (state.turn + 1) % 3;
		expect(view(state, state.turn).legalBids).toEqual([0, 1]);
		expect(view(state, other).legalBids).toEqual([]);
	});
});

describe("the computer player", () => {
	it("counts high trumps and aces as tricks", () => {
		const rules = rulesWith();
		expect(
			estimateBid(rules, ["HA#0", "HK#0", "SA#0", "C2#0", "D3#0"], "H", 4),
		).toBe(3);
		expect(estimateBid(rules, ["C2#0", "D3#0", "S4#0"], "H", 4)).toBe(0);
	});

	it("bids the nearest allowed number as dealer", () => {
		const rules = rulesWith();
		let state = bidding([["HA#0"], ["S3#0"], ["S2#0"]]);
		state = act(state, 0, { type: "bid", count: 0 });
		state = act(state, 1, { type: "bid", count: 0 });
		// One is blocked, and zero is what this weak hand wants anyway.
		expect(chooseBid(rules, state, 2)).toBe(0);
		const pushed = bidding([["S3#0"], ["S2#0"], ["C3#0"]]);
		let next = act(pushed, 0, { type: "bid", count: 1 });
		next = act(next, 1, { type: "bid", count: 0 });
		// Zero is what it wants, and zero would make 1 of 1: it must go up.
		expect(estimateBid(rules, next.hands[2], "H", 3)).toBe(0);
		expect(chooseBid(rules, next, 2)).toBe(1);
	});

	it("wins cheaply when short of its bid, and ducks once it has it", () => {
		const rules = rulesWith();
		const trick = [{ seat: 0, card: "S9#0" }];
		const hand = ["S10#0", "SA#0", "S2#0"];
		const short = bidding([["S9#0"], hand, ["C2#0"]], {
			phase: "playing",
			turn: 1,
			bids: [0, 1, 0],
			trick,
		});
		expect(chooseBidCard(rules, short, 1)).toBe("S10#0");
		const made = { ...short, bids: [0, 0, 0] };
		expect(chooseBidCard(rules, made, 1)).toBe("S2#0");
	});

	it("bids and plays only legal moves, and finishes every match", () => {
		for (const options of [[], ["upOnly"], ["downOnly", "dealerFree"]]) {
			for (const seats of [3, 4, 5, 6, 7]) {
				for (let seed = 1; seed <= 6; seed += 1) {
					const random = mulberry32(seed * 101 + seats);
					let state = createCardGame(
						game,
						options,
						seats,
						random,
					) as TricksState;
					const everyone = Array.from({ length: seats }, (_, seat) => seat);
					let steps = 0;
					while (state.phase !== "finished") {
						const move = botMove(game, options, state, everyone, random);
						if (!move) {
							throw new Error(`bot stuck in ${state.phase}`);
						}
						state = applyCardAction(
							game,
							options,
							state,
							move.seat,
							move.action,
							random,
						) as TricksState;
						steps += 1;
						expect(steps).toBeLessThan(20_000);
					}
					expect(state.scores).toHaveLength(
						dealsInMatch(rulesWith(options), seats) as number,
					);
					const totals = state.scores.reduce(
						(sum, round) => sum.map((total, seat) => total + round[seat]),
						Array(seats).fill(0) as number[],
					);
					expect(state.winners.map((seat) => totals[seat])).toEqual(
						state.winners.map(() => Math.max(...totals)),
					);
				}
			}
		}
	}, 60_000);

	it("meets its bid often enough to be a fair opponent", () => {
		let met = 0;
		let bids = 0;
		for (let seed = 1; seed <= 10; seed += 1) {
			const random = mulberry32(seed);
			let state = createCardGame(game, [], 4, random) as TricksState;
			const everyone = [0, 1, 2, 3];
			while (state.phase !== "finished") {
				const move = botMove(game, [], state, everyone, random);
				if (!move) throw new Error("stuck");
				const before = state;
				state = applyCardAction(
					game,
					[],
					state,
					move.seat,
					move.action,
					random,
				) as TricksState;
				if (before.phase === "playing" && state.phase !== "playing") {
					before.bids?.forEach((bid, seat) => {
						bids += 1;
						if (bid === state.tricksTaken[seat]) met += 1;
					});
				}
			}
		}
		expect(met / bids).toBeGreaterThan(0.4);
	});
});
