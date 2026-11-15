import { describe, expect, it } from "vitest";
import {
	applyCardAction,
	botMove,
	type CardAction,
	createCardGame,
	getCardGame,
	resolvedRules,
	viewCardGame,
} from "../cards/engine";
import {
	botTricksMove,
	chooseTricksCard,
	createTricks,
	type TricksRules,
	type TricksState,
	type TricksView,
	tricksDeck,
	trickWinner,
	wantsKnock,
	wantsToStay,
} from "../cards/tricks";
import { GameRuleError } from "../errors";
import { mulberry32 } from "../random";

const game = getCardGame("toepen");

function rulesWith(options: string[] = []): TricksRules {
	const resolved = resolvedRules(game, options);
	if (resolved.family !== "tricks") {
		throw new Error("toepen plays tricks");
	}
	return resolved.rules;
}

/** A deal under way with hands chosen by the test; seat 0 leads. */
function dealt(
	hands: string[][],
	overrides: Partial<TricksState> = {},
	options: string[] = [],
): TricksState {
	const base = createTricks(rulesWith(options), hands.length, mulberry32(1), 0);
	return { ...base, hands, turn: 0, events: [], ...overrides };
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
	throw new Error(`expected ${code}`);
}

/** Plays out tricks: each seat to play puts down its card from the trick's list. */
function playAll(state: TricksState, order: string[][]) {
	let current = state;
	for (const trick of order) {
		for (let played = 0; played < trick.length; played += 1) {
			const seat = current.turn;
			const card = trick.find((option) => current.hands[seat].includes(option));
			if (!card) throw new Error(`seat ${seat} has no card in ${trick}`);
			current = act(current, seat, { type: "play", card });
		}
	}
	return current;
}

const HANDS = [
	["S10#0", "SJ#0", "HQ#0", "DK#0"],
	["S9#0", "SQ#0", "H7#0", "D8#0"],
	["S8#0", "SK#0", "HA#0", "D10#0"],
];

describe("the deck and the deal", () => {
	it("deals four cards each from a 32-card deck, seven to ace", () => {
		expect(tricksDeck(rulesWith(), 4)).toHaveLength(32);
		const state = createCardGame(game, [], 5, mulberry32(3)) as TricksState;
		expect(state.hands.map((hand) => hand.length)).toEqual([4, 4, 4, 4, 4]);
		expect(state.stock).toHaveLength(12);
		expect(state.stake).toBe(1);
		expect(state.phase).toBe("playing");
	});

	it("ranks the jack lowest and the ten highest", () => {
		const rules = rulesWith();
		const plays = (cards: string[]) =>
			cards.map((card, seat) => ({ seat, card }));
		expect(trickWinner(rules, plays(["SJ#0", "SA#0", "S7#0"]), null)).toBe(2);
		expect(trickWinner(rules, plays(["S9#0", "S10#0", "SK#0"]), null)).toBe(1);
		// No trump: an off-suit ten loses to the jack led.
		expect(trickWinner(rules, plays(["SJ#0", "H10#0"]), null)).toBe(0);
	});

	it("seats 2 to 8 players", () => {
		expect(() => createCardGame(game, [], 1)).toThrow(GameRuleError);
		expect(() => createCardGame(game, [], 9)).toThrow(GameRuleError);
		expect(
			(createCardGame(game, [], 8, mulberry32(4)) as TricksState).stock,
		).toEqual([]);
	});
});

describe("only the last trick counts", () => {
	it("gives the stake of 1 to everyone but the last trick's winner", () => {
		// Seat 0 takes three tricks; seat 2 takes the last one with the ten of diamonds.
		const done = playAll(dealt(HANDS), [
			["S10#0", "S9#0", "S8#0"],
			["SJ#0", "SQ#0", "SK#0"],
			["HQ#0", "H7#0", "HA#0"],
			["D10#0", "DK#0", "D8#0"],
		]);
		expect(done.phase).toBe("roundOver");
		expect(done.dealWinner).toBe(2);
		expect(done.scores).toEqual([[1, 1, 0]]);
	});

	it("must follow suit", () => {
		const state = act(dealt(HANDS), 0, { type: "play", card: "S10#0" });
		expectRule(
			() => act(state, 1, { type: "play", card: "H7#0" }),
			"cardsMustFollow",
		);
	});
});

describe("knocking", () => {
	it("raises the stake by one and asks everyone else from the knocker's left", () => {
		const state = act(dealt(HANDS), 1, { type: "knock" });
		expect(state.phase).toBe("knocking");
		expect(state.stake).toBe(2);
		expect(state.knock).toEqual({
			by: 1,
			asked: [2, 0],
			answers: [null, null, null],
		});
		expect(view(state, 0).knock?.by).toBe(1);
	});

	it("lets anyone knock out of turn, and plays on once everyone stays", () => {
		let state = act(dealt(HANDS), 2, { type: "knock" });
		state = act(state, 0, { type: "stay" });
		expect(state.phase).toBe("knocking");
		state = act(state, 1, { type: "stay" });
		expect(state.phase).toBe("playing");
		expect(state.turn).toBe(0);
		expect(state.stake).toBe(2);
	});

	it("refuses knocking twice in a row, a knock while one is open, and play during it", () => {
		let state = act(dealt(HANDS), 0, { type: "knock" });
		expectRule(() => act(state, 1, { type: "knock" }), "cardsKnockPending");
		expectRule(
			() => act(state, 0, { type: "play", card: "S10#0" }),
			"cardsKnockPending",
		);
		state = act(act(state, 1, { type: "stay" }), 2, { type: "stay" });
		expectRule(() => act(state, 0, { type: "knock" }), "cardsKnockedLast");
		// Someone else knocks, and then the first knocker may again.
		state = act(state, 1, { type: "knock" });
		state = act(act(state, 2, { type: "stay" }), 0, { type: "stay" });
		expect(act(state, 0, { type: "knock" }).stake).toBe(4);
	});

	it("refuses answers to no knock, to your own knock, and a second answer", () => {
		const fresh = dealt(HANDS);
		expectRule(() => act(fresh, 1, { type: "stay" }), "cardsNothingToAnswer");
		expectRule(() => act(fresh, 1, { type: "fold" }), "cardsNothingToAnswer");
		const knocked = act(fresh, 0, { type: "knock" });
		expectRule(() => act(knocked, 0, { type: "fold" }), "cardsOwnKnock");
		const answered = act(knocked, 1, { type: "stay" });
		expectRule(
			() => act(answered, 1, { type: "fold" }),
			"cardsAlreadyAnswered",
		);
	});

	it("refuses knocking and answering in a game without stakes", () => {
		const hearts = getCardGame("hartenjagen");
		const state = createCardGame(hearts, ["noPassing"], 3, mulberry32(5));
		for (const action of [
			{ type: "knock" },
			{ type: "stay" },
			{ type: "fold" },
		] as const) {
			expectRule(
				() => applyCardAction(hearts, ["noPassing"], state, 0, action),
				"cardsWrongAction",
			);
		}
	});

	it("refuses a knock when the points and stake already reach the limit", () => {
		const state = dealt(HANDS, { scores: [[8, 0, 0]], stake: 2 });
		expectRule(() => act(state, 0, { type: "knock" }), "cardsKnockAtLimit");
		expect(view(state, 0).canKnock).toBe(false);
		expect(view(state, 1).canKnock).toBe(true);
		// Out at 15 leaves room.
		expect(act(state, 0, { type: "knock" }, ["outAt15"]).stake).toBe(3);
	});
});

describe("folding", () => {
	it("costs the stake from before the knock and takes the hand out of play", () => {
		let state = act(dealt(HANDS), 0, { type: "knock" });
		state = act(state, 1, { type: "fold" });
		expect(state.hands[1]).toEqual([]);
		expect(state.paid).toEqual([0, 1, 0]);
		expect(view(state, 2).handCounts).toEqual([4, 0, 4]);
		state = act(state, 2, { type: "stay" });
		expectRule(() => act(state, 1, { type: "knock" }), "cardsFolded");
		// Two seats play on: seat 2 takes the last trick with the ten of diamonds.
		const done = playAll(state, [
			["S10#0", "S8#0"],
			["SJ#0", "SK#0"],
			["D10#0", "DK#0"],
			["HA#0", "HQ#0"],
		]);
		expect(done.dealWinner).toBe(2);
		expect(done.scores).toEqual([[2, 1, 0]]);
	});

	it("costs more on a later knock", () => {
		let state = act(dealt(HANDS), 0, { type: "knock" });
		state = act(act(state, 1, { type: "stay" }), 2, { type: "stay" });
		state = act(state, 1, { type: "knock" });
		expect(state.stake).toBe(3);
		state = act(state, 2, { type: "fold" });
		expect(state.paid).toEqual([0, 0, 2]);
	});

	it("ends the round at once when everyone else folds, and the knocker loses nothing", () => {
		let state = act(dealt(HANDS), 2, { type: "knock" });
		state = act(act(state, 0, { type: "fold" }), 1, { type: "fold" });
		expect(state.phase).toBe("roundOver");
		expect(state.dealWinner).toBe(2);
		expect(state.scores).toEqual([[1, 1, 0]]);
	});

	it("takes a folded card out of the trick and finishes the trick without it", () => {
		let state = act(dealt(HANDS), 0, { type: "play", card: "S10#0" });
		state = act(state, 1, { type: "play", card: "S9#0" });
		// Seat 2 knocks before playing; seat 0, who led the winning ten, folds.
		state = act(state, 2, { type: "knock" });
		state = act(act(state, 0, { type: "fold" }), 1, { type: "stay" });
		expect(state.trick).toEqual([{ seat: 1, card: "S9#0" }]);
		expect(state.turn).toBe(2);
		state = act(state, 2, { type: "play", card: "S8#0" });
		expect(state.lastTrick?.winner).toBe(1);
		expect(state.turn).toBe(1);
	});

	it("passes the turn on when the seat to play folds", () => {
		let state = act(dealt(HANDS), 0, { type: "play", card: "S10#0" });
		state = act(state, 0, { type: "knock" });
		state = act(act(state, 1, { type: "fold" }), 2, { type: "stay" });
		expect(state.turn).toBe(2);
		// The last seat to play completes the trick between the two left.
		state = act(state, 2, { type: "play", card: "S8#0" });
		expect(state.lastTrick?.winner).toBe(0);
	});
});

describe("elimination", () => {
	it("puts seats out at 10, deals around them, and the last one in wins", () => {
		let state = dealt(HANDS, { scores: [[9, 9, 0]] });
		state = playAll(state, [
			["S10#0", "S9#0", "S8#0"],
			["SJ#0", "SQ#0", "SK#0"],
			["HQ#0", "H7#0", "HA#0"],
			["D10#0", "DK#0", "D8#0"],
		]);
		// Both seats 0 and 1 reach 10 and seat 2 is the last one in.
		expect(state.out).toEqual([true, true, false]);
		expect(state.phase).toBe("finished");
		expect(state.winners).toEqual([2]);
		expect(state.events.filter((event) => event.type === "out")).toHaveLength(
			2,
		);
	});

	it("deals nothing to a seat that is out and skips it in turn", () => {
		let state = dealt(
			[
				["S10#0", "SJ#0", "HQ#0", "DK#0"],
				["S9#0", "SQ#0", "H7#0", "D8#0"],
				["S8#0", "SK#0", "HA#0", "D10#0"],
				["C7#0", "C8#0", "C9#0", "C10#0"],
			],
			{ scores: [[0, 9, 0, 0]] },
		);
		state = playAll(state, [
			["S10#0", "S9#0", "S8#0", "C7#0"],
			["SJ#0", "SQ#0", "SK#0", "C8#0"],
			["HQ#0", "H7#0", "HA#0", "C9#0"],
			["DK#0", "D8#0", "D10#0", "C10#0"],
		]);
		expect(state.phase).toBe("roundOver");
		expect(state.out).toEqual([false, true, false, false]);
		const next = act(state, 0, { type: "nextRound" });
		expect(next.hands.map((hand) => hand.length)).toEqual([4, 0, 4, 4]);
		expect(next.events.find((event) => event.type === "deal")).toMatchObject({
			skipped: [1],
		});
		const leader = next.turn;
		expect(leader).not.toBe(1);
		const card = next.hands[leader][0];
		const after = act(next, leader, { type: "play", card });
		expect(after.turn).not.toBe(1);
		expectRule(() => act(next, 1, { type: "knock" }), "cardsOutOfMatch");
	});
});

describe("last life (pelt)", () => {
	it("starts the round at 2 and asks everyone but the seat on its last life", () => {
		const state = createTricks(rulesWith(["lastLife"]), 3, mulberry32(6), 0);
		expect(state.stake).toBe(1);
		const raised = act(
			{ ...state, phase: "roundOver", scores: [[0, 9, 0]] },
			0,
			{ type: "nextRound" },
			["lastLife"],
		);
		expect(raised.stake).toBe(2);
		expect(raised.phase).toBe("knocking");
		expect(raised.knock?.by).toBeNull();
		expect(raised.knock?.asked).not.toContain(1);
		const folded = act(raised, 0, { type: "fold" }, ["lastLife"]);
		expect(folded.paid?.[0]).toBe(1);
	});

	it("only applies under the house rule", () => {
		const state = createTricks(rulesWith(), 3, mulberry32(6), 0);
		const next = act({ ...state, phase: "roundOver", scores: [[0, 9, 0]] }, 0, {
			type: "nextRound",
		});
		expect(next.stake).toBe(1);
		expect(next.phase).toBe("playing");
	});
});

describe("swapping a hand", () => {
	const PICTURES = ["SJ#0", "HQ#0", "DK#0", "CA#0"];
	const NUMBERS = ["S7#0", "H8#0", "D9#0", "C10#0"];
	const MIXED = ["SJ#0", "H8#0", "D9#0", "C10#0"];

	it("swaps a hand of only jacks, queens, kings and aces under vuile was", () => {
		const state = dealt([PICTURES, MIXED], {}, ["vuileWas"]);
		expect(view(state, 0, ["vuileWas"]).canSwap).toBe(true);
		const swapped = act(state, 0, { type: "swapHand" }, ["vuileWas"]);
		expect(swapped.hands[0]).toHaveLength(4);
		expect(swapped.hands[0]).not.toEqual(PICTURES);
		expect(swapped.mucked).toEqual(PICTURES);
		expect(swapped.stock).toHaveLength((state.stock?.length ?? 0) - 4);
	});

	it("swaps a hand of only 7s to 10s under armoede, and both rules combine", () => {
		const state = dealt([NUMBERS, PICTURES], {}, ["armoede"]);
		act(state, 0, { type: "swapHand" }, ["armoede"]);
		expectRule(
			() => act(state, 1, { type: "swapHand" }, ["armoede"]),
			"cardsHandNotSwappable",
		);
		const both = dealt([NUMBERS, PICTURES], {}, ["vuileWas", "armoede"]);
		expect(rulesWith(["vuileWas", "armoede"]).swapHands).toHaveLength(2);
		act(both, 0, { type: "swapHand" }, ["vuileWas", "armoede"]);
		act(both, 1, { type: "swapHand" }, ["vuileWas", "armoede"]);
	});

	it("refuses a mixed hand, a swap after the first card, and a swap without the rule", () => {
		const state = dealt([PICTURES, MIXED], {}, ["vuileWas"]);
		expectRule(
			() => act(state, 1, { type: "swapHand" }, ["vuileWas"]),
			"cardsHandNotSwappable",
		);
		const played = act(state, 0, { type: "play", card: "SJ#0" }, ["vuileWas"]);
		expectRule(
			() => act(played, 0, { type: "swapHand" }, ["vuileWas"]),
			"cardsSwapTooLate",
		);
		expectRule(
			() => act(dealt([PICTURES, MIXED]), 0, { type: "swapHand" }),
			"cardsWrongAction",
		);
	});

	it("refuses when no cards are left to deal", () => {
		const state = dealt([PICTURES, MIXED], { stock: [] }, ["vuileWas"]);
		expectRule(
			() => act(state, 0, { type: "swapHand" }, ["vuileWas"]),
			"cardsStockEmpty",
		);
	});
});

describe("views stay private", () => {
	it("shows only your own hand, never the stock or folded cards", () => {
		const options = ["vuileWas"];
		let state = createCardGame(game, options, 4, mulberry32(7)) as TricksState;
		state = act(state, 1, { type: "knock" }, options);
		const folding = state.knock?.asked[0] as number;
		const foldedHand = state.hands[folding];
		state = act(state, folding, { type: "fold" }, options);
		for (const seat of [0, 1, 2, 3, null]) {
			const seen = view(state, seat, options);
			const text = JSON.stringify(seen);
			for (const card of [...(state.stock ?? []), ...foldedHand]) {
				expect(text).not.toContain(`"${card}"`);
			}
			state.hands.forEach((hand, holder) => {
				if (holder === seat) return;
				for (const card of hand) {
					expect(text).not.toContain(`"${card}"`);
				}
			});
			expect(seen.stake).toBe(2);
			expect(seen.folded[folding]).toBe(true);
		}
	});

	it("has no stake in a game without stakes", () => {
		const hearts = getCardGame("hartenjagen");
		const state = createCardGame(hearts, [], 4, mulberry32(8));
		const seen = viewCardGame(hearts, [], state, 0) as TricksView;
		expect(seen.stake).toBeNull();
		expect(seen.canKnock).toBe(false);
		expect(seen.matchEnd).toBe("lowestAtTarget");
	});
});

describe("the computer player", () => {
	const rules = rulesWith();

	it("knocks with cards nothing unseen can beat, and not on a weak hand", () => {
		const strong = dealt([
			["S10#0", "H10#0", "DJ#0", "CJ#0"],
			["SJ#0", "SQ#0", "H7#0", "D8#0"],
		]);
		expect(wantsKnock(rules, strong, 0, () => 0.99)).toBe(true);
		const weak = dealt([
			["SJ#0", "HQ#0", "DJ#0", "CK#0"],
			["S10#0", "SQ#0", "H7#0", "D8#0"],
		]);
		expect(wantsKnock(rules, weak, 0, () => 0)).toBe(false);
	});

	it("folds a weak hand, stays with a strong one, and stays when folding costs as much", () => {
		const knocked = (hand: string[], scores: number[][] = []) => ({
			...dealt([hand, ["S10#0", "SQ#0", "H7#0", "D8#0"]], { scores }),
			stake: 2,
		});
		expect(
			wantsToStay(rules, knocked(["SJ#0", "HQ#0", "DJ#0", "CK#0"]), 0),
		).toBe(false);
		expect(
			wantsToStay(rules, knocked(["H10#0", "HQ#0", "DJ#0", "CK#0"]), 0),
		).toBe(true);
		expect(
			wantsToStay(
				rules,
				knocked(["SJ#0", "HQ#0", "DJ#0", "CK#0"], [[9, 0]]),
				0,
			),
		).toBe(true);
	});

	it("judges the last trick by the cards already on it", () => {
		const lastTrick = (mine: string, theirs: string, led: string) =>
			dealt([[mine], [theirs], []], {
				trick: [{ seat: 2, card: led }],
				stake: 2,
			});
		// Beaten already: the 9 can't take a trick the 10 leads.
		const beaten = lastTrick("S9#0", "HJ#0", "S10#0");
		expect(wantsKnock(rules, beaten, 0, () => 0)).toBe(false);
		expect(wantsToStay(rules, beaten, 0)).toBe(false);
		// A 10 of another suit can't follow, so it can't win either.
		const offSuit = lastTrick("H10#0", "DJ#0", "S7#0");
		expect(wantsKnock(rules, offSuit, 0, () => 0)).toBe(false);
		expect(wantsToStay(rules, offSuit, 0)).toBe(false);
		// The seat's own 10 is winning and nothing can beat it.
		const winning = dealt([[], ["SJ#0"], ["H7#0"]], {
			trick: [{ seat: 0, card: "S10#0" }],
			turn: 1,
			stake: 2,
		});
		expect(wantsToStay(rules, winning, 0)).toBe(true);
	});

	it("keeps its best card for the last trick", () => {
		const state = dealt([
			["S10#0", "S7#0", "SJ#0", "HQ#0"],
			["S9#0", "SQ#0", "H7#0", "D8#0"],
		]);
		expect(chooseTricksCard(rules, state, 0)).toBe("SJ#0");
	});

	it("swaps vuile was but keeps a hand of high cards", () => {
		const options = ["vuileWas", "armoede"];
		const both = rulesWith(options);
		const state = dealt(
			[
				["SJ#0", "HQ#0", "DK#0", "CA#0"],
				["S7#0", "H8#0", "D9#0", "C10#0"],
			],
			{},
			options,
		);
		expect(botTricksMove(both, state, [0, 1], () => 0.5)).toMatchObject({
			seat: 0,
			action: { type: "swapHand" },
		});
		expect(botTricksMove(both, state, [1], () => 0.5)?.action.type).not.toBe(
			"swapHand",
		);
	});

	it("answers a knock for each computer seat, and waits for people", () => {
		const state = act(dealt(HANDS), 0, { type: "knock" });
		expect(botMove(game, [], state, [2])?.seat).toBe(2);
		expect(botMove(game, [], state, [0])).toBeNull();
	});

	it("deals on when everyone left in is a computer, though a person is out", () => {
		const state = {
			...dealt(HANDS),
			phase: "roundOver" as const,
			out: [true, false, false],
		};
		expect(botMove(game, [], state, [1, 2])?.action.type).toBe("nextRound");
		expect(
			botMove(game, [], { ...state, out: [false, false, false] }, [1, 2]),
		).toBeNull();
	});

	it.each([2, 3, 4, 5, 6, 7, 8])(
		"finishes whole matches with %i seats and every house rule, over many seeds",
		(seats) => {
			const options = ["vuileWas", "armoede", "lastLife", "outAt15"];
			for (const set of [[], options]) {
				for (let seed = 1; seed <= 15; seed += 1) {
					const random = mulberry32(seed * 101 + seats);
					let state = createCardGame(game, set, seats, random) as TricksState;
					const everyone = Array.from({ length: seats }, (_, seat) => seat);
					for (let step = 0; state.phase !== "finished"; step += 1) {
						if (step > 20_000) throw new Error("match did not end");
						const move = botMove(game, set, state, everyone, random);
						if (!move) throw new Error(`stuck in ${state.phase}`);
						state = applyCardAction(
							game,
							set,
							state,
							move.seat,
							move.action,
							random,
						) as TricksState;
					}
					expect(state.winners).toHaveLength(1);
					expect(state.out?.filter((out) => !out)).toHaveLength(1);
				}
			}
		},
	);
});
