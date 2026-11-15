import { describe, expect, it } from "vitest";
import { cardFace } from "../cards/deck";
import {
	applyCardAction,
	botMove,
	CARD_GAMES,
	type CardAction,
	type CardGameState,
	createCardGame,
	getCardGame,
	resolvedRules,
	viewCardGame,
} from "../cards/engine";
import {
	botTricksMove,
	choosePass,
	chooseTricksCard,
	createTricks,
	legalTricksCards,
	passDirectionFor,
	type TricksRules,
	type TricksState,
	type TricksView,
	tricksDeck,
	trickWinner,
} from "../cards/tricks";
import { GameRuleError } from "../errors";
import { mulberry32 } from "../random";

const game = getCardGame("hartenjagen");
const rules = CARD_GAMES.hartenjagen.rules as unknown as TricksRules;

function rulesWith(options: string[]) {
	const resolved = resolvedRules(game, options);
	if (resolved.family !== "tricks") {
		throw new Error("hartenjagen plays tricks");
	}
	return resolved.rules;
}

/** A deal already under way, with hands chosen by the test. */
function playing(
	hands: string[][],
	overrides: Partial<TricksState> = {},
): TricksState {
	const base = createTricks(rules, hands.length, mulberry32(1), 0);
	return {
		...base,
		hands,
		phase: "playing",
		passDirection: "keep",
		turn: 0,
		events: [],
		...overrides,
	};
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

/** Every seat plays its first card in turn, which suits these hand-built deals. */
function playTrick(state: TricksState, cards: string[]) {
	let next = state;
	for (const card of cards) {
		next = act(next, next.turn, { type: "play", card });
	}
	return next;
}

describe("the deck", () => {
	it.each([
		[3, 51, 17],
		[4, 52, 13],
		[5, 50, 10],
		[6, 48, 8],
	])("with %i players deals %i cards, %i each", (seats, size, each) => {
		expect(tricksDeck(rules, seats)).toHaveLength(size);
		const state = createCardGame(game, [], seats, mulberry32(seats));
		expect(state.hands.every((hand) => hand.length === each)).toBe(true);
		expect(tricksDeck(rules, seats).map(cardFace)).toContain("C2");
	});

	it("takes out only low clubs and diamonds", () => {
		const removed = ["D2", "C3", "D3", "C4"];
		const faces = tricksDeck(rules, 6).map(cardFace);
		for (const face of removed) {
			expect(faces).not.toContain(face);
		}
		expect(faces.filter((face) => face.startsWith("H"))).toHaveLength(13);
		expect(faces).toContain("SQ");
	});
});

describe("passing", () => {
	it("cycles left, right, across, keep; odd tables never pass across", () => {
		expect(
			[1, 2, 3, 4, 5].map((round) => passDirectionFor(rules, 4, round)),
		).toEqual(["left", "right", "across", "keep", "left"]);
		expect(
			[1, 2, 3, 4].map((round) => passDirectionFor(rules, 3, round)),
		).toEqual(["left", "right", "keep", "left"]);
		expect(passDirectionFor(rulesWith(["noPassing"]), 4, 1)).toBe("keep");
	});

	it("starts with passing, and with the no-passing rule goes straight to play", () => {
		expect(createCardGame(game, [], 4, mulberry32(3)).phase).toBe("passing");
		const state = createCardGame(
			game,
			["noPassing"],
			4,
			mulberry32(3),
		) as TricksState;
		expect(state.phase).toBe("playing");
		expect(state.hands[state.turn].map(cardFace)).toContain("C2");
	});

	it("hands everyone's cards on once all have chosen, and the two of clubs leads", () => {
		let state = createCardGame(game, [], 4, mulberry32(5)) as TricksState;
		const chosen = state.hands.map((hand) => hand.slice(0, 3));
		for (const seat of [0, 1, 2]) {
			state = act(state, seat, { type: "passCards", cards: chosen[seat] });
			expect(state.phase).toBe("passing");
		}
		state = act(state, 3, { type: "passCards", cards: chosen[3] });
		expect(state.phase).toBe("playing");
		for (let seat = 0; seat < 4; seat += 1) {
			const to = (seat + 1) % 4;
			expect(state.received[to]).toEqual(chosen[seat]);
			for (const card of chosen[seat]) {
				expect(state.hands[to]).toContain(card);
			}
			expect(state.hands[seat]).toHaveLength(13);
		}
		expect(state.hands[state.turn].map(cardFace)).toContain("C2");
		expect(state.events.at(-1)).toMatchObject({
			type: "exchange",
			shift: 1,
			count: 3,
		});
	});

	it("refuses the wrong number, duplicates, foreign cards and a second pass", () => {
		const state = createCardGame(game, [], 4, mulberry32(6)) as TricksState;
		const hand = state.hands[0];
		expectRule(
			() => act(state, 0, { type: "passCards", cards: hand.slice(0, 2) }),
			"cardsPassCount",
		);
		expectRule(
			() =>
				act(state, 0, {
					type: "passCards",
					cards: [hand[0], hand[0], hand[1]],
				}),
			"cardsPassCount",
		);
		expectRule(
			() =>
				act(state, 0, {
					type: "passCards",
					cards: [hand[0], hand[1], state.hands[1][0]],
				}),
			"cardsNotInHand",
		);
		const passed = act(state, 0, {
			type: "passCards",
			cards: hand.slice(0, 3),
		});
		expectRule(
			() =>
				act(passed, 0, {
					type: "passCards",
					cards: passed.hands[0].slice(0, 3),
				}),
			"cardsAlreadyPassed",
		);
		expectRule(
			() => act(state, 0, { type: "play", card: hand[0] }),
			"cardsPassFirst",
		);
	});

	it("refuses passing once play has begun", () => {
		const state = playing([["C2#0"], ["C5#0"], ["C7#0"]]);
		expectRule(
			() => act(state, 0, { type: "passCards", cards: ["C2#0"] }),
			"cardsNotPassing",
		);
	});
});

describe("playing a trick", () => {
	it("opens with the two of clubs and nothing else", () => {
		const state = playing([["C9#0", "C2#0"], ["C5#0"], ["C7#0"]]);
		expect(legalTricksCards(rules, state, 0)).toEqual(["C2#0"]);
		expectRule(
			() => act(state, 0, { type: "play", card: "C9#0" }),
			"cardsMustOpenWith",
		);
	});

	it("must follow suit when able, and may play anything when not", () => {
		const state = act(
			playing([["C2#0"], ["C5#0", "H3#0"], ["S7#0", "H9#0"]]),
			0,
			{
				type: "play",
				card: "C2#0",
			},
		);
		expectRule(
			() => act(state, 1, { type: "play", card: "H3#0" }),
			"cardsMustFollow",
		);
		const followed = act(state, 1, { type: "play", card: "C5#0" });
		expect(legalTricksCards(rules, followed, 2)).toEqual(["S7#0", "H9#0"]);
	});

	it("refuses playing out of turn and cards you don't hold", () => {
		const state = playing([["C2#0"], ["C5#0"], ["C7#0"]]);
		expectRule(
			() => act(state, 1, { type: "play", card: "C5#0" }),
			"notYourTurn",
		);
		expectRule(
			() => act(state, 0, { type: "play", card: "C5#0" }),
			"cardsNotInHand",
		);
	});

	it("goes to the highest card of the suit led, who leads next", () => {
		let state = playing([
			["C2#0", "D4#0"],
			["CK#0", "D5#0"],
			["SA#0", "D6#0"],
		]);
		state = playTrick(state, ["C2#0", "CK#0", "SA#0"]);
		expect(state.lastTrick?.winner).toBe(1);
		expect(state.turn).toBe(1);
		expect(state.tricksTaken).toEqual([0, 1, 0]);
		expect(state.events.at(-1)).toMatchObject({
			type: "trickWon",
			seat: 1,
			points: 0,
		});
	});

	it("lets a trump take the trick, for games that have one", () => {
		const plays = [
			{ seat: 0, card: "HA#0" },
			{ seat: 1, card: "S2#0" },
			{ seat: 2, card: "HK#0" },
		];
		expect(trickWinner(rules, plays, null)).toBe(0);
		expect(trickWinner(rules, plays, "S")).toBe(1);
	});

	it("can't lead hearts until they're broken, unless that's all you have", () => {
		let state = playing([
			["C2#0", "H5#0", "D3#0"],
			["CA#0", "H6#0", "D9#0"],
			["S3#0", "H7#0", "D8#0"],
		]);
		state = playTrick(state, ["C2#0", "CA#0", "H7#0"]);
		expect(state.broken).toBe(true);
		expect(state.events.some((event) => event.type === "broken")).toBe(true);

		const unbroken = playing(
			[
				["H5#0", "D3#0"],
				["H6#0", "D9#0"],
				["H7#0", "D8#0"],
			],
			{ tricksTaken: [1, 0, 0] },
		);
		expectRule(
			() => act(unbroken, 0, { type: "play", card: "H5#0" }),
			"cardsLeadNotBroken",
		);
		const onlyHearts = playing([["H5#0"], ["H6#0"], ["H7#0"]], {
			tricksTaken: [1, 0, 0],
		});
		expect(act(onlyHearts, 0, { type: "play", card: "H5#0" }).broken).toBe(
			true,
		);
	});

	it("the queen of spades breaks hearts only under the house rule", () => {
		const state = playing(
			[
				["D2#0", "H5#0"],
				["SQ#0", "H6#0"],
				["D8#0", "H7#0"],
			],
			{ tricksTaken: [1, 0, 0] },
		);
		const plain = playTrick(state, ["D2#0", "SQ#0", "D8#0"]);
		expect(plain.broken).toBe(false);
		const withRule = ["queenBreaksHearts"];
		let ruled = act(state, 0, { type: "play", card: "D2#0" }, withRule);
		ruled = act(ruled, 1, { type: "play", card: "SQ#0" }, withRule);
		expect(ruled.broken).toBe(true);
	});

	it("does not mutate the previous state", () => {
		const state = playing([["C2#0"], ["C5#0"], ["C7#0"]]);
		const before = JSON.stringify(state);
		act(state, 0, { type: "play", card: "C2#0" });
		expect(JSON.stringify(state)).toBe(before);
	});

	it("refuses moves from another family and moves after the deal", () => {
		const state = playing([["C2#0"], ["C5#0"], ["C7#0"]]);
		expectRule(() => act(state, 0, { type: "draw" }), "cardsWrongAction");
		const over = { ...state, phase: "roundOver" as const };
		expectRule(
			() => act(over, 0, { type: "play", card: "C2#0" }),
			"noActiveRound",
		);
		expectRule(
			() => act(state, 0, { type: "nextRound" }),
			"currentGameNotFinished",
		);
	});
});

/** Gives each seat its taken cards and plays out the last trick to score the deal. */
function scored(
	taken: string[][],
	options: string[] = [],
	scores: number[][] = [],
) {
	const seats = taken.length;
	const state = playing(
		Array.from({ length: seats }, (_, seat) => [`D${seat + 5}#9`]),
		{ taken, scores, tricksTaken: [1, 0, 0, 0].slice(0, seats), broken: true },
	);
	// The last trick is all diamonds, worth nothing, and goes to the last seat.
	let next = state;
	for (let seat = 0; seat < seats; seat += 1) {
		next = act(next, seat, { type: "play", card: `D${seat + 5}#9` }, options);
	}
	return next;
}

const HEARTS = [
	"2",
	"3",
	"4",
	"5",
	"6",
	"7",
	"8",
	"9",
	"10",
	"J",
	"Q",
	"K",
	"A",
].map((rank) => `H${rank}#0`);

describe("scoring", () => {
	it("a heart is one point and the queen of spades thirteen", () => {
		const state = scored([
			HEARTS.slice(0, 4),
			["SQ#0", ...HEARTS.slice(4, 6)],
			HEARTS.slice(6),
			[],
		]);
		expect(state.scores.at(-1)).toEqual([4, 15, 7, 0]);
		expect(state.phase).toBe("roundOver");
		expect(state.moon).toBeNull();
	});

	it("shooting the moon gives everyone else 26", () => {
		const state = scored([[], [...HEARTS, "SQ#0", "C2#0"], [], []]);
		expect(state.scores.at(-1)).toEqual([26, 0, 26, 26]);
		expect(state.moon).toBe(1);
		expect(
			state.events.some((event) => event.type === "moon" && event.seat === 1),
		).toBe(true);
	});

	it("the jack of diamonds takes ten off, even for a moon shooter", () => {
		const options = ["jackOfDiamonds"];
		expect(
			scored([["DJ#0", "H2#0"], ["SQ#0"], [], []], options).scores.at(-1),
		).toEqual([-9, 13, 0, 0]);
		const moon = scored([[...HEARTS, "SQ#0", "DJ#0"], [], [], []], options);
		expect(moon.scores.at(-1)).toEqual([-10, 26, 26, 26]);
	});

	it("ends at 100 and the lowest total wins", () => {
		const state = scored([["SQ#0"], HEARTS, [], []], [], [[90, 0, 5, 40]]);
		expect(state.phase).toBe("finished");
		expect(state.winners).toEqual([2]);
		expect(state.events.at(-1)).toMatchObject({ type: "win", seats: [2] });
	});

	it("ties share the win, and the short game ends at 50", () => {
		const tie = scored([["SQ#0"], HEARTS, [], []], ["to50"], [[40, 0, 5, 5]]);
		expect(tie.phase).toBe("finished");
		expect(tie.winners).toEqual([2, 3]);
		const short = scored([["SQ#0"], HEARTS, [], []], [], [[30, 0, 5, 5]]);
		expect(short.phase).toBe("roundOver");
	});

	it("deals the next round on, with the dealer and pass direction moving", () => {
		const over = scored([["SQ#0"], HEARTS, [], []]);
		const next = act(over, 2, { type: "nextRound" });
		expect(next.round).toBe(over.round + 1);
		expect(next.dealer).toBe((over.dealer + 1) % 4);
		expect(next.passDirection).toBe(passDirectionFor(rules, 4, next.round));
		expect(next.scores).toEqual(over.scores);
		expect(next.hands.every((hand) => hand.length === 13)).toBe(true);
	});
});

describe("views keep hands and passes private", () => {
	it("doesn't say who holds the 2 of clubs before the pass", () => {
		for (let seed = 1; seed <= 20; seed += 1) {
			const state = createCardGame(
				game,
				[],
				4,
				mulberry32(seed),
			) as TricksState;
			expect(state.phase).toBe("passing");
			const view = viewCardGame(game, [], state, 0) as TricksView;
			expect(view.turn).toBe((state.dealer + 1) % 4);
		}
	});

	it("shows only your own hand, chosen cards and received cards", () => {
		let state = createCardGame(game, [], 4, mulberry32(8)) as TricksState;
		const secret = state.hands[1].slice(0, 3);
		state = act(state, 1, { type: "passCards", cards: secret });
		const mine = viewCardGame(game, [], state, 0) as TricksView;
		const text = JSON.stringify(mine);
		for (const card of [
			...state.hands[1],
			...secret,
			...state.hands[2],
			...state.hands[3],
		]) {
			expect(text).not.toContain(`"${card}"`);
		}
		expect(mine.passReady).toEqual([false, true, false, false]);
		expect(mine.handCounts).toEqual([13, 13, 13, 13]);
		const theirs = viewCardGame(game, [], state, 1) as TricksView;
		expect(theirs.passed).toEqual(secret);

		for (const seat of [0, 2, 3]) {
			state = act(state, seat, {
				type: "passCards",
				cards: state.hands[seat].slice(0, 3),
			});
		}
		const after = JSON.stringify(viewCardGame(game, [], state, 0));
		for (const card of [...state.received[2], ...state.received[3]]) {
			expect(after).not.toContain(`"${card}"`);
		}
		const spectator = viewCardGame(game, [], state, null) as TricksView;
		expect(spectator.hand).toEqual([]);
		expect(spectator.received).toEqual([]);
		expect(spectator.passed).toBeNull();
		expect(spectator.legal).toEqual([]);
	});
});

describe("the computer player", () => {
	it("passes the queen of spades and its highest hearts, never the jack of diamonds", () => {
		const hand = ["SQ#0", "HA#0", "HK#0", "C3#0", "D4#0", "DJ#0", "C2#0"];
		expect(choosePass(rules, hand)).toEqual(["SQ#0", "HA#0", "HK#0"]);
		expect(
			choosePass(rulesWith(["jackOfDiamonds"]), [
				"DJ#0",
				"C3#0",
				"C4#0",
				"C5#0",
			]),
		).not.toContain("DJ#0");
	});

	it("ducks under the winning card and dumps the queen when it can't follow", () => {
		const state = act(
			playing([["CJ#0"], ["CK#0", "C9#0", "C3#0"], ["SQ#0", "H9#0"]], {
				tricksTaken: [1, 0, 0],
			}),
			0,
			{ type: "play", card: "CJ#0" },
		);
		expect(chooseTricksCard(rules, state, 1)).toBe("C9#0");
		const ducked = act(state, 1, { type: "play", card: "C9#0" });
		expect(chooseTricksCard(rules, ducked, 2)).toBe("SQ#0");
	});

	it("leads its lowest safe card", () => {
		const state = playing([["SQ#0", "D9#0", "C4#0"], ["C5#0"], ["C6#0"]], {
			tricksTaken: [1, 0, 0],
		});
		expect(chooseTricksCard(rules, state, 0)).toBe("C4#0");
	});

	it("keeps the jack of diamonds rather than give it away", () => {
		const jack = rulesWith(["jackOfDiamonds"]);
		const lead = playing([["DJ#0", "D9#0", "C4#0"], ["C5#0"], ["C6#0"]], {
			tricksTaken: [1, 0, 0],
		});
		expect(chooseTricksCard(jack, lead, 0)).toBe("C4#0");
		const follow = act(
			playing([["DK#0"], ["DJ#0", "D3#0"], ["D2#0"]], {
				tricksTaken: [1, 0, 0],
			}),
			0,
			{ type: "play", card: "DK#0" },
		);
		expect(chooseTricksCard(jack, follow, 1)).toBe("D3#0");
		const forced = act(
			playing([["D10#0"], ["DJ#0", "DA#0"], ["DQ#0"]], {
				tricksTaken: [1, 0, 0],
			}),
			0,
			{ type: "play", card: "D10#0" },
		);
		expect(chooseTricksCard(jack, forced, 1)).toBe("DA#0");
	});

	it("waits for people to pass and to deal the next round", () => {
		const state = createCardGame(game, [], 4, mulberry32(9)) as TricksState;
		expect(botTricksMove(rules, state, [1, 2])?.action.type).toBe("passCards");
		const over = scored([["SQ#0"], HEARTS, [], []]);
		expect(botTricksMove(rules, over, [1, 2, 3])).toBeNull();
		expect(botTricksMove(rules, over, [0, 1, 2, 3])?.action.type).toBe(
			"nextRound",
		);
	});
});

/** Every card a deal holds, wherever it is. */
function cardsIn(state: TricksState) {
	return [
		...state.hands.flat(),
		...state.passing.flatMap((cards) => cards ?? []),
		...state.trick.map((play) => play.card),
		...state.taken.flat(),
	];
}

function playOut(options: string[], seats: number, seed: number) {
	const random = mulberry32(seed);
	let state: CardGameState = createCardGame(game, options, seats, random);
	const everyone = Array.from({ length: seats }, (_, seat) => seat);
	const size = tricksDeck(rulesWith(options), seats).length;
	for (let step = 0; step < 20_000; step += 1) {
		if (state.phase === "finished") {
			return state as TricksState;
		}
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
		);
		const cards = cardsIn(state as TricksState);
		expect(cards).toHaveLength(size);
		expect(new Set(cards).size).toBe(size);
	}
	throw new Error("game did not terminate");
}

describe("full games between computer players", () => {
	it.each([3, 4, 5, 6])(
		"%i seats always finish with legal moves",
		(seats) => {
			for (let seed = 1; seed <= 40; seed += 1) {
				const final = playOut([], seats, seed * 13);
				const totals = final.scores.reduce(
					(sum, round) => sum.map((total, seat) => total + round[seat]),
					Array(seats).fill(0) as number[],
				);
				expect(Math.max(...totals)).toBeGreaterThanOrEqual(100);
				expect(final.winners.map((seat) => totals[seat])).toEqual(
					final.winners.map(() => Math.min(...totals)),
				);
			}
		},
		30_000,
	);

	it.each([3, 4, 5, 6])("%i seats finish with every house rule on", (seats) => {
		for (let seed = 1; seed <= 15; seed += 1) {
			expect(
				playOut(
					["noPassing", "queenBreaksHearts", "jackOfDiamonds", "to50"],
					seats,
					seed,
				).phase,
			).toBe("finished");
		}
	});

	it("every deal scores 26 points between the players", () => {
		const final = playOut([], 4, 77);
		for (const round of final.scores) {
			const sum = round.reduce((a, b) => a + b, 0);
			expect([26, 78]).toContain(sum);
		}
	});
});
