import { describe, expect, it } from "vitest";
import {
	type BiddingAction,
	type BiddingState,
	type BiddingView,
	bidChances,
	bidOutranks,
	countMatching,
	lowestBids,
	minimumQuantity,
} from "../dice/bidding";
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
	biddingNews,
	biddingStandings,
	biddingStep,
	bidText,
	defaultBid,
	revealSentences,
} from "../dice/table-view";
import { GameRuleError } from "../errors";
import { en } from "../i18n/en";
import { nl } from "../i18n/nl";
import { mulberry32 } from "../random";
import { initialHouseRules } from "../table-engine";

const game = DICE_GAMES["liars-dice"];
const WILD = { wildOnes: true };
const PLAIN = { wildOnes: false };
const rng = mulberry32(3);

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

/** A table whose cups are exactly `cups`, seat 0 to move. */
function withCups(cups: number[][], options: string[] = []): BiddingState {
	const state = createDiceGame(game, options, cups.length, 0, rng);
	return { ...(state as BiddingState), cups: cups.map((cup) => [...cup]) };
}

function act(
	state: BiddingState,
	action: BiddingAction,
	options: string[] = [],
	seat = state.turn,
) {
	return applyDiceAction(
		game,
		options,
		state,
		seat,
		action,
		rng,
	) as BiddingState;
}

const view = (
	state: BiddingState,
	seat: number | null,
	options: string[] = [],
) => viewDiceGame(game, options, state, seat) as BiddingView;

describe("liar's dice bids", () => {
	it("climbs by more dice, or as many of a higher face, without wild ones", () => {
		const previous = { quantity: 4, face: 3 };
		expect(bidOutranks(previous, { quantity: 4, face: 4 }, PLAIN)).toBe(true);
		expect(bidOutranks(previous, { quantity: 5, face: 2 }, PLAIN)).toBe(true);
		expect(bidOutranks(previous, { quantity: 4, face: 3 }, PLAIN)).toBe(false);
		expect(bidOutranks(previous, { quantity: 4, face: 2 }, PLAIN)).toBe(false);
		expect(bidOutranks(previous, { quantity: 3, face: 6 }, PLAIN)).toBe(false);
		// Ones are just the lowest face.
		expect(bidOutranks(previous, { quantity: 4, face: 1 }, PLAIN)).toBe(false);
		expect(bidOutranks(previous, { quantity: 5, face: 1 }, PLAIN)).toBe(true);
		expect(bidOutranks(null, { quantity: 1, face: 1 }, PLAIN)).toBe(true);
	});

	it("halves the quantity onto ones and doubles it plus one off them, with wild ones", () => {
		// Onto ones: half the previous quantity, rounded up.
		expect(minimumQuantity({ quantity: 5, face: 4 }, 1, WILD)).toBe(3);
		expect(minimumQuantity({ quantity: 4, face: 6 }, 1, WILD)).toBe(2);
		expect(
			bidOutranks({ quantity: 5, face: 4 }, { quantity: 2, face: 1 }, WILD),
		).toBe(false);
		expect(
			bidOutranks({ quantity: 5, face: 4 }, { quantity: 3, face: 1 }, WILD),
		).toBe(true);
		// Off ones: twice as many plus one.
		expect(minimumQuantity({ quantity: 3, face: 1 }, 2, WILD)).toBe(7);
		expect(
			bidOutranks({ quantity: 3, face: 1 }, { quantity: 6, face: 6 }, WILD),
		).toBe(false);
		expect(
			bidOutranks({ quantity: 3, face: 1 }, { quantity: 7, face: 2 }, WILD),
		).toBe(true);
		// Ones on ones: more of them.
		expect(minimumQuantity({ quantity: 3, face: 1 }, 1, WILD)).toBe(4);
		// Other faces climb as usual.
		expect(minimumQuantity({ quantity: 3, face: 5 }, 6, WILD)).toBe(3);
		expect(minimumQuantity({ quantity: 3, face: 5 }, 2, WILD)).toBe(4);
	});

	it("lists every face's lowest legal bid that fits on the table", () => {
		expect(lowestBids({ quantity: 4, face: 5 }, 10, WILD)).toEqual([
			{ quantity: 2, face: 1 },
			{ quantity: 5, face: 2 },
			{ quantity: 5, face: 3 },
			{ quantity: 5, face: 4 },
			{ quantity: 5, face: 5 },
			{ quantity: 4, face: 6 },
		]);
		expect(lowestBids({ quantity: 10, face: 6 }, 10, PLAIN)).toEqual([]);
		expect(lowestBids({ quantity: 10, face: 6 }, 10, WILD)).toEqual([
			{ quantity: 5, face: 1 },
		]);
	});

	it("counts wild ones toward every face but ones", () => {
		expect(countMatching([1, 3, 3, 1, 6], 3, WILD)).toBe(4);
		expect(countMatching([1, 3, 3, 1, 6], 3, PLAIN)).toBe(2);
		expect(countMatching([1, 3, 3, 1, 6], 1, WILD)).toBe(2);
	});

	it("refuses a bid that does not climb, does not fit, or comes out of turn", () => {
		let state = withCups([
			[2, 2, 3, 4, 5],
			[6, 6, 6, 1, 2],
		]);
		state = act(state, { type: "bid", quantity: 3, face: 4 });
		expect(state.turn).toBe(1);
		expectRule(
			() => act(state, { type: "bid", quantity: 3, face: 3 }),
			"claimMustOutrank",
		);
		expectRule(
			() => act(state, { type: "bid", quantity: 11, face: 6 }),
			"claimImpossible",
		);
		expectRule(
			() => act(state, { type: "bid", quantity: 4, face: 7 }),
			"claimImpossible",
		);
		expectRule(
			() => act(state, { type: "bid", quantity: 2.5, face: 6 }),
			"claimImpossible",
		);
		expectRule(
			() => act(state, { type: "bid", quantity: 4, face: 6 }, [], 0),
			"notYourTurn",
		);
		expectRule(
			() => act(withCups([[1], [2]]), { type: "liar" }),
			"noClaimToChallenge",
		);
	});
});

describe("liar's dice calls", () => {
	const cups = [
		[3, 3, 1, 5, 6],
		[3, 2, 2, 4, 4],
		[1, 6, 6, 6, 2],
	];

	it("costs the caller a die when the bid holds", () => {
		// Plain faces: three 3s on the table.
		let state = act(withCups(cups), { type: "bid", quantity: 3, face: 3 });
		state = act(state, { type: "liar" });
		expect(state.reveal).toMatchObject({
			call: "liar",
			caller: 1,
			count: 3,
			losers: [1],
			bid: { seat: 0, quantity: 3, face: 3 },
		});
		expect(state.reveal?.cups).toEqual(cups);
		expect(state.cups.map((cup) => cup.length)).toEqual([5, 4, 5]);
		expect(state.round).toBe(2);
		expect(state.bids).toEqual([]);
		// The loser opens the next round.
		expect(state.turn).toBe(1);
	});

	it("costs the bidder a die when the bid was a lie", () => {
		let state = act(withCups(cups), { type: "bid", quantity: 4, face: 3 });
		state = act(state, { type: "liar" });
		expect(state.reveal).toMatchObject({ count: 3, losers: [0] });
		expect(state.cups.map((cup) => cup.length)).toEqual([4, 5, 5]);
		expect(state.turn).toBe(0);
	});

	it("counts wild ones at the reveal", () => {
		// With wild ones the two ones make five 3s.
		let state = act(
			withCups(cups, ["wildOnes"]),
			{ type: "bid", quantity: 5, face: 3 },
			["wildOnes"],
		);
		state = act(state, { type: "liar" }, ["wildOnes"]);
		expect(state.reveal).toMatchObject({ count: 5, losers: [1] });
	});

	it("takes a die from everyone else on an exact spot-on call", () => {
		const options = ["spotOn"];
		let state = act(
			withCups(cups, options),
			{ type: "bid", quantity: 4, face: 6 },
			options,
		);
		state = act(state, { type: "spotOn" }, options);
		expect(state.reveal).toMatchObject({
			call: "spotOn",
			caller: 1,
			count: 4,
			losers: [0, 2],
		});
		expect(state.cups.map((cup) => cup.length)).toEqual([4, 5, 4]);
		// Several lost a die, so the caller opens.
		expect(state.turn).toBe(1);
	});

	it("costs the caller a die on a wrong spot-on call", () => {
		const options = ["spotOn"];
		let state = act(
			withCups(cups, options),
			{ type: "bid", quantity: 3, face: 6 },
			options,
		);
		state = act(state, { type: "spotOn" }, options);
		expect(state.reveal).toMatchObject({ count: 4, losers: [1] });
		expect(state.cups.map((cup) => cup.length)).toEqual([5, 4, 5]);
	});

	it("allows spot on only when the table plays it", () => {
		const state = act(withCups(cups), { type: "bid", quantity: 3, face: 6 });
		expectRule(() => act(state, { type: "spotOn" }), "diceSpotOnOff");
	});

	it("rejects another family's moves", () => {
		expectRule(
			() =>
				applyDiceAction(
					game,
					[],
					withCups(cups),
					0,
					{ type: "roll", keep: [] },
					rng,
				),
			"cardsWrongAction",
		);
	});
});

describe("liar's dice elimination", () => {
	it("puts a player with no dice out, skips them, and lets the next seat open", () => {
		let state = withCups([[4], [2, 2], [5, 5, 5]]);
		state = act(state, { type: "bid", quantity: 3, face: 5 });
		state = act(state, { type: "bid", quantity: 4, face: 5 });
		state = act(state, { type: "liar" });
		// Seat 1 bid four 5s on three: seat 1 loses a die but is still in.
		expect(state.cups.map((cup) => cup.length)).toEqual([1, 1, 3]);
		state = { ...state, cups: [[4], [2], [5, 5, 5]] };
		expect(state.turn).toBe(1);
		state = act(state, { type: "bid", quantity: 2, face: 2 });
		state = act(state, { type: "liar" });
		// One 2 on the table: seat 1 is out, and seat 2 opens after them.
		expect(state.cups.map((cup) => cup.length)).toEqual([1, 0, 3]);
		expect(state.outIn).toEqual([null, 2, null]);
		expect(state.turn).toBe(2);
		state = act(state, { type: "bid", quantity: 1, face: 3 });
		// Seat 1 is skipped.
		expect(state.turn).toBe(0);
	});

	it("ends with the last player holding dice", () => {
		let state = withCups([[6], [2]]);
		state = act(state, { type: "bid", quantity: 1, face: 6 });
		state = act(state, { type: "liar" });
		expect(state.phase).toBe("finished");
		expect(state.winners).toEqual([0]);
		expect(state.events.at(-1)).toMatchObject({ type: "win", seats: [0] });
		expect(DICE_ENGINE.outcome(state)).toEqual({
			finished: true,
			winners: [0],
		});
		expectRule(
			() => act(state, { type: "bid", quantity: 1, face: 1 }),
			"noActiveGame",
		);
	});

	it("starts three-dice games with three dice each, and two to six players", () => {
		const state = createDiceGame(
			game,
			["threeDice"],
			4,
			0,
			rng,
		) as BiddingState;
		expect(state.cups.map((cup) => cup.length)).toEqual([3, 3, 3, 3]);
		expectRule(() => createDiceGame(game, [], 1, 0, rng), "notEnoughPlayers");
		expectRule(() => createDiceGame(game, [], 7, 0, rng), "notEnoughPlayers");
	});

	it("switches wild ones on at setup and leaves the rest off", () => {
		expect(initialHouseRules(game.options)).toEqual(["wildOnes"]);
		expect(initialHouseRules(DICE_GAMES.yatzy.options)).toEqual([]);
		expect(diceRules(game, ["wildOnes", "threeDice"])).toEqual({
			startingDice: 3,
			wildOnes: true,
			spotOn: false,
		});
	});
});

/** Every state of a whole game with computer players in every seat. */
function playOut(options: string[], seats: number, seed: number) {
	const random = mulberry32(seed);
	const bots = Array.from({ length: seats }, (_, seat) => seat);
	let state = createDiceGame(
		game,
		options,
		seats,
		seed % seats,
		random,
	) as BiddingState;
	const states = [state];
	for (let step = 0; step < 2000 && state.phase === "playing"; step += 1) {
		const move = diceBotMove(game, options, state, bots, random);
		if (!move) {
			break;
		}
		state = applyDiceAction(
			game,
			options,
			state,
			move.seat,
			move.action,
			random,
		) as BiddingState;
		states.push(state);
	}
	return states;
}

const OPTION_SETS = [
	["wildOnes"],
	[],
	["wildOnes", "spotOn"],
	["spotOn", "threeDice"],
];

describe("liar's dice bots", () => {
	it("finish games over many seeds, seats and house rules", () => {
		let spotOnCalls = 0;
		for (let seed = 1; seed <= 60; seed += 1) {
			const options = OPTION_SETS[seed % OPTION_SETS.length];
			const seats = 2 + (seed % 5);
			const states = playOut(options, seats, seed);
			const final = states.at(-1) as BiddingState;
			expect(final.phase).toBe("finished");
			expect(final.winners).toHaveLength(1);
			expect(final.cups.filter((cup) => cup.length > 0)).toHaveLength(1);
			spotOnCalls += final.events.filter(
				(event) => event.type === "call" && event.call === "spotOn",
			).length;
		}
		expect(spotOnCalls).toBeGreaterThan(0);
	});

	it("calls a bid it cannot believe, and raises one it can", () => {
		const doubtful = act(
			withCups([
				[2, 3, 4, 5, 6],
				[2, 3, 4, 5, 6],
			]),
			{ type: "bid", quantity: 6, face: 6 },
		);
		expect(diceBotMove(game, [], doubtful, [1], rng)?.action).toEqual({
			type: "liar",
		});
		const believable = act(
			withCups([
				[2, 3, 4, 5, 6],
				[6, 6, 6, 6, 1],
			]),
			{ type: "bid", quantity: 2, face: 6 },
		);
		expect(diceBotMove(game, [], believable, [1], rng)?.action).toMatchObject({
			type: "bid",
		});
	});

	it("only moves for a computer seat whose turn it is", () => {
		const state = withCups([[1], [2]]);
		expect(diceBotMove(game, [], state, [1], rng)).toBeNull();
		expect(diceBotMove(game, [], state, [0], rng)).toMatchObject({
			seat: 0,
			pace: "turn",
		});
	});

	it("weighs a bid against the dice it cannot see", () => {
		// Holding three 6s of ten dice, three 6s certainly hold.
		expect(
			bidChances(
				{ ...PLAIN, startingDice: 5, spotOn: false },
				[6, 6, 6, 2, 3],
				10,
				{ quantity: 3, face: 6 },
			).holds,
		).toBeCloseTo(1);
		const wild = bidChances(
			{ ...WILD, startingDice: 5, spotOn: false },
			[],
			6,
			{ quantity: 2, face: 4 },
		);
		const plain = bidChances(
			{ ...PLAIN, startingDice: 5, spotOn: false },
			[],
			6,
			{ quantity: 2, face: 4 },
		);
		expect(wild.holds).toBeGreaterThan(plain.holds);
	});
});

describe("liar's dice hidden cups", () => {
	it("never shows a seat anyone else's dice before the reveal, over whole games", () => {
		for (let seed = 1; seed <= 30; seed += 1) {
			const options = OPTION_SETS[seed % OPTION_SETS.length];
			const seats = 2 + (seed % 5);
			const scramble = mulberry32(seed * 7919);
			for (const state of playOut(options, seats, seed)) {
				for (const viewer of [null, ...state.cups.keys()]) {
					const seen = view(state, viewer, options);
					expect(seen.yourDice).toEqual(
						viewer === null ? [] : state.cups[viewer],
					);
					// Change every other cup: what this viewer sees must not move.
					const others: BiddingState = {
						...state,
						cups: state.cups.map((cup, seat) =>
							seat === viewer
								? cup
								: cup.map(() => 1 + Math.floor(scramble() * 6)),
						),
					};
					expect(view(others, viewer, options)).toEqual(seen);
				}
			}
		}
	});

	it("shows every cup once a call reveals them", () => {
		const cups = [
			[3, 3, 1, 5, 6],
			[3, 2, 2, 4, 4],
		];
		let state = act(withCups(cups), { type: "bid", quantity: 3, face: 3 });
		state = act(state, { type: "liar" });
		expect(view(state, null).reveal?.cups).toEqual(cups);
	});
});

describe("liar's dice table view", () => {
	const table = {
		you: 0,
		seats: [
			{ botIndex: null, name: "Ada" },
			{ botIndex: 0, name: null },
			{ botIndex: null, name: "Bo" },
		],
	};
	const words = { dice: en.games.dice, locale: "en" };

	it("suggests opening on the face your cup backs best", () => {
		const cup = { bids: [], totalDice: 15, yourDice: [5, 1, 1, 4, 4] };
		// Wild ones back the fours, so a pair of ones is no reason to bid ones.
		expect(
			defaultBid({
				...cup,
				rules: { startingDice: 5, wildOnes: true, spotOn: false },
			}),
		).toEqual({ quantity: 1, face: 4 });
		expect(
			defaultBid({
				...cup,
				rules: { startingDice: 5, wildOnes: false, spotOn: false },
			})?.face,
		).toBe(1);
	});

	it("tells the viewer what to do", () => {
		let state = withCups([[1, 2], [3], [4]]);
		expect(biddingStep(view(state, 0), 0)).toBe("open");
		expect(biddingStep(view(state, 1), 1)).toBe("waiting");
		expect(biddingStep(view(state, null), null)).toBe("waiting");
		state = act(state, { type: "bid", quantity: 1, face: 2 });
		expect(biddingStep(view(state, 1), 1)).toBe("raise");
		expect(biddingStep(view({ ...state, cups: [[1, 2], [], [4]] }, 1), 1)).toBe(
			"out",
		);
	});

	it("words bids and reveals in both languages", () => {
		expect(bidText(words, { quantity: 1, face: 3 })).toBe("1 die showing 3");
		expect(bidText(words, { quantity: 4, face: 6 })).toBe("4 dice showing 6");
		expect(
			bidText({ dice: nl.games.dice, locale: "nl" }, { quantity: 4, face: 6 }),
		).toBe("4 stenen met 6");
		let state = act(
			withCups([[3, 3], [3], [2]], ["spotOn"]),
			{ type: "bid", quantity: 3, face: 3 },
			["spotOn"],
		);
		state = act(state, { type: "spotOn" }, ["spotOn"]);
		const reveal = state.reveal;
		if (!reveal) {
			throw new Error("expected a reveal");
		}
		expect(revealSentences(words, table, reveal)).toEqual([
			"You bid 3 dice showing 3. Anna called it spot on.",
			"There were 3.",
			"Everyone else lost a die.",
		]);
		for (const locale of [en, nl]) {
			const text = revealSentences(
				{ dice: locale.games.dice, locale: "en" },
				table,
				reveal,
			).join(" ");
			expect(text).not.toMatch(/[{}]/);
		}
		const news = biddingNews(words, table, view(state, 0))?.text;
		expect(news).toContain("spot on");
		// The round goes on, so the viewer hears the cup they rolled for it.
		expect(news).toMatch(/Your dice: \d(, \d)*\.?$/);
		expect(biddingNews(words, table, view(state, null))?.text).not.toContain(
			"Your dice",
		);
	});

	it("ranks the winner first, then whoever lasted longest", () => {
		expect(
			biddingStandings({ outIn: [2, null, 5, 2], winners: [1] }).map(
				({ seat }) => seat,
			),
		).toEqual([1, 2, 0, 3]);
	});
});
