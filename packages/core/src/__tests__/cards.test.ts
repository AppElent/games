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
	generalOptions,
	getCardGame,
	nextStarter,
	normalizeOptions,
	plainCardOption,
	resolvedRules,
	viewCardGame,
} from "../cards/engine";
import {
	applyGin,
	arrangeHand,
	botGinMove,
	createGin,
	type GinAction,
	type GinRules,
	type GinState,
	viewGin,
} from "../cards/gin";
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

/** Every card a state holds, wherever it is: none may appear or vanish. */
function allCards(state: CardGameState) {
	switch (state.family) {
		case "shedding":
			return [...state.stock, ...state.discard, ...state.hands.flat()];
		case "rummy":
		case "gin":
			return [
				...state.stock,
				...state.discard,
				...state.hands.flat(),
				...state.melds.flatMap((meld) => meld.cards),
			];
		case "bank":
			return [
				...state.stock,
				...state.discard,
				...state.hands.flat(),
				...state.bank,
			];
		case "tricks":
			return [
				...state.hands.flat(),
				...state.passing.flatMap((cards) => cards ?? []),
				...state.trick.map((play) => play.card),
				...state.taken.flat(),
				...(state.stock ?? []),
				...(state.mucked ?? []),
			];
	}
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
	it("builds a short deck from the given ranks", () => {
		const deck = buildDeck(1, 0, ["7", "8", "9", "10", "J", "Q", "K", "A"]);
		expect(deck).toHaveLength(32);
		expect(deck).not.toContain("S2#0");
	});

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

		const gin = createCardGame(getCardGame("gin-rummy"), [], 2, seeded(2));
		expect(gin.family === "gin" && gin.turn).toBe(0);
		const rematch = createCardGame(
			getCardGame("gin-rummy"),
			[],
			2,
			seeded(2),
			nextStarter(gin),
		);
		expect(rematch.family === "gin" && rematch.turn).toBe(1);
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
	const rulesWith = (options: string[]) =>
		resolvedRules(game, options, null).rules as SheddingRules;

	it("offers a switch for every special card", () => {
		for (const key of Object.keys(pestenRules.powers)) {
			expect(plainCardOption(game, key)).toBeDefined();
		}
		expect(generalOptions(game).map((option) => option.id)).toEqual([
			"noFinishOnPower",
			"noStacking",
			"noLastCard",
			"mustPlay",
			"noPlayDrawn",
		]);
	});

	it("switched-off special cards combine and leave the rest alone", () => {
		const rules = rulesWith(["plain7", "plainA"]);
		expect(Object.keys(rules.powers).sort()).toEqual(
			["2", "8", "J", "joker"].sort(),
		);
		expect(pestenRules.powers["7"]).toBeDefined();
	});

	it("a plain 7 passes the turn like any other card", () => {
		const state = pestenState({
			hands: [["S7#0", "S9#0", "D3#0"], ["D4#0"], ["H6#0"]],
		});
		const next = applyShedding(
			rulesWith(["plain7"]),
			state,
			0,
			{ type: "play", card: "S7#0" },
			seeded(2),
		);
		expect(next.turn).toBe(1);
		expect(next.mustContinue).toBe(false);
	});

	it("a plain jack only goes on its suit or rank", () => {
		const state = pestenState({
			hands: [["HJ#0", "S9#0"], ["D4#0"], ["H6#0"]],
		});
		expectRule(
			() =>
				applyShedding(
					rulesWith(["plainJ"]),
					state,
					0,
					{ type: "play", card: "HJ#0" },
					seeded(2),
				),
			"cardsDoesNotFit",
		);
	});

	it("no jokers takes them out of the deck", () => {
		const state = createCardGame(game, ["plainJoker"], 4, seeded(7));
		const all = allCards(state);
		expect(all.some((card) => parseCard(card).joker)).toBe(false);
		expect(rulesWith(["plainJoker"]).powers.joker).toBeUndefined();
	});

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
	// At a bank table every hand is dealt face up; its own test covers the bank's card.
	const privateHands = CARD_GAME_IDS.filter(
		(id) => CARD_GAMES[id].family !== "bank",
	);
	it.each(privateHands)("%s hides other hands and the stock", (id) => {
		const game = getCardGame(id);
		const seats = Math.min(Math.max(3, game.players.min), game.players.max);
		const state = createCardGame(game, [], seats, seeded(21));
		const mine = viewCardGame(game, [], state, 0);
		const otherCards = state.hands[1];
		const serialized = JSON.stringify(mine);
		for (const card of otherCards) {
			expect(serialized).not.toContain(`"${card}"`);
		}
		for (const card of ("stock" in state ? state.stock : undefined) ?? []) {
			expect(serialized).not.toContain(`"${card}"`);
		}
		const spectator = viewCardGame(game, [], state, null);
		expect("hand" in spectator && spectator.hand).toEqual([]);
		expect(spectator.handCounts).toEqual(
			state.hands.map((hand) => hand.length),
		);
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
	let total = allCards(state).length;
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
		// A schedule of growing hands leaves cards undealt: count each deal afresh.
		if (move.action.type === "nextRound") {
			total = allCards(state).length;
		}
		const cards = allCards(state);
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

	it("gin rummy bots never make an illegal move over many matches", () => {
		for (let seed = 1; seed <= 150; seed += 1) {
			const final = playOut(getCardGame("gin-rummy"), [], 2, seed);
			if (final.family !== "gin") throw new Error("gin");
			expect(final.phase).toBe("finished");
			const totals = [0, 1].map((seat) =>
				final.scores.reduce((sum, hand) => sum + hand[seat], 0),
			);
			expect(Math.max(...totals)).toBeGreaterThanOrEqual(100);
		}
	}, 60_000);

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

	it.each([1, 3, 6])(
		"eenentwintigen bots never make an illegal move with %i seats",
		(seats) => {
			for (let seed = 1; seed <= 150; seed += 1) {
				expect(
					playOut(getCardGame("eenentwintigen"), [], seats, seed).phase,
				).toBe("finished");
			}
		},
		30_000,
	);

	it.each([
		["pesten", ["noFinishOnPower", "noStacking", "noLastCard"]],
		["maumau", ["noStacking", "noLastCard"]],
		["maumau", ["plain7", "plain8", "plainJ"]],
		[
			"pesten",
			[
				"plain2",
				"plainJoker",
				"plain7",
				"plain8",
				"plainJ",
				"plainA",
				"noLastCard",
			],
		],
		["jokeren", ["fullMatch", "stockOnly", "openAt40"]],
		["klaverjassen", ["forcedTrump", "amsterdams", "shortMatch"]],
		["eenentwintigen", ["doubleDown", "bankHitsSoft17", "longMatch"]],
		["gin-rummy", ["shortMatch"]],
	] as const)("%s finishes with every house rule on", (id, options) => {
		for (let seed = 1; seed <= 12; seed += 1) {
			const game = getCardGame(id);
			const seats = Math.min(4, game.players.max);
			const final = playOut(game, [...options], seats, seed * 41);
			expect(final.phase).toBe("finished");
		}
	});
});

describe("mau-mau", () => {
	const game = getCardGame("maumau");

	it("deals five cards each from a 32-card deck without jokers", () => {
		const state = createCardGame(game, [], 4, seeded(3));
		const all = allCards(state);
		expect(all).toHaveLength(32);
		expect(state.hands.every((hand) => hand.length === 5)).toBe(true);
		const ranks = new Set(all.map((card) => parseCard(card).rank));
		expect([...ranks].sort()).toEqual(
			["7", "8", "9", "10", "J", "Q", "K", "A"].sort(),
		);
		expect(all.some((card) => parseCard(card).joker)).toBe(false);
	});

	it("7 makes the next player draw two, 2 is a plain card", () => {
		const rules = resolvedRules(game, [], null).rules as SheddingRules;
		expect(rules.powers).toEqual({
			"7": { kind: "draw", amount: 2 },
			"8": { kind: "skip" },
			J: { kind: "chooseSuit" },
		});
	});

	it("starts even when the stock left after dealing holds only special cards", () => {
		const specials = [
			"S7",
			"H7",
			"D7",
			"C7",
			"S8",
			"H8",
			"D8",
			"C8",
			"SJ",
			"HJ",
			"DJ",
			"CJ",
		];
		// Seeded shuffles almost never do this, so stack the deck by hand.
		const rules = {
			...(game.rules as SheddingRules),
			handSize: 1,
			ranks: ["7", "8", "J"] as const,
		};
		const state = createShedding(rules, 2, seeded(1));
		expect(state.discard).toHaveLength(1);
		expect(specials.map((card) => `${card}#0`)).toContain(state.discard[0]);
		expect(state.stock).toHaveLength(9);
	});

	it("bots finish games from two to five players", () => {
		for (let seats = 2; seats <= 5; seats += 1) {
			for (let seed = 1; seed <= 25; seed += 1) {
				expect(playOut(game, [], seats, seed).phase).toBe("finished");
			}
		}
	}, 30_000);
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

describe("gin rummy", () => {
	const rules = CARD_GAMES["gin-rummy"].rules as GinRules;
	const shortRules = resolvedRules(
		getCardGame("gin-rummy"),
		["shortMatch"],
		null,
	).rules as GinRules;
	const ids = (faces: string) => faces.split(" ").map((face) => `${face}#0`);

	/** Seat 0 on turn with a full hand to play; the stock is whatever is left. */
	function ginState(
		hands: [string, string],
		overrides: Partial<GinState> = {},
	): GinState {
		const held = hands.map(ids);
		const discard = overrides.discard ?? ids("C5");
		const used = new Set([...held.flat(), ...discard]);
		return {
			...createGin(rules, 2, seeded(5)),
			hands: held,
			stock: buildDeck(1, 0).filter((card) => !used.has(card)),
			discard,
			turn: 0,
			phase: "play",
			events: [],
			...overrides,
		};
	}

	const act = (
		state: GinState,
		seat: number,
		action: GinAction,
		withRules = rules,
	) => applyGin(withRules, state, seat, action, seeded(9));

	// Spades 2-4, hearts 5-7, diamonds 9-J: three runs, then deadwood.
	const KNOCKER = "S2 S3 S4 H5 H6 H7 D9 D10 DJ";

	it("deals ten each from one deck without jokers, the non-dealer first", () => {
		const state = createCardGame(getCardGame("gin-rummy"), [], 2, seeded(3));
		if (state.family !== "gin") throw new Error("gin");
		expect(state.hands.map((hand) => hand.length)).toEqual([10, 10]);
		const all = [...state.stock, ...state.discard, ...state.hands.flat()];
		expect(all).toHaveLength(52);
		expect(all.some((card) => card.startsWith("JK"))).toBe(false);
		expect(state.discard).toHaveLength(1);
		expect(state.turn).toBe((state.dealer + 1) % 2);
		expect(state.phase).toBe("draw");
	});

	it("takes exactly two players", () => {
		expectRule(
			() => createCardGame(getCardGame("gin-rummy"), [], 3, seeded(1)),
			"notEnoughPlayers",
		);
	});

	describe("deadwood", () => {
		it("counts ace 1, face cards 10", () => {
			expect(arrangeHand(ids("SA SK HQ DJ C9"), rules).points).toBe(40);
		});

		it("picks the melds that leave the least deadwood", () => {
			// The seven of spades fits the set or the run, not both.
			const hand = ids("S7 S8 S9 H7 D7");
			expect(arrangeHand(hand, rules).points).toBe(14);
			expect(arrangeHand([...hand, "C7#0"], rules).points).toBe(0);
		});

		it("plays the ace low only", () => {
			expect(arrangeHand(ids("SA S2 S3"), rules).points).toBe(0);
			expect(arrangeHand(ids("SQ SK SA"), rules).points).toBe(21);
		});

		it("finds a set of four and runs of any length", () => {
			const hand = ids("H4 S4 D4 C4 C5 C6 C7 C8 HK DK");
			const arranged = arrangeHand(hand, rules);
			// The club four goes to the run or the set; either way only the kings are left.
			expect(arranged.points).toBe(20);
			expect(arranged.deadwood.sort()).toEqual(ids("DK HK").sort());
		});
	});

	describe("illegal moves", () => {
		const drawState = () =>
			ginState([`${KNOCKER} C2`, "S5 H8 DQ C3 C4 HK SK DK C7 H2"], {
				phase: "draw",
			});
		const playState = () =>
			ginState([`${KNOCKER} C2 CK`, "S5 H8 DQ C3 C4 HK SK DK C7 H2"]);

		it("refuses moves out of turn", () => {
			expectRule(
				() => act(drawState(), 1, { type: "drawStock" }),
				"notYourTurn",
			);
			expectRule(
				() => act(playState(), 1, { type: "discard", card: "H8#0" }),
				"notYourTurn",
			);
			expectRule(
				() => act(playState(), 1, { type: "knock", card: "H8#0" }),
				"notYourTurn",
			);
		});

		it("draws exactly once, before discarding or knocking", () => {
			expectRule(
				() => act(drawState(), 0, { type: "discard", card: "C2#0" }),
				"cardsDrawFirst",
			);
			expectRule(
				() => act(drawState(), 0, { type: "knock", card: "C2#0" }),
				"cardsDrawFirst",
			);
			expectRule(
				() => act(playState(), 0, { type: "drawStock" }),
				"cardsAlreadyDrew",
			);
			expectRule(
				() => act(playState(), 0, { type: "takeDiscard" }),
				"cardsAlreadyDrew",
			);
		});

		it("refuses a card that isn't held", () => {
			expectRule(
				() => act(playState(), 0, { type: "discard", card: "H8#0" }),
				"cardsNotInHand",
			);
			expectRule(
				() => act(playState(), 0, { type: "knock", card: "H8#0" }),
				"cardsNotInHand",
			);
		});

		it("never returns the card just taken from the pile", () => {
			const taken = act(drawState(), 0, { type: "takeDiscard" });
			expect(taken.takenDiscard).toBe("C5#0");
			expectRule(
				() => act(taken, 0, { type: "discard", card: "C5#0" }),
				"cardsCannotReturnDiscard",
			);
			expectRule(
				() => act(taken, 0, { type: "knock", card: "C5#0" }),
				"cardsCannotReturnDiscard",
			);
		});

		it("refuses to knock above the limit", () => {
			const state = ginState([
				"S2 S3 S4 H5 H6 H7 C9 D8 CQ SQ CK",
				"S5 H8 DQ C3 C4 HK SK DK C7 H2",
			]);
			try {
				act(state, 0, { type: "knock", card: "CK#0" });
				throw new Error("expected a refusal");
			} catch (caught) {
				expect((caught as GameRuleError).code).toBe("cardsKnockTooHigh");
				expect((caught as GameRuleError).params).toEqual({
					deadwood: 37,
					limit: 10,
				});
			}
		});

		it("lays off only after a knock, only by the defender, only cards that fit", () => {
			expectRule(
				() =>
					act(playState(), 0, { type: "layOff", meldId: 1, cards: ["S5#0"] }),
				"cardsNoKnock",
			);
			expectRule(
				() => act(playState(), 0, { type: "finishLayoff" }),
				"cardsNoKnock",
			);
			const knocked = act(playState(), 0, { type: "knock", card: "CK#0" });
			expect(knocked.phase).toBe("layoff");
			expectRule(
				() => act(knocked, 1, { type: "drawStock" }),
				"cardsAfterKnock",
			);
			expectRule(
				() => act(knocked, 1, { type: "discard", card: "C3#0" }),
				"cardsAfterKnock",
			);
			expectRule(
				() => act(knocked, 0, { type: "layOff", meldId: 1, cards: ["C2#0"] }),
				"notYourTurn",
			);
			expectRule(
				() => act(knocked, 0, { type: "finishLayoff" }),
				"notYourTurn",
			);
			expectRule(
				() => act(knocked, 1, { type: "layOff", meldId: 1, cards: [] }),
				"cardsNothingToLay",
			);
			expectRule(
				() => act(knocked, 1, { type: "layOff", meldId: 99, cards: ["S5#0"] }),
				"cardsInvalidMeld",
			);
			expectRule(
				() => act(knocked, 1, { type: "layOff", meldId: 1, cards: ["S6#0"] }),
				"cardsNotInHand",
			);
			expectRule(
				() =>
					act(knocked, 1, {
						type: "layOff",
						meldId: 1,
						cards: ["S5#0", "S5#0"],
					}),
				"cardsNotInHand",
			);
			expectRule(
				() => act(knocked, 1, { type: "layOff", meldId: 1, cards: ["H8#0"] }),
				"cardsDoesNotExtend",
			);
		});

		it("keeps the ace low when laying off", () => {
			const state = ginState([
				"SJ SQ SK H5 H6 H7 D9 D10 DJ C2 CK",
				"SA H8 DQ C3 C4 HK DK CQ C7 H2",
			]);
			const knocked = act(state, 0, { type: "knock", card: "CK#0" });
			const spades = knocked.melds.find((meld) => meld.cards.includes("SK#0"));
			expectRule(
				() =>
					act(knocked, 1, {
						type: "layOff",
						meldId: spades?.id ?? 0,
						cards: ["SA#0"],
					}),
				"cardsDoesNotExtend",
			);
		});

		it("waits for the next deal once a hand is over", () => {
			const over = act(
				ginState([`${KNOCKER} C2 CK`, "S5 H8 DQ C3 C4 HK SK DK C7 H2"]),
				0,
				{ type: "knock", card: "CK#0" },
			);
			const scored = act(over, 1, { type: "finishLayoff" });
			expect(scored.phase).toBe("handOver");
			expectRule(() => act(scored, 0, { type: "drawStock" }), "noActiveRound");
			expectRule(
				() => act(scored, 1, { type: "finishLayoff" }),
				"noActiveRound",
			);
			expectRule(
				() => act(playState(), 0, { type: "nextRound" }),
				"currentGameNotFinished",
			);
		});

		it("refuses another family's moves", () => {
			const game = getCardGame("gin-rummy");
			const state = createCardGame(game, [], 2, seeded(1));
			expectRule(
				() =>
					applyCardAction(game, [], state, state.turn, {
						type: "play",
						card: "S2#0",
					}),
				"cardsWrongAction",
			);
		});
	});

	describe("scoring", () => {
		const DEFENDER = "S5 H8 DQ C3 C4 HK SK DK C7 H2";

		it("lays an ace off below a run that starts at two", () => {
			const state = ginState([
				"S5 S6 S7 S8 S9 S10 SJ SQ SK C2 CK",
				"SA S2 S3 S4 H8 DQ C3 C4 HK DK",
			]);
			const knocked = act(state, 0, { type: "knock", card: "CK#0" });
			const laid = act(knocked, 1, {
				type: "layOff",
				meldId: knocked.melds[0].id,
				cards: ids("SA S2 S3 S4"),
			});
			expect(laid.melds[0]).toMatchObject({ low: 1 });
			expect(laid.melds[0].cards.slice(0, 5)).toEqual(ids("SA S2 S3 S4 S5"));
		});

		it("knocks, lets the defender lay off, and scores the difference", () => {
			let state = act(ginState([`${KNOCKER} C2 CK`, DEFENDER]), 0, {
				type: "knock",
				card: "CK#0",
			});
			expect(state.discard.at(-1)).toBe("CK#0");
			expect(state.melds).toHaveLength(3);
			expect(state.hands[0]).toEqual(["C2#0"]);
			expect(state.turn).toBe(1);
			expect(state.events.map((event) => event.type)).toEqual([
				"discard",
				"meld",
				"knock",
			]);
			// Lay-off order doesn't matter: the queen of diamonds goes after the jack.
			for (const [suit, card] of [
				["S", "S5#0"],
				["H", "H8#0"],
				["D", "DQ#0"],
			]) {
				const meld = state.melds.find(
					(m) => m.kind === "run" && m.suit === suit,
				);
				state = act(state, 1, {
					type: "layOff",
					meldId: meld?.id ?? 0,
					cards: [card],
				});
			}
			expect(state.hands[1]).toHaveLength(7);
			state = act(state, 1, { type: "finishLayoff" });
			// Defender keeps K K K and 3+4+7+2 = 16 deadwood; the knocker has 2.
			expect(state.result).toMatchObject({
				kind: "knock",
				knocker: 0,
				winner: 0,
				points: 14,
				deadwood: [2, 16],
			});
			expect(state.scores).toEqual([[14, 0]]);
			expect(state.phase).toBe("handOver");
		});

		it("scores what the defender holds when they lay nothing off", () => {
			const state = act(
				act(ginState([`${KNOCKER} C2 CK`, DEFENDER]), 0, {
					type: "knock",
					card: "CK#0",
				}),
				1,
				{ type: "finishLayoff" },
			);
			expect(state.result?.points).toBe(39 - 2);
		});

		const knockAndFinish = (knocker: string, defender: string) =>
			act(
				act(ginState([`${KNOCKER} ${knocker} CK`, defender]), 0, {
					type: "knock",
					card: "CK#0",
				}),
				1,
				{ type: "finishLayoff" },
			);

		it("gives an undercut to a defender with less deadwood", () => {
			// Defender keeps three melds and the three of clubs: 3 under the knocker's 8.
			const state = knockAndFinish("C8", "D2 D3 D4 HK SK DK HQ SQ DQ C3");
			expect(state.result).toMatchObject({
				kind: "undercut",
				winner: 1,
				points: 8 - 3 + 25,
				deadwood: [8, 3],
			});
			expect(state.scores).toEqual([[0, 30]]);
		});

		it("undercuts after laying off", () => {
			let state = act(
				ginState([`${KNOCKER} C9 CK`, "S5 S6 H8 HK SK DK HQ SQ DQ C3"]),
				0,
				{ type: "knock", card: "CK#0" },
			);
			const spades = state.melds.find((meld) => meld.cards.includes("S2#0"));
			const hearts = state.melds.find((meld) => meld.cards.includes("H5#0"));
			state = act(state, 1, {
				type: "layOff",
				meldId: spades?.id ?? 0,
				cards: ids("S6 S5"),
			});
			state = act(state, 1, {
				type: "layOff",
				meldId: hearts?.id ?? 0,
				cards: ids("H8"),
			});
			state = act(state, 1, { type: "finishLayoff" });
			// Kings and queens are sets; the three of clubs is under the knocker's 9.
			expect(state.result).toMatchObject({
				kind: "undercut",
				winner: 1,
				points: 9 - 3 + 25,
				deadwood: [9, 3],
			});
			expect(state.events.at(-1)).toMatchObject({
				type: "handEnd",
				winner: 1,
				kind: "undercut",
				points: 31,
			});
		});

		it("counts equal deadwood as an undercut", () => {
			const state = knockAndFinish("C4", "D2 D3 D4 C6 C7 C8 HK SK DK H4");
			expect(state.result).toMatchObject({
				kind: "undercut",
				winner: 1,
				points: 25,
				deadwood: [4, 4],
			});
		});

		it("goes gin with no deadwood: a bonus and no lay-offs", () => {
			const state = act(ginState([`${KNOCKER} D8 CK`, DEFENDER]), 0, {
				type: "knock",
				card: "CK#0",
			});
			expect(state.phase).toBe("handOver");
			expect(state.events.slice(-2)).toMatchObject([
				{ type: "knock", gin: true },
				{ type: "handEnd", winner: 0, kind: "gin", points: 64 },
			]);
			// The defender's 39 stays whole, though S5 and H8 would have fit.
			expect(state.result).toMatchObject({
				kind: "gin",
				winner: 0,
				points: 39 + 25,
			});
		});

		it("calls the hand off when the stock runs low without a knock", () => {
			const base = ginState([`${KNOCKER} C9 CK`, DEFENDER]);
			const state = act({ ...base, stock: base.stock.slice(0, 2) }, 0, {
				type: "discard",
				card: "CK#0",
			});
			expect(state.phase).toBe("handOver");
			expect(state.result).toMatchObject({
				kind: "void",
				winner: null,
				points: 0,
			});
			expect(state.scores).toEqual([[0, 0]]);
			const next = act(state, 1, { type: "nextRound" });
			expect(next.round).toBe(2);
			expect(next.scores).toEqual([[0, 0]]);
			expect(next.hands.map((hand) => hand.length)).toEqual([10, 10]);
			expect(next.dealer).toBe((state.dealer + 1) % 2);
		});

		it("ends the match at the target, or at 50 with the short-match rule", () => {
			const knock = (scores: number[][], withRules: GinRules) =>
				act(
					act(ginState([`${KNOCKER} C2 CK`, DEFENDER], { scores }), 0, {
						type: "knock",
						card: "CK#0",
					}),
					1,
					{ type: "finishLayoff" },
					withRules,
				);
			const full = knock([[90, 40]], rules);
			expect(full.phase).toBe("finished");
			expect(full.winners).toEqual([0]);
			expect(knock([[40, 40]], rules).phase).toBe("handOver");
			expect(knock([[40, 40]], shortRules).phase).toBe("finished");
		});
	});

	describe("view", () => {
		it("never shows a hidden card over whole bot matches", () => {
			// One expect at the end: thousands of matcher calls make this slow on CI.
			const leaks: string[] = [];
			for (let seed = 1; seed <= 20; seed += 1) {
				const random = seeded(seed);
				let state = createGin(rules, 2, random);
				while (state.phase !== "finished") {
					// Only this hand counts: the log keeps earlier deals, and a card
					// that has been on the discard pile is public.
					const dealt = state.events.map((e) => e.type).lastIndexOf("deal");
					const thisHand = state.events.slice(dealt);
					const seen = new Set([
						...state.discard,
						...thisHand.flatMap((e) => (e.type === "discard" ? [e.card] : [])),
					]);
					const views = [0, 1, null].map((seat) => {
						const { events: _, ...rest } = viewGin(rules, state, seat);
						return JSON.stringify([rest, thisHand]);
					});
					const hidden = (cards: readonly string[]) =>
						cards.filter((card) => !seen.has(card));
					const check = (cards: readonly string[], seats: number[]) => {
						for (const card of hidden(cards)) {
							for (const viewer of seats) {
								if (views[viewer].includes(`"${card}"`)) {
									leaks.push(`seed ${seed}: ${card} to view ${viewer}`);
								}
							}
						}
					};
					check(state.stock, [0, 1, 2]);
					for (const seat of [0, 1]) {
						// The knocker's hand is open from the knock; every hand once scored.
						if (state.phase !== "handOver" && state.knock?.seat !== seat) {
							check(state.hands[seat], [1 - seat, 2]);
						}
					}
					const move = botGinMove(rules, state, [0, 1]);
					if (!move) throw new Error(`bot stuck in ${state.phase}`);
					state = applyGin(rules, state, move.seat, move.action, random);
				}
			}
			expect(leaks).toEqual([]);
		}, 30_000);

		it("hides the other hand until it is scored, and shows the knocker's", () => {
			const state = ginState([
				`${KNOCKER} C2 CK`,
				"S5 H8 DQ C3 C4 HK SK DK C7 H2",
			]);
			const defenderCards = state.hands[1];
			const before = JSON.stringify(viewGin(rules, state, 0));
			for (const card of defenderCards) {
				expect(before).not.toContain(`"${card}"`);
			}
			const knocked = act(state, 0, { type: "knock", card: "CK#0" });
			const knockerView = viewGin(rules, knocked, 0);
			for (const card of defenderCards) {
				expect(JSON.stringify(knockerView)).not.toContain(`"${card}"`);
			}
			const defenderView = viewGin(rules, knocked, 1);
			expect(defenderView.knockerDeadwood).toEqual(["C2#0"]);
			expect(defenderView.melds).toHaveLength(3);
			const scored = act(knocked, 1, { type: "finishLayoff" });
			expect(viewGin(rules, scored, 0).result?.shown[1].deadwood).toContain(
				"C3#0",
			);
		});
	});

	describe("computer player", () => {
		it("knocks as soon as it can", () => {
			const state = ginState([
				`${KNOCKER} C2 CK`,
				"S5 H8 DQ C3 C4 HK SK DK C7 H2",
			]);
			expect(botGinMove(rules, state, [0])?.action).toEqual({
				type: "knock",
				card: "CK#0",
			});
		});

		it("takes a discard that completes a meld", () => {
			const state = ginState(
				["S2 S3 H9 C9 D8 HK CQ DJ S7 H4", "S5 H8 DQ C3 C4 D5 SK DK C7 H2"],
				{
					phase: "draw",
					discard: ["S4#0"],
				},
			);
			expect(botGinMove(rules, state, [0])?.action).toEqual({
				type: "takeDiscard",
			});
		});

		it("lays off what lowers its deadwood, then finishes", () => {
			let state = act(
				ginState([`${KNOCKER} C2 CK`, "S5 H8 DQ C3 C4 HK SK DK C7 H2"]),
				0,
				{ type: "knock", card: "CK#0" },
			);
			const moves: string[] = [];
			for (let step = 0; step < 10 && state.phase === "layoff"; step += 1) {
				const move = botGinMove(rules, state, [1]);
				if (!move) throw new Error("bot stuck");
				moves.push(move.action.type);
				state = act(state, move.seat, move.action);
			}
			expect(moves).toEqual(["layOff", "layOff", "layOff", "finishLayoff"]);
			expect(state.result?.deadwood[1]).toBe(16);
		});

		it("leaves the next deal to a person", () => {
			const over = act(
				act(
					ginState([`${KNOCKER} C2 CK`, "S5 H8 DQ C3 C4 HK SK DK C7 H2"]),
					0,
					{
						type: "knock",
						card: "CK#0",
					},
				),
				1,
				{ type: "finishLayoff" },
			);
			expect(botGinMove(rules, over, [1])).toBeNull();
			expect(botGinMove(rules, over, [0, 1])?.action).toEqual({
				type: "nextRound",
			});
		});
	});
});
