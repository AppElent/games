import { describe, expect, it } from "vitest";
import { buildDeck, parseCard, RANKS } from "../cards/deck";
import {
	applyCardAction,
	botMove,
	CARD_GAME_IDS,
	CARD_GAMES,
	type CardAction,
	type CardGameDefinition,
	type CardGameState,
	createCardGame,
	getCardGame,
	nextStarter,
	normalizeOptions,
	viewCardGame,
} from "../cards/engine";
import {
	buildMeld,
	extendMeld,
	fitOnMeld,
	handPoints,
	type Meld,
	meldPoints,
	swapJoker,
} from "../cards/melds";
import {
	applyRummy,
	botRummyMove,
	createRummy,
	findMelds,
	type RummyRules,
	type RummyState,
} from "../cards/rummy";
import {
	applyShedding,
	createShedding,
	type SheddingRules,
	type SheddingState,
} from "../cards/shedding";
import { GameRuleError } from "../errors";
import type { Rng } from "../random";

function seeded(seed: number): Rng {
	let value = seed;
	return () => {
		value = (value * 1664525 + 1013904223) % 4294967296;
		return value / 4294967296;
	};
}

const pestenRules = CARD_GAMES.pesten.rules as SheddingRules;
const jokerenRules = CARD_GAMES.jokeren.rules as RummyRules;

function pestenState(overrides: Partial<SheddingState> = {}): SheddingState {
	return {
		...createShedding(pestenRules, 3, seeded(1)),
		hands: [
			["S4#0", "S9#0"],
			["D4#0", "C5#0"],
			["H6#0", "H9#0"],
		],
		stock: ["C2#0", "C3#0", "C6#0", "C9#0", "D9#0", "D3#0", "D6#0"],
		discard: ["S5#0"],
		turn: 0,
		events: [],
		...overrides,
	};
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

describe("deck", () => {
	it("builds unique ids across decks and jokers", () => {
		const deck = buildDeck(2, 4);
		expect(deck).toHaveLength(108);
		expect(new Set(deck).size).toBe(108);
		expect(parseCard("H10#1")).toEqual({ joker: false, suit: "H", rank: "10" });
		expect(parseCard("JK#3").joker).toBe(true);
	});
});

describe("pesten", () => {
	const play = (state: SheddingState, seat: number, card: string, extra = {}) =>
		applyShedding(
			pestenRules,
			state,
			seat,
			{ type: "play", card, ...extra },
			seeded(2),
		);

	it("deals seven and never starts on a power card", () => {
		for (let seed = 1; seed < 60; seed += 1) {
			const state = createShedding(pestenRules, 4, seeded(seed));
			expect(state.hands.every((hand) => hand.length === 7)).toBe(true);
			const top = parseCard(state.discard[0]);
			expect(top.joker).toBe(false);
			expect(["2", "7", "8", "J", "A"]).not.toContain(top.rank);
		}
	});

	it("uses two decks from six players", () => {
		const state = createShedding(pestenRules, 6, seeded(3));
		const total =
			state.stock.length + state.discard.length + state.hands.flat().length;
		expect(total).toBe(108);
	});

	it("accepts a match on suit or rank and rejects anything else", () => {
		const state = pestenState();
		expect(play(state, 0, "S4#0").turn).toBe(1);
		expect(play(pestenState({ discard: ["D9#0"] }), 0, "S9#0").turn).toBe(1);
		expectRule(
			() => play(pestenState({ discard: ["D3#0"] }), 0, "S4#0"),
			"cardsDoesNotFit",
		);
	});

	it("rejects playing out of turn or a card you do not hold", () => {
		expectRule(() => play(pestenState(), 1, "D4#0"), "notYourTurn");
		expectRule(() => play(pestenState(), 0, "H6#0"), "cardsNotInHand");
	});

	it("8 skips the next player", () => {
		const state = pestenState({
			hands: [["S8#0", "S9#0"], ["D4#0"], ["H6#0"]],
		});
		const next = play(state, 0, "S8#0");
		expect(next.turn).toBe(2);
		expect(next.events.at(-1)).toMatchObject({ type: "skip", seat: 1 });
	});

	it("7 keeps the turn and must be followed up", () => {
		const state = pestenState({
			hands: [["S7#0", "S9#0", "D3#0"], ["D4#0"], ["H6#0"]],
		});
		const next = play(state, 0, "S7#0");
		expect(next.turn).toBe(0);
		expect(next.mustContinue).toBe(true);
		const after = play(next, 0, "S9#0", { callLast: true });
		expect(after.turn).toBe(1);
		expect(after.mustContinue).toBe(false);
	});

	it("ace reverses direction, and is an extra turn with two players", () => {
		const state = pestenState({
			hands: [["SA#0", "S9#0"], ["D4#0"], ["H6#0"]],
		});
		const next = play(state, 0, "SA#0");
		expect(next.direction).toBe(-1);
		expect(next.turn).toBe(2);
		const duel = pestenState({ hands: [["SA#0", "S9#0"], ["D4#0"]] });
		const again = play(duel, 0, "SA#0");
		expect(again.turn).toBe(0);
		expect(again.mustContinue).toBe(true);
	});

	it("jack goes on anything and names the suit", () => {
		const state = pestenState({
			discard: ["D3#0"],
			hands: [["SJ#0", "S9#0"], ["D4#0", "H4#0"], ["H6#0"]],
		});
		expectRule(() => play(state, 0, "SJ#0"), "cardsChooseSuit");
		const next = play(state, 0, "SJ#0", { suit: "H" });
		expect(next.activeSuit).toBe("H");
		expectRule(() => play(next, 1, "D4#0"), "cardsDoesNotFit");
		expect(play(next, 1, "H4#0").activeSuit).toBeNull();
	});

	it("2 and joker stack, and the total lands on whoever cannot answer", () => {
		const state = pestenState({
			hands: [
				["S2#0", "S9#0"],
				["JK#0", "C5#0"],
				["H6#0", "H9#0"],
			],
		});
		const one = play(state, 0, "S2#0");
		expect(one.pendingDraw).toBe(2);
		expectRule(() => play(one, 1, "C5#0"), "cardsMustAnswerDraw");
		const two = play(one, 1, "JK#0");
		expect(two.pendingDraw).toBe(7);
		const three = applyShedding(
			pestenRules,
			two,
			2,
			{ type: "draw" },
			seeded(4),
		);
		expect(three.hands[2]).toHaveLength(9);
		expect(three.pendingDraw).toBe(0);
		expect(three.turn).toBe(0);
		// The joker leaves the table open: anything goes next.
		expect(three.openTable).toBe(true);
	});

	it("a drawn card may be played at once, or passed", () => {
		const state = pestenState({ stock: ["S3#0"], discard: ["S5#0"] });
		const drew = applyShedding(
			pestenRules,
			state,
			0,
			{ type: "draw" },
			seeded(5),
		);
		expect(drew.drawnCard).toBe("S3#0");
		expect(drew.turn).toBe(0);
		expectRule(() => play(drew, 0, "S4#0"), "cardsOnlyDrawnCard");
		const passed = applyShedding(
			pestenRules,
			drew,
			0,
			{ type: "pass" },
			seeded(5),
		);
		expect(passed.turn).toBe(1);
	});

	it("a drawn card that does not fit ends the turn", () => {
		const state = pestenState({ stock: ["D3#0"], discard: ["S5#0"] });
		const drew = applyShedding(
			pestenRules,
			state,
			0,
			{ type: "draw" },
			seeded(5),
		);
		expect(drew.drawnCard).toBeNull();
		expect(drew.turn).toBe(1);
		expectRule(
			() => applyShedding(pestenRules, drew, 1, { type: "pass" }, seeded(5)),
			"cardsCannotPass",
		);
	});

	it("forgetting last card can be caught until the next player acts", () => {
		const state = pestenState();
		const forgot = play(state, 0, "S4#0");
		expect(forgot.lastCardDebtor).toBe(0);
		const caught = applyShedding(
			pestenRules,
			forgot,
			2,
			{ type: "catch", target: 0 },
			seeded(6),
		);
		expect(caught.hands[0]).toHaveLength(3);
		expect(caught.lastCardDebtor).toBeNull();
		// Calling it yourself first is safe.
		const called = applyShedding(
			pestenRules,
			forgot,
			0,
			{ type: "callLast" },
			seeded(6),
		);
		expect(called.lastCardDebtor).toBeNull();
		expectRule(
			() =>
				applyShedding(
					pestenRules,
					called,
					2,
					{ type: "catch", target: 0 },
					seeded(6),
				),
			"cardsNothingToCatch",
		);
		// The next player's move closes the window.
		const moved = applyShedding(
			pestenRules,
			forgot,
			1,
			{ type: "draw" },
			seeded(6),
		);
		expect(moved.lastCardDebtor).toBeNull();
	});

	it("passes the lead on at each rematch", () => {
		const first = createCardGame(getCardGame("pesten"), [], 3, seeded(2));
		expect(first.family === "shedding" && first.turn).toBe(0);
		const second = createCardGame(
			getCardGame("pesten"),
			[],
			3,
			seeded(2),
			nextStarter(first),
		);
		expect(second.family === "shedding" && second.turn).toBe(1);

		const rummy = createCardGame(getCardGame("jokeren"), [], 3, seeded(2));
		expect(rummy.family === "rummy" && rummy.turn).toBe(0);
		const again = createCardGame(
			getCardGame("jokeren"),
			[],
			3,
			seeded(2),
			nextStarter(rummy),
		);
		expect(again.family === "rummy" && again.turn).toBe(1);
	});

	it("drawing after a forgotten call leaves nothing to catch", () => {
		const state = pestenState({
			hands: [["S7#0", "D9#0"], ["D4#0"], ["H6#0"]],
		});
		const forgot = play(state, 0, "S7#0");
		expect(forgot.lastCardDebtor).toBe(0);
		const drew = applyShedding(
			pestenRules,
			forgot,
			0,
			{ type: "draw" },
			seeded(6),
		);
		expect(drew.lastCardDebtor).toBeNull();
	});

	it("playing the last card wins", () => {
		const state = pestenState({ hands: [["S4#0"], ["D4#0"], ["H6#0"]] });
		const done = play(state, 0, "S4#0");
		expect(done.phase).toBe("finished");
		expect(done.winners).toEqual([0]);
		expectRule(() => play(done, 1, "D4#0"), "gameAlreadyFinished");
	});

	it("reshuffles the discard pile when the stock runs out", () => {
		const state = pestenState({
			stock: [],
			discard: ["C9#0", "C8#0", "S5#0"],
		});
		const next = applyShedding(
			pestenRules,
			state,
			0,
			{ type: "draw" },
			seeded(7),
		);
		expect(next.discard).toEqual(["S5#0"]);
		expect(next.events.some((event) => event.type === "reshuffle")).toBe(true);
	});

	it("ends instead of deadlocking when nothing can move or be drawn", () => {
		const state = pestenState({
			stock: [],
			discard: ["S5#0"],
			hands: [["D3#0", "D4#0"], ["H3#0"], ["C3#0", "C4#0", "C6#0"]],
		});
		const next = applyShedding(
			pestenRules,
			state,
			0,
			{ type: "draw" },
			seeded(7),
		);
		expect(next.phase).toBe("finished");
		expect(next.winners).toEqual([1]);
	});

	it("does not mutate the previous state", () => {
		const state = pestenState();
		const copy = JSON.stringify(state);
		play(state, 0, "S4#0");
		expect(JSON.stringify(state)).toBe(copy);
	});
});

describe("pesten house rules", () => {
	const game = CARD_GAMES.pesten as CardGameDefinition;

	it("rejects unknown options and keeps a stable order", () => {
		expect(() => normalizeOptions(game, ["nope"])).toThrow(GameRuleError);
		expect(normalizeOptions(game, ["noStacking", "noFinishOnPower"])).toEqual([
			"noFinishOnPower",
			"noStacking",
		]);
	});

	it("noStacking turns off answering a draw card", () => {
		const state = pestenState({
			hands: [
				["S2#0", "S9#0"],
				["H2#0", "C5#0"],
				["H6#0", "H9#0"],
			],
		});
		const next = applyCardAction(
			game,
			["noStacking"],
			state,
			0,
			{ type: "play", card: "S2#0" },
			seeded(1),
		);
		expect(() =>
			applyCardAction(
				game,
				["noStacking"],
				next,
				1,
				{ type: "play", card: "H2#0" },
				seeded(1),
			),
		).toThrow(GameRuleError);
	});

	it("noFinishOnPower punishes going out on a power card", () => {
		const state = pestenState({
			hands: [["S8#0"], ["D4#0"], ["H6#0"]],
			lastCardDebtor: 0,
		});
		const next = applyCardAction(
			game,
			["noFinishOnPower"],
			state,
			0,
			{ type: "play", card: "S8#0" },
			seeded(1),
		) as SheddingState;
		expect(next.phase).toBe("playing");
		expect(next.hands[0]).toHaveLength(5);
		expect(next.lastCardDebtor).toBeNull();
	});
});

describe("config is enough for a new shedding game", () => {
	// A game this engine has never seen, with no code of its own.
	const crazyEights: CardGameDefinition = {
		id: "crazy-eights",
		showcase: ["S8#0"],
		family: "shedding",
		felt: "midnight",
		players: { min: 2, max: 5 },
		rules: {
			decks: [{ from: 2, decks: 1 }],
			jokersPerDeck: 0,
			handSize: 5,
			powers: { "8": { kind: "chooseSuit" } },
			stackDraws: false,
			playDrawnCard: false,
			voluntaryDraw: false,
			lastCardPenalty: null,
			finishOnPowerPenalty: null,
			twoPlayerReverseAgain: false,
		},
		options: [],
	};

	it("deals, enforces its own rules, and plays to a winner", () => {
		const state = createCardGame(
			crazyEights,
			[],
			3,
			seeded(9),
		) as SheddingState;
		expect(state.hands[0]).toHaveLength(5);
		expect(state.hands.flat().every((card) => !card.startsWith("JK"))).toBe(
			true,
		);
		const final = playOut(crazyEights, [], 3, 9);
		expect(final.phase).toBe("finished");
	});
});

describe("melds", () => {
	it("a run can't use the ace at both ends", () => {
		const all = RANKS.map((rank) => `H${rank}#0`);
		expect(buildMeld(all, jokerenRules)).not.toBeNull();
		expect(buildMeld([...all, "JK#0"], jokerenRules)).toBeNull();
	});

	const rules = jokerenRules;

	it("recognises sets, with different suits only and four at most", () => {
		expect(buildMeld(["S7#0", "H7#0", "D7#0"], rules)?.kind).toBe("set");
		expect(buildMeld(["S7#0", "S7#1", "D7#0"], rules)).toBeNull();
		expect(buildMeld(["S7#0", "H7#0"], rules)).toBeNull();
		expect(
			buildMeld(["S7#0", "H7#0", "D7#0", "C7#0", "JK#0"], rules),
		).toBeNull();
	});

	it("recognises runs, with the ace on either end but never wrapping", () => {
		expect(buildMeld(["S3#0", "S2#0", "SA#0"], rules)).toMatchObject({
			kind: "run",
			low: 1,
			cards: ["SA#0", "S2#0", "S3#0"],
		});
		expect(buildMeld(["SQ#0", "SK#0", "SA#0"], rules)).toMatchObject({
			kind: "run",
			low: 12,
		});
		expect(buildMeld(["SK#0", "SA#0", "S2#0"], rules)).toBeNull();
		expect(buildMeld(["S3#0", "S5#0", "S6#0"], rules)).toBeNull();
		expect(buildMeld(["S3#0", "H4#0", "S5#0"], rules)).toBeNull();
	});

	it("jokers fill gaps but need two real cards beside them", () => {
		expect(buildMeld(["S3#0", "JK#0", "S5#0"], rules)).toMatchObject({
			kind: "run",
			cards: ["S3#0", "JK#0", "S5#0"],
			low: 3,
		});
		expect(buildMeld(["S7#0", "H7#0", "JK#0"], rules)?.kind).toBe("set");
		expect(buildMeld(["S7#0", "JK#0", "JK#1"], rules)).toBeNull();
	});

	it("counts points by what each position stands for", () => {
		const run = buildMeld(["S9#0", "JK#0", "SJ#0"], rules);
		expect(run && meldPoints(run, rules)).toBe(9 + 10 + 10);
		const lowAce = buildMeld(["SA#0", "S2#0", "S3#0"], rules);
		expect(lowAce && meldPoints(lowAce, rules)).toBe(1 + 2 + 3);
		const highAce = buildMeld(["SQ#0", "SK#0", "SA#0"], rules);
		expect(highAce && meldPoints(highAce, rules)).toBe(10 + 10 + 11);
		const set = buildMeld(["SA#0", "HA#0", "JK#0"], rules);
		expect(set && meldPoints(set, rules)).toBe(33);
	});

	it("scores a hand with ace 11, faces 10, joker 25", () => {
		expect(handPoints(["SA#0", "HK#0", "JK#0", "D4#0"], rules)).toBe(50);
	});

	it("extends runs on both ends and sets by a missing suit", () => {
		const run = {
			id: 1,
			kind: "run",
			cards: ["S5#0", "S6#0", "S7#0"],
			suit: "S",
			low: 5,
		} as Meld;
		expect(extendMeld(run, "S8#1")?.cards.at(-1)).toBe("S8#1");
		expect(extendMeld(run, "S4#1")?.cards[0]).toBe("S4#1");
		expect(extendMeld(run, "S9#1")).toBeNull();
		expect(extendMeld(run, "H8#1")).toBeNull();
		const top = {
			id: 2,
			kind: "run",
			cards: ["SQ#0", "SK#0"],
			suit: "S",
			low: 12,
		} as Meld;
		expect(extendMeld(top, "SA#0")?.cards.at(-1)).toBe("SA#0");
		const set = {
			id: 3,
			kind: "set",
			cards: ["S5#0", "H5#0", "D5#0"],
			rank: "5",
		} as Meld;
		expect(extendMeld(set, "C5#0")?.cards).toHaveLength(4);
		expect(extendMeld(set, "S5#1")).toBeNull();
	});

	it("swaps a joker only for the card it stands for", () => {
		const run = {
			id: 1,
			kind: "run",
			cards: ["S5#0", "JK#0", "S7#0"],
			suit: "S",
			low: 5,
		} as Meld;
		expect(swapJoker(run, "S8#0")).toBeNull();
		const swapped = swapJoker(run, "S6#1");
		expect(swapped?.joker).toBe("JK#0");
		expect(swapped?.meld.cards).toEqual(["S5#0", "S6#1", "S7#0"]);
		const set = {
			id: 2,
			kind: "set",
			cards: ["S5#0", "H5#0", "JK#1"],
			rank: "5",
		} as Meld;
		expect(swapJoker(set, "S5#1")).toBeNull();
		expect(swapJoker(set, "D5#0")?.joker).toBe("JK#1");
	});
});

describe("jokeren", () => {
	const rules = jokerenRules;
	const act = (state: RummyState, seat: number, action: never | object) =>
		applyRummy(rules, state, seat, action as never, seeded(11));

	function jokerenState(overrides: Partial<RummyState> = {}): RummyState {
		return {
			...createRummy(rules, 2, seeded(10)),
			turn: 0,
			phase: "play",
			turnsPlayed: 2,
			...overrides,
		};
	}

	it("deals 13 from two decks and four jokers", () => {
		const state = createRummy(rules, 4, seeded(10));
		expect(state.hands.every((hand) => hand.length === 13)).toBe(true);
		expect(
			state.stock.length + state.discard.length + state.hands.flat().length,
		).toBe(108);
		expect(state.turn).toBe(0);
	});

	it("requires drawing before anything else, one draw per turn", () => {
		const state = jokerenState({ phase: "draw" });
		expectRule(
			() => act(state, 0, { type: "discard", card: state.hands[0][0] }),
			"cardsDrawFirst",
		);
		const drew = act(state, 0, { type: "drawStock" });
		expect(drew.hands[0]).toHaveLength(14);
		expectRule(() => act(drew, 0, { type: "drawStock" }), "cardsAlreadyDrew");
		expectRule(
			() => act(drew, 1, { type: "discard", card: "x" }),
			"notYourTurn",
		);
	});

	it("opening must reach 30 points in one turn", () => {
		const state = jokerenState({
			hands: [
				["S2#0", "S3#0", "S4#0", "H9#0", "H10#0", "HJ#0", "C5#0"],
				["D2#0"],
			],
		});
		expectRule(
			() =>
				act(state, 0, { type: "layDown", melds: [["S2#0", "S3#0", "S4#0"]] }),
			"cardsOpeningTooLow",
		);
		const opened = act(state, 0, {
			type: "layDown",
			melds: [
				["S2#0", "S3#0", "S4#0"],
				["H9#0", "H10#0", "HJ#0"],
			],
		});
		expect(opened.opened[0]).toBe(true);
		expect(opened.melds).toHaveLength(2);
		expect(opened.hands[0]).toEqual(["C5#0"]);
	});

	it("a failed lay-down leaves the state untouched", () => {
		const state = jokerenState({
			hands: [["S2#0", "S3#0", "H9#0"], ["D2#0"]],
		});
		const copy = JSON.stringify(state);
		expectRule(
			() =>
				act(state, 0, { type: "layDown", melds: [["S2#0", "S3#0", "H9#0"]] }),
			"cardsInvalidMeld",
		);
		expect(JSON.stringify(state)).toBe(copy);
	});

	it("cannot lay off onto the table before opening", () => {
		const meld = {
			id: 1,
			kind: "run",
			cards: ["S5#0", "S6#0", "S7#0"],
			suit: "S",
			low: 5,
		} as Meld;
		const state = jokerenState({
			melds: [meld],
			opened: [false, true],
			hands: [["S8#0", "H2#0"], ["D2#0"]],
		});
		expectRule(
			() =>
				act(state, 0, {
					type: "layDown",
					additions: [{ meldId: 1, cards: ["S8#0"] }],
				}),
			"cardsOpeningTooLow",
		);
		const after = act({ ...state, opened: [true, true] }, 0, {
			type: "layDown",
			additions: [{ meldId: 1, cards: ["S8#0"] }],
		});
		expect(after.melds[0].cards).toHaveLength(4);
	});

	it("swapping a joker puts it in your hand", () => {
		const meld = {
			id: 1,
			kind: "run",
			cards: ["S5#0", "JK#0", "S7#0"],
			suit: "S",
			low: 5,
		} as Meld;
		const state = jokerenState({
			melds: [meld],
			opened: [true, true],
			hands: [["S6#1", "H2#0"], ["D2#0"]],
		});
		const after = act(state, 0, {
			type: "layDown",
			swaps: [{ meldId: 1, card: "S6#1" }],
		});
		expect(after.hands[0].sort()).toEqual(["H2#0", "JK#0"].sort());
		expect(after.melds[0].cards).toEqual(["S5#0", "S6#1", "S7#0"]);
	});

	it("you must keep a card to discard", () => {
		const meld = {
			id: 1,
			kind: "run",
			cards: ["S5#0", "S6#0", "S7#0"],
			suit: "S",
			low: 5,
		} as Meld;
		const state = jokerenState({
			melds: [meld],
			opened: [true, true],
			hands: [["S8#0"], ["D2#0"]],
		});
		expectRule(
			() =>
				act(state, 0, {
					type: "layDown",
					additions: [{ meldId: 1, cards: ["S8#0"] }],
				}),
			"cardsKeepOneToDiscard",
		);
	});

	it("nobody can get down to their last card before everyone has had a turn", () => {
		const hands = [
			["S2#0", "S3#0", "S4#0", "H9#0", "H10#0", "HJ#0", "C5#0"],
			["D2#0"],
		];
		const melds = [
			["S2#0", "S3#0", "S4#0"],
			["H9#0", "H10#0", "HJ#0"],
		];
		expectRule(
			() =>
				act(jokerenState({ hands, turnsPlayed: 0 }), 0, {
					type: "layDown",
					melds,
				}),
			"cardsEveryoneGetsATurn",
		);
		const secondSeat = act(jokerenState({ hands, turnsPlayed: 1 }), 0, {
			type: "layDown",
			melds,
		});
		expect(secondSeat.hands[0]).toEqual(["C5#0"]);
	});

	it("computer players wait before opening, then open", () => {
		const hand = ["SK#0", "SQ#0", "SJ#0", "H9#0", "C5#0"];
		const opening = (turnsPlayed: number) =>
			botRummyMove(
				rules,
				jokerenState({ hands: [hand, ["D2#0"]], turnsPlayed }),
				[0],
			)?.action.type;
		expect(opening(0)).toBe("discard");
		expect(opening(6)).toBe("layDown");
	});

	it("a computer player lays down once a turn, however much it could add", () => {
		const meld = {
			id: 1,
			kind: "run",
			cards: ["HA#0", "H2#0", "H3#0"],
			suit: "H",
			low: 1,
		} as Meld;
		const state = jokerenState({
			melds: [meld],
			opened: [true, true],
			hands: [["H4#0", "H5#0", "S9#0"], ["D2#0"]],
			events: [{ seq: 0, type: "draw", seat: 0, count: 1, source: "stock" }],
		});
		const first = botRummyMove(rules, state, [0]);
		expect(first?.action).toEqual({
			type: "layDown",
			melds: [],
			swaps: [],
			additions: [{ meldId: 1, cards: ["H4#0"] }],
		});
		const after = act(state, 0, first?.action as object);
		expect(botRummyMove(rules, after, [0])?.action.type).toBe("discard");
	});

	it("autopilot won't reach the last card before everyone has had a turn", () => {
		const meld = {
			id: 1,
			kind: "run",
			cards: ["HA#0", "H2#0", "H3#0"],
			suit: "H",
			low: 1,
		} as Meld;
		const hands = [["H4#0", "S9#0"], ["D2#0"]];
		const move = (turnsPlayed: number) =>
			botRummyMove(
				rules,
				jokerenState({
					melds: [meld],
					opened: [true, true],
					hands,
					turnsPlayed,
				}),
				[0],
			)?.action.type;
		expect(move(0)).toBe("discard");
		expect(move(1)).toBe("layDown");
	});

	it("a computer player opens with no more melds than the opening asks", () => {
		const state = jokerenState({
			turnsPlayed: 6,
			hands: [
				["SK#0", "SQ#0", "SJ#0", "H9#0", "H10#0", "HJ#0", "C5#0", "D7#0"],
				["D2#0"],
			],
		});
		const move = botRummyMove(rules, state, [0])?.action as {
			melds?: string[][];
		};
		expect(move.melds).toHaveLength(1);
	});

	it("a computer player holding the taken card and a joker gives up the joker", () => {
		const state = jokerenState({
			hands: [["SK#0", "JK#0"], ["D2#0"]],
			takenDiscard: "SK#0",
		});
		expect(botRummyMove(rules, state, [0])?.action).toEqual({
			type: "discard",
			card: "JK#0",
		});
	});

	it("a card taken from the discard pile cannot go straight back", () => {
		const state = jokerenState({ phase: "draw", discard: ["H4#0"] });
		const took = act(state, 0, { type: "takeDiscard" });
		expect(took.hands[0]).toContain("H4#0");
		expectRule(
			() => act(took, 0, { type: "discard", card: "H4#0" }),
			"cardsCannotReturnDiscard",
		);
		expect(act(took, 0, { type: "discard", card: took.hands[0][0] }).turn).toBe(
			1,
		);
	});

	it("going out scores the others and starts the next round", () => {
		const state = jokerenState({
			hands: [["H2#0"], ["SK#0", "JK#0", "D4#0"]],
		});
		const out = act(state, 0, { type: "discard", card: "H2#0" });
		expect(out.phase).toBe("roundOver");
		expect(out.roundWinner).toBe(0);
		expect(out.scores).toEqual([[0, 39]]);
		expectRule(() => act(out, 0, { type: "drawStock" }), "noActiveRound");
		const next = act(out, 1, { type: "nextRound" });
		expect(next.round).toBe(2);
		expect(next.phase).toBe("draw");
		expect(next.turn).toBe(1);
		expect(next.melds).toEqual([]);
		expect(next.scores).toEqual([[0, 39]]);
	});

	it("the lowest total after the last round wins", () => {
		const state = jokerenState({
			round: rules.rounds,
			scores: [[30, 5]],
			hands: [["H2#0"], ["D4#0"]],
		});
		const out = act(state, 0, { type: "discard", card: "H2#0" });
		expect(out.phase).toBe("finished");
		expect(out.winners).toEqual([1]);
	});

	it("calls off a stalled round and scores it as it stands", () => {
		const state = jokerenState({
			turnsPlayed: rules.maxTurnsPerRound - 1,
			hands: [["H2#0", "H3#0"], ["D4#0"]],
		});
		const stalled = act(state, 0, { type: "discard", card: "H2#0" });
		expect(stalled.phase).toBe("roundOver");
		expect(stalled.roundWinner).toBeNull();
		expect(stalled.scores).toEqual([[3, 4]]);
	});

	it("finds melds for the computer without spending the last card", () => {
		const melds = findMelds(["S2#0", "S3#0", "S4#0"], rules);
		expect(melds).toEqual([]);
		const found = findMelds(["S2#0", "S3#0", "S4#0", "H9#0"], rules);
		expect(found).toHaveLength(1);
		expect(found[0].kind).toBe("run");
	});
});

describe("views keep hands private", () => {
	it.each(CARD_GAME_IDS)("%s hides other hands and the stock", (id) => {
		const game = getCardGame(id);
		const state = createCardGame(game, [], 3, seeded(21));
		const mine = viewCardGame(game, [], state, 0);
		const otherCards = state.hands[1];
		const serialized = JSON.stringify(mine);
		for (const card of otherCards) {
			expect(serialized).not.toContain(`"${card}"`);
		}
		for (const card of state.stock) {
			expect(serialized).not.toContain(`"${card}"`);
		}
		const spectator = viewCardGame(game, [], state, null);
		expect(spectator.hand).toEqual([]);
		expect(spectator.handCounts).toEqual([
			state.hands[0].length,
			state.hands[1].length,
			state.hands[2].length,
		]);
	});
});

/** Plays a whole table of computer players, checking invariants on every move. */
function playOut(
	game: CardGameDefinition,
	options: string[],
	seats: number,
	seed: number,
) {
	const random = seeded(seed);
	let state: CardGameState = createCardGame(game, options, seats, random);
	const everyone = Array.from({ length: seats }, (_, seat) => seat);
	const total =
		state.stock.length +
		state.discard.length +
		state.hands.flat().length +
		("melds" in state ? state.melds.flatMap((m) => m.cards).length : 0);
	for (let step = 0; step < 40_000; step += 1) {
		if (state.phase === "finished") {
			return state;
		}
		const move: { seat: number; action: CardAction } | null = botMove(
			game,
			options,
			state,
			everyone,
			random,
		);
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
		);
		const cards = [
			...state.stock,
			...state.discard,
			...state.hands.flat(),
			...("melds" in state ? state.melds.flatMap((m) => m.cards) : []),
		];
		expect(cards.length).toBe(total);
		expect(new Set(cards).size).toBe(total);
	}
	throw new Error("game did not terminate");
}

describe("full games between computer players", () => {
	const cases = CARD_GAME_IDS.flatMap((id) => {
		const { min, max } = CARD_GAMES[id].players;
		return Array.from({ length: max - min + 1 }, (_, i) => ({
			id,
			seats: min + i,
		}));
	});

	it.each(cases)(
		"$id with $seats seats finishes and conserves every card",
		({ id, seats }) => {
			for (let seed = 1; seed <= 12; seed += 1) {
				const final = playOut(getCardGame(id), [], seats, seed * 37);
				expect(final.winners.length).toBeGreaterThan(0);
			}
		},
	);

	// A throwing bot move freezes a live table for good, so play plenty of matches.
	it.each([2, 3, 4])(
		"jokeren bots never make an illegal move with %i seats",
		(seats) => {
			for (let seed = 1; seed <= 150; seed += 1) {
				expect(playOut(getCardGame("jokeren"), [], seats, seed).phase).toBe(
					"finished",
				);
			}
		},
		30_000,
	);

	it.each([
		["pesten", ["noFinishOnPower", "noStacking", "noLastCard"]],
		["jokeren", ["fullMatch", "stockOnly", "openAt40"]],
	] as const)("%s finishes with every house rule on", (id, options) => {
		for (let seed = 1; seed <= 12; seed += 1) {
			const final = playOut(getCardGame(id), [...options], 4, seed * 41);
			expect(final.phase).toBe("finished");
		}
	});
});

describe("fitting cards onto a meld", () => {
	const run = (cards: string[]) => buildMeld(cards, jokerenRules) as Meld;

	it("does not care which order the cards were tapped in", () => {
		const meld = { ...run(["H5#0", "H6#0", "H7#0"]), id: 1 };
		expect(fitOnMeld(meld, ["H9#0", "H8#0"])).toEqual(["H8#0", "H9#0"]);
		expect(fitOnMeld(meld, ["H4#0", "H8#0"])).not.toBeNull();
	});

	it("lets a joker bridge a gap", () => {
		const meld = { ...run(["H5#0", "H6#0", "H7#0"]), id: 1 };
		expect(fitOnMeld(meld, ["H9#0", "JK#0"])).toEqual(["JK#0", "H9#0"]);
	});

	it("refuses cards that do not all fit", () => {
		const meld = { ...run(["H5#0", "H6#0", "H7#0"]), id: 1 };
		expect(fitOnMeld(meld, ["H8#0", "S8#0"])).toBeNull();
	});

	it("keeps a full run from wrapping the ace round", () => {
		const full = {
			...run(
				["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"].map(
					(rank) => `H${rank}#0`,
				),
			),
			id: 1,
		};
		expect(extendMeld(full, "HA#1")).toBeNull();
		expect(extendMeld(full, "JK#0")).toBeNull();
	});
});
