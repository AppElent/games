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
import { roemOf } from "../cards/roem";
import {
	cardValue,
	choosePointsCard,
	chooseTrumpCall,
	legalTricksCards,
	type TricksRules,
	type TricksState,
	type TricksView,
	tricksDeck,
	trickWinner,
} from "../cards/tricks";
import { GameRuleError } from "../errors";
import { mulberry32 } from "../random";

/** A seat's view, which for this game is always a trick-taking one. */
function viewOf(
	state: TricksState,
	seat: number | null,
	options: string[] = [],
) {
	return viewCardGame(game, options, state, seat) as TricksView;
}

const game = getCardGame("klaverjassen");

function rulesWith(options: string[] = []): TricksRules {
	const resolved = resolvedRules(game, options);
	if (resolved.family !== "tricks") {
		throw new Error("klaverjassen plays tricks");
	}
	return resolved.rules;
}

const rules = rulesWith();
const AMSTERDAMS = ["amsterdams"];

function deal(options: string[] = [], seed = 1) {
	return createCardGame(game, options, 4, mulberry32(seed)) as TricksState;
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
		mulberry32(9),
	) as TricksState;
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

/**
 * A trick under way with hearts as trump: `trick` already on the table, and
 * seat `turn` to play from `hand`. Seats 0 and 2 are partners, as are 1 and 3.
 */
function midTrick(
	trick: Array<[number, string]>,
	turn: number,
	hand: string[],
	overrides: Partial<TricksState> = {},
): TricksState {
	const base = deal();
	const hands = [[], [], [], []] as string[][];
	hands[turn] = hand;
	return {
		...base,
		phase: "playing",
		trump: "H",
		maker: 0,
		hands,
		trick: trick.map(([seat, card]) => ({ seat, card })),
		turn,
		events: [],
		...overrides,
	};
}

function legalIn(state: TricksState, options: string[] = []) {
	return legalTricksCards(rulesWith(options), state, state.turn);
}

describe("klaverjassen deal", () => {
	it("deals the 32-card deck to exactly four players, eight each", () => {
		const state = deal();
		expect(tricksDeck(rules, 4)).toHaveLength(32);
		expect(state.hands.map((hand) => hand.length)).toEqual([8, 8, 8, 8]);
		expect(new Set(state.hands.flat()).size).toBe(32);
		expect(() => createCardGame(game, [], 3)).toThrow(GameRuleError);
		expect(() => createCardGame(game, [], 5)).toThrow(GameRuleError);
	});

	it("seats partners opposite each other", () => {
		expect(viewOf(deal(), 0).teams).toEqual([0, 1, 0, 1]);
	});

	it("puts a suit to the table and starts the call left of the dealer", () => {
		const state = deal();
		expect(state.phase).toBe("trump");
		expect(state.trump).toBeNull();
		expect(state.offered).toMatch(/^[SHDC]$/);
		expect(state.turn).toBe((state.dealer + 1) % 4);
	});
});

describe("klaverjassen trump call", () => {
	it("hands the trump to the first seat that plays the suit on offer", () => {
		const state = deal();
		const first = state.turn;
		const offered = state.offered as NonNullable<TricksState["offered"]>;
		const passed = act(state, first, { type: "passTrump" });
		expect(passed.turn).toBe((first + 1) % 4);
		const called = act(passed, passed.turn, {
			type: "chooseTrump",
			suit: offered,
		});
		expect(called.phase).toBe("playing");
		expect(called.trump).toBe(offered);
		expect(called.maker).toBe((first + 1) % 4);
		// The first trick is led from left of the dealer, whoever called.
		expect(called.turn).toBe(first);
		expect(called.events.at(-1)).toMatchObject({
			type: "trump",
			seat: (first + 1) % 4,
			suit: offered,
		});
	});

	it("makes the first seat choose any suit when everyone passes", () => {
		let state = deal();
		const first = state.turn;
		for (let i = 0; i < 4; i += 1) {
			state = act(state, state.turn, { type: "passTrump" });
		}
		expect(state.phase).toBe("trump");
		expect(state.turn).toBe(first);
		expect(state.offered).toBeNull();
		expect(viewOf(state, first).trumpPassed).toEqual([true, true, true, true]);
		expectRule(
			() => act(state, first, { type: "passTrump" }),
			"cardsMustChooseTrump",
		);
		const called = act(state, first, { type: "chooseTrump", suit: "S" });
		expect(called.trump).toBe("S");
		expect(called.maker).toBe(first);
	});

	it("refuses another suit while one is on offer, and calls out of turn", () => {
		const state = deal();
		const other = (["S", "H", "D", "C"] as const).find(
			(suit) => suit !== state.offered,
		);
		expectRule(
			() =>
				act(state, state.turn, {
					type: "chooseTrump",
					suit: other as NonNullable<typeof other>,
				}),
			"cardsTrumpNotOffered",
		);
		expectRule(
			() => act(state, (state.turn + 1) % 4, { type: "passTrump" }),
			"notYourTurn",
		);
	});

	it("refuses cards before trump and trump calls after it", () => {
		const state = deal();
		expectRule(
			() =>
				act(state, state.turn, {
					type: "play",
					card: state.hands[state.turn][0],
				}),
			"cardsCallTrumpFirst",
		);
		const called = act(state, state.turn, {
			type: "chooseTrump",
			suit: state.offered as NonNullable<TricksState["offered"]>,
		});
		expectRule(
			() => act(called, called.turn, { type: "passTrump" }),
			"cardsNotCallingTrump",
		);
	});

	it("lets nobody pass under forced trump", () => {
		const state = deal(["forcedTrump"]);
		expect(state.phase).toBe("trump");
		expect(state.offered).toBeNull();
		expectRule(
			() => act(state, state.turn, { type: "passTrump" }, ["forcedTrump"]),
			"cardsMustChooseTrump",
		);
		const called = act(state, state.turn, { type: "chooseTrump", suit: "D" }, [
			"forcedTrump",
		]);
		expect(called.trump).toBe("D");
	});
});

describe("klaverjassen card order and points", () => {
	it("ranks trumps J 9 A 10 K Q 8 7 and other suits A 10 K Q J 9 8 7", () => {
		const winner = (cards: string[]) =>
			trickWinner(
				rules,
				cards.map((card, seat) => ({ seat, card })),
				"H",
			);
		expect(winner(["HA#0", "H9#0", "HJ#0", "H10#0"])).toBe(2);
		expect(winner(["HA#0", "H9#0", "H10#0", "HK#0"])).toBe(1);
		expect(winner(["SK#0", "S10#0", "SJ#0", "SA#0"])).toBe(3);
		expect(winner(["SK#0", "S10#0", "SJ#0", "S9#0"])).toBe(1);
		expect(winner(["SA#0", "S10#0", "H7#0", "DA#0"])).toBe(2);
	});

	it("scores trump and plain cards apart, 152 in the deck", () => {
		expect(cardValue(rules, "HJ#0", "H")).toBe(20);
		expect(cardValue(rules, "H9#0", "H")).toBe(14);
		expect(cardValue(rules, "SJ#0", "H")).toBe(2);
		expect(cardValue(rules, "S9#0", "H")).toBe(0);
		expect(cardValue(rules, "HA#0", "H")).toBe(11);
		const deck = tricksDeck(rules, 4);
		expect(
			deck.reduce((sum, card) => sum + cardValue(rules, card, "H"), 0),
		).toBe(152);
	});
});

describe("klaverjassen follow and trump rules", () => {
	// Hearts are trump. Each case lists the trick so far, the seat to play and its hand.
	describe.each([
		["Rotterdams", [] as string[]],
		["Amsterdams", AMSTERDAMS],
	])("%s, both rule sets", (_name, options) => {
		it("must follow suit", () => {
			const state = midTrick([[0, "SA#0"]], 1, ["S7#0", "H7#0", "DA#0"]);
			expect(legalIn(state, options)).toEqual(["S7#0"]);
			expectRule(
				() => act(state, 1, { type: "play", card: "DA#0" }, options),
				"cardsMustFollow",
			);
		});

		it("must trump when void and an opponent has the trick", () => {
			const state = midTrick([[0, "SA#0"]], 1, ["H7#0", "DA#0"]);
			expect(legalIn(state, options)).toEqual(["H7#0"]);
			expectRule(
				() => act(state, 1, { type: "play", card: "DA#0" }, options),
				"cardsMustTrump",
			);
		});

		it("must overtrump an opponent's trump", () => {
			const state = midTrick(
				[
					[0, "SA#0"],
					[1, "H10#0"],
				],
				2,
				["H7#0", "HJ#0", "DA#0"],
				{ maker: 1 },
			);
			// Seat 1 (an opponent of seat 2) is winning with the ten of trump.
			expect(legalIn(state, options)).toEqual(["HJ#0"]);
			expectRule(
				() => act(state, 2, { type: "play", card: "H7#0" }, options),
				"cardsMustOvertrump",
			);
			expectRule(
				() => act(state, 2, { type: "play", card: "DA#0" }, options),
				"cardsMustOvertrump",
			);
		});

		it("may not undertrump while holding another card", () => {
			const state = midTrick(
				[
					[0, "SA#0"],
					[1, "HJ#0"],
				],
				2,
				["H7#0", "DA#0"],
			);
			expect(legalIn(state, options)).toEqual(["DA#0"]);
			expectRule(
				() => act(state, 2, { type: "play", card: "H7#0" }, options),
				"cardsNoUndertrump",
			);
		});

		it("undertrumps when it holds nothing but lower trumps", () => {
			const state = midTrick(
				[
					[0, "SA#0"],
					[1, "HJ#0"],
				],
				2,
				["H7#0", "H8#0"],
			);
			expect(legalIn(state, options)).toEqual(["H7#0", "H8#0"]);
		});

		it("must go higher when an opponent leads trump", () => {
			const state = midTrick([[1, "HA#0"]], 2, ["H7#0", "H9#0", "SA#0"]);
			expect(legalIn(state, options)).toEqual(["H9#0"]);
			expectRule(
				() => act(state, 2, { type: "play", card: "H7#0" }, options),
				"cardsMustOvertrump",
			);
		});

		it("plays any card of the suit led when it can't go higher in trump", () => {
			const state = midTrick([[1, "HJ#0"]], 2, ["H7#0", "H9#0", "SA#0"]);
			expect(legalIn(state, options)).toEqual(["H7#0", "H9#0"]);
		});

		it("plays anything when it holds neither the suit led nor trump", () => {
			const state = midTrick([[0, "SA#0"]], 1, ["DA#0", "C7#0"]);
			expect(legalIn(state, options)).toEqual(["DA#0", "C7#0"]);
		});
	});

	describe("while a partner has the trick", () => {
		it("Rotterdams still makes a void seat trump", () => {
			const state = midTrick(
				[
					[0, "SA#0"],
					[1, "S7#0"],
				],
				2,
				["H7#0", "DA#0"],
			);
			expect(legalIn(state)).toEqual(["H7#0"]);
			expectRule(
				() => act(state, 2, { type: "play", card: "DA#0" }),
				"cardsMustTrump",
			);
		});

		it("Amsterdams lets a void seat play any card", () => {
			const state = midTrick(
				[
					[0, "SA#0"],
					[1, "S7#0"],
				],
				2,
				["H7#0", "DA#0"],
			);
			expect(legalIn(state, AMSTERDAMS)).toEqual(["H7#0", "DA#0"]);
		});

		it("Rotterdams makes a seat overtrump its own partner", () => {
			const state = midTrick(
				[
					[0, "SA#0"],
					[1, "S7#0"],
					[2, "H10#0"],
				],
				3,
				["H7#0", "HJ#0", "DA#0"],
				{ maker: 1 },
			);
			// Seat 3's partner is seat 1, but seat 2 trumped: overtrump seat 2.
			expect(legalIn(state)).toEqual(["HJ#0"]);
			const partner = midTrick(
				[
					[0, "SA#0"],
					[1, "H10#0"],
					[2, "S7#0"],
				],
				3,
				["H7#0", "HJ#0", "DA#0"],
			);
			expect(legalIn(partner)).toEqual(["HJ#0"]);
			expectRule(
				() => act(partner, 3, { type: "play", card: "DA#0" }),
				"cardsMustOvertrump",
			);
		});

		it("Amsterdams lifts the overtrump but still bans undertrumping", () => {
			const state = midTrick(
				[
					[0, "SA#0"],
					[1, "H10#0"],
					[2, "S7#0"],
				],
				3,
				["H7#0", "HJ#0", "DA#0"],
			);
			expect(legalIn(state, AMSTERDAMS)).toEqual(["HJ#0", "DA#0"]);
			expectRule(
				() => act(state, 3, { type: "play", card: "H7#0" }, AMSTERDAMS),
				"cardsNoUndertrump",
			);
		});

		it("Amsterdams still makes a seat go higher when trumps are led", () => {
			const state = midTrick([[0, "HA#0"]], 2, ["H7#0", "H9#0"], {
				trick: [
					{ seat: 0, card: "HA#0" },
					{ seat: 1, card: "H8#0" },
				],
			});
			expect(legalIn(state, AMSTERDAMS)).toEqual(["H9#0"]);
			expect(legalIn(state)).toEqual(["H9#0"]);
			expectRule(
				() => act(state, 2, { type: "play", card: "H7#0" }, AMSTERDAMS),
				"cardsMustOvertrump",
			);
		});
	});
});

describe("roem", () => {
	it.each([
		[["H7#0", "H8#0", "H9#0", "SA#0"], "S", 20, ["three"]],
		[["H9#0", "H10#0", "HJ#0", "HQ#0"], "S", 50, ["four"]],
		[["SK#0", "SQ#0", "H7#0", "D9#0"], "S", 20, ["stuk"]],
		[["SJ#0", "SQ#0", "SK#0", "D9#0"], "S", 40, ["three", "stuk"]],
		[["SJ#0", "SQ#0", "SK#0", "SA#0"], "S", 70, ["four", "stuk"]],
		[["SA#0", "HA#0", "DA#0", "CA#0"], "S", 100, ["square"]],
		[["S7#0", "H7#0", "D7#0", "C7#0"], "S", 100, ["square"]],
		[["SJ#0", "HJ#0", "DJ#0", "CJ#0"], "S", 200, ["jacks"]],
		[["SK#0", "SQ#0", "H7#0", "D9#0"], "H", 0, []],
		[["H7#0", "H8#0", "H10#0", "HJ#0"], "S", 0, []],
		[["H8#0", "H9#0", "S10#0", "HA#0"], "S", 0, []],
	] as const)("%j with %s trump is worth %i", (cards, trump, points, kinds) => {
		expect(roemOf(cards, trump)).toEqual({ points, kinds });
	});

	it("goes to the team taking the trick, with a callout", () => {
		const state = midTrick(
			[
				[0, "S9#0"],
				[1, "S10#0"],
				[2, "SJ#0"],
			],
			3,
			["S7#0", "D7#0"],
		);
		state.hands = [["C7#0"], ["C8#0"], ["C9#0"], ["S7#0", "D7#0"]];
		const next = act(state, 3, { type: "play", card: "S7#0" });
		// 9 10 J of spades is a run of three; the ten takes the trick.
		expect(next.roem).toEqual([0, 20, 0, 0]);
		expect(next.lastTrick?.roem).toEqual({ points: 20, kinds: ["three"] });
		expect(next.events.at(-1)).toMatchObject({
			type: "roem",
			seat: 1,
			points: 20,
		});
	});
});

/**
 * The last trick of a deal, with each team's earlier tricks already taken.
 * Hearts are trump; the last cards are clubs, which seat `lastWinner` takes.
 */
function lastTrick({
	taken,
	roem = [0, 0, 0, 0],
	maker = 0,
	lastWinner,
}: {
	taken: string[][];
	roem?: number[];
	maker?: number;
	lastWinner: number;
}) {
	const low = ["C7#0", "C9#0", "CQ#0"];
	const hands = [0, 1, 2, 3].map((seat) =>
		seat === lastWinner ? ["CA#0"] : [low.shift() as string],
	);
	const state = midTrick([], 0, [], {
		hands,
		maker,
		roem,
		taken,
		tricksTaken: taken.map((cards) => cards.length / 4),
	});
	let next = state;
	for (let seat = 0; seat < 4; seat += 1) {
		next = act(next, seat, { type: "play", card: next.hands[seat][0] });
	}
	return next;
}

const ALL_BUT_CLUBS = tricksDeck(rules, 4).filter(
	(card) => !["C7#0", "C9#0", "CQ#0", "CA#0"].includes(card),
);

describe("klaverjassen scoring", () => {
	it("gives each team its points, roem and the last trick", () => {
		// Team 0 (seats 0, 2) takes the first 16 cards and the last trick.
		const state = lastTrick({
			taken: [ALL_BUT_CLUBS.slice(0, 16), ALL_BUT_CLUBS.slice(16), [], []],
			roem: [20, 0, 0, 0],
			lastWinner: 2,
		});
		const deal = state.lastDeal;
		expect(deal).not.toBeNull();
		const total = (deal?.points[0] ?? 0) + (deal?.points[1] ?? 0);
		expect(total).toBe(162);
		expect(deal?.roem).toEqual([20, 0]);
		expect(deal?.nat).toBe(false);
		expect(deal?.pit).toBeNull();
		expect(state.scores[0]).toEqual([
			deal?.scores[0],
			deal?.scores[1],
			deal?.scores[0],
			deal?.scores[1],
		]);
		expect(state.phase).toBe("roundOver");
	});

	it("sends everything to the other team when the callers go nat", () => {
		// Seat 1's team takes 24 cards, seat 0's team called trump.
		const state = lastTrick({
			taken: [ALL_BUT_CLUBS.slice(0, 4), ALL_BUT_CLUBS.slice(4), [], []],
			roem: [20, 20, 0, 0],
			maker: 0,
			lastWinner: 1,
		});
		expect(state.lastDeal?.nat).toBe(true);
		expect(state.lastDeal?.scores).toEqual([0, 162 + 40]);
		expect(state.events.some((event) => event.type === "nat")).toBe(true);
	});

	it("counts exactly half as nat", () => {
		const taken = [ALL_BUT_CLUBS.slice(0, 16), ALL_BUT_CLUBS.slice(16), [], []];
		const points = (cards: string[]) =>
			cards.reduce((sum, card) => sum + cardValue(rules, card, "H"), 0);
		// Seat 2 takes the last trick: the queen and ace of clubs and the bonus.
		const callers = points(taken[0]) + 3 + 11 + 10;
		const others = points(taken[1]);
		const roem =
			callers > others
				? [0, callers - others, 0, 0]
				: [others - callers, 0, 0, 0];
		const state = lastTrick({ taken, roem, maker: 0, lastWinner: 2 });
		expect(state.lastDeal?.nat).toBe(true);
		expect(state.lastDeal?.scores[0]).toBe(0);
	});

	it("adds pit for a team that takes every trick", () => {
		const state = lastTrick({
			taken: [ALL_BUT_CLUBS, [], [], []],
			lastWinner: 2,
		});
		expect(state.lastDeal?.pit).toBe(0);
		expect(state.lastDeal?.scores).toEqual([162 + 100, 0]);
		expect(state.events.some((event) => event.type === "pit")).toBe(true);
	});

	it("gives the defenders pit and everything when the callers take nothing", () => {
		const state = lastTrick({
			taken: [[], ALL_BUT_CLUBS, [], []],
			maker: 0,
			lastWinner: 1,
		});
		expect(state.lastDeal).toMatchObject({ nat: true, pit: 1 });
		expect(state.lastDeal?.scores).toEqual([0, 262]);
	});
});

describe("klaverjassen match", () => {
	it("ends after 16 deals, or 8 under the short match, highest team winning", () => {
		for (const [options, deals] of [
			[[], 16],
			[["shortMatch"], 8],
		] as const) {
			let state = createCardGame(
				game,
				[...options],
				4,
				mulberry32(4),
			) as TricksState;
			const everyone = [0, 1, 2, 3];
			let dealt = 1;
			while (state.phase !== "finished") {
				const move = botMove(
					game,
					[...options],
					state,
					everyone,
					mulberry32(dealt),
				);
				if (!move) {
					throw new Error(`stuck in ${state.phase}`);
				}
				state = applyCardAction(
					game,
					[...options],
					state,
					move.seat,
					move.action,
					mulberry32(dealt),
				) as TricksState;
				if (move.action.type === "nextRound") {
					dealt += 1;
				}
			}
			expect(state.scores).toHaveLength(deals);
			expect(state.round).toBe(deals);
			const totals = viewOf(state, 0, [...options]).totals;
			const best = Math.max(...totals);
			expect(state.winners.length).toBeGreaterThanOrEqual(2);
			for (const seat of state.winners) {
				expect(totals[seat]).toBe(best);
			}
			// Partners always win together.
			expect(new Set(state.winners.map((seat) => seat % 2)).size).toBe(
				state.winners.length === 4 ? 2 : 1,
			);
		}
	});
});

describe("klaverjassen view", () => {
	it("shows only the seat's own hand, in the call and in play", () => {
		const state = deal();
		const views = [0, 1, 2, 3].map(
			(seat) => viewCardGame(game, [], state, seat) as TricksView,
		);
		views.forEach((view, seat) => {
			expect(view.hand).toEqual(state.hands[seat]);
			const serialized = JSON.stringify(view);
			for (const other of [0, 1, 2, 3].filter((s) => s !== seat)) {
				for (const card of state.hands[other]) {
					expect(serialized).not.toContain(`"${card}"`);
				}
			}
			expect(view.offered).toBe(state.offered);
			expect(view.legal).toEqual([]);
		});
		const spectator = viewCardGame(game, [], state, null) as TricksView;
		expect(spectator.hand).toEqual([]);
		expect(spectator.handCounts).toEqual([8, 8, 8, 8]);
	});

	it("reports the match length, not a target", () => {
		const view = viewCardGame(game, ["shortMatch"], deal(["shortMatch"]), 0);
		expect(view).toMatchObject({ deals: 8, target: null });
	});
});

describe("klaverjassen bot", () => {
	it("calls a strong trump and passes on a weak one", () => {
		const strong = [
			"HJ#0",
			"H9#0",
			"HA#0",
			"H7#0",
			"SA#0",
			"D7#0",
			"C8#0",
			"C7#0",
		];
		const weak = [
			"H7#0",
			"H8#0",
			"SQ#0",
			"S8#0",
			"D7#0",
			"D8#0",
			"CQ#0",
			"C9#0",
		];
		expect(chooseTrumpCall(rules, strong, "H")).toBe("H");
		expect(chooseTrumpCall(rules, weak, "H")).toBeNull();
		// Made to choose, it picks its strongest suit.
		expect(chooseTrumpCall(rules, strong, null)).toBe("H");
	});

	it("feeds points to a partner who has the trick when it plays last", () => {
		const state = midTrick(
			[
				[1, "S7#0"],
				[2, "SA#0"],
				[3, "S8#0"],
			],
			0,
			["DA#0", "D7#0", "HJ#0"],
			{ trump: "H" },
		);
		state.hands = [["DA#0", "D7#0", "HJ#0"], ["C7#0"], ["C8#0"], ["C9#0"]];
		// Rotterdams would make it trump; under Amsterdams it may give its ace.
		expect(choosePointsCard(rulesWith(AMSTERDAMS), state, 0)).toBe("DA#0");
	});

	it("throws its cheapest card when the trick is lost", () => {
		const state = midTrick(
			[
				[0, "SA#0"],
				[1, "SK#0"],
				[2, "S7#0"],
			],
			3,
			["DA#0", "D7#0"],
			{ trump: "C" },
		);
		state.hands = [["C7#0"], ["C8#0"], ["C9#0"], ["DA#0", "D7#0"]];
		expect(choosePointsCard(rules, state, 3)).toBe("D7#0");
	});

	it.each([[[]], [["amsterdams"]], [["forcedTrump", "amsterdams"]]])(
		"never plays an illegal card over many seeds (%j)",
		(options) => {
			for (let seed = 1; seed <= 40; seed += 1) {
				let state = createCardGame(
					game,
					options,
					4,
					mulberry32(seed),
				) as TricksState;
				for (
					let step = 0;
					step < 2000 && state.phase !== "finished";
					step += 1
				) {
					const move = botMove(
						game,
						options,
						state,
						[0, 1, 2, 3],
						mulberry32(seed + step),
					);
					if (!move) {
						throw new Error(`stuck in ${state.phase}`);
					}
					state = applyCardAction(
						game,
						options,
						state,
						move.seat,
						move.action,
						mulberry32(seed + step),
					) as TricksState;
				}
				expect(state.phase).toBe("finished");
			}
		},
		30_000,
	);
});
