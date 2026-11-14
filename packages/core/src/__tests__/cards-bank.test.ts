import { describe, expect, it } from "vitest";
import {
	applyBank,
	type BankRules,
	type BankState,
	botBankMove,
	createBank,
	handValue,
	isNatural,
	settleHand,
	viewBank,
} from "../cards/bank";
import { buildDeck } from "../cards/deck";
import {
	applyCardAction,
	CARD_GAMES,
	type CardAction,
	createCardGame,
	getCardGame,
	nextStarter,
	normalizeOptions,
	resolvedRules,
	toggleOption,
} from "../cards/engine";
import { GameRuleError } from "../errors";
import { mulberry32 } from "../random";

const game = getCardGame("eenentwintigen");
const resolved = resolvedRules(game, []);
if (resolved.family !== "bank") throw new Error("Eenentwintigen is bank");
const rules: BankRules = resolved.rules;
const random = mulberry32(7);

function codeOf(run: () => unknown) {
	try {
		run();
	} catch (error) {
		if (error instanceof GameRuleError) return error.code;
		throw error;
	}
	throw new Error("expected a GameRuleError");
}

/**
 * A round in play. The stock is drawn from its end, so `stock` lists the next
 * cards last-first: `["C2#0", "H9#0"]` deals the nine of hearts next.
 */
function playing(overrides: Partial<BankState> = {}): BankState {
	const seats = overrides.hands?.length ?? 2;
	return {
		...createBank(rules, seats, random),
		hands: [
			["H10#0", "S6#0"],
			["D9#0", "C8#0"],
		],
		bank: ["SK#0", "H7#0"],
		stock: buildDeck(1, 0).filter(
			(card) => card.startsWith("C") && card !== "C8#0",
		),
		stakes: Array.from({ length: seats }, () => 2),
		doubled: Array.from({ length: seats }, () => false),
		done: Array.from({ length: seats }, () => false),
		phase: "play",
		turn: 0,
		...overrides,
	};
}

describe("counting a hand", () => {
	it("counts faces as 10 and an ace as 11 while that fits", () => {
		expect(handValue(["HK#0", "SQ#0"])).toEqual({ total: 20, soft: false });
		expect(handValue(["HA#0", "S6#0"])).toEqual({ total: 17, soft: true });
		expect(handValue(["HA#0", "S6#0", "D9#0"])).toEqual({
			total: 16,
			soft: false,
		});
		expect(handValue(["HA#0", "SA#0", "D9#0"])).toEqual({
			total: 21,
			soft: true,
		});
		expect(handValue(["HA#0", "SA#0", "DA#1", "CA#1"]).total).toBe(14);
	});

	it("calls only two cards making 21 a natural", () => {
		expect(isNatural(["HA#0", "SJ#0"])).toBe(true);
		expect(isNatural(["H7#0", "S7#0", "D7#0"])).toBe(false);
		expect(isNatural(["HA#0", "S9#0"])).toBe(false);
	});
});

describe("settling a hand against the bank", () => {
	const pays = { naturalPays: 1.5 };
	it.each([
		["a higher total wins", ["H10#0", "S9#0"], ["SK#0", "H8#0"], 2, 2],
		["a lower total loses", ["H10#0", "S7#0"], ["SK#0", "H8#0"], 2, -2],
		[
			"an equal total changes nothing",
			["H10#0", "S8#0"],
			["SK#0", "H8#0"],
			5,
			0,
		],
		[
			"the bank going over wins",
			["H10#0", "S2#0"],
			["SK#0", "H6#0", "D9#0"],
			1,
			1,
		],
		[
			"going over loses even when the bank goes over too",
			["H10#0", "S6#0", "D9#0"],
			["SK#0", "H6#0", "D9#0"],
			2,
			-2,
		],
		["a natural pays 3:2, rounded", ["HA#0", "SK#0"], ["SK#0", "H8#0"], 1, 2],
		["a natural on 2 pays 3", ["HA#0", "SK#0"], ["SK#0", "H8#0"], 2, 3],
		["a natural on 5 pays 8", ["HA#0", "SK#0"], ["SK#0", "H8#0"], 5, 8],
		[
			"a natural beats the bank's three-card 21",
			["HA#0", "SK#0"],
			["S7#0", "H7#0", "D7#0"],
			2,
			3,
		],
		["two naturals change nothing", ["HA#0", "SK#0"], ["DA#0", "HQ#0"], 2, 0],
		[
			"the bank's natural beats a three-card 21",
			["H7#0", "S7#0", "D7#0"],
			["DA#0", "HQ#0"],
			2,
			-2,
		],
	] as const)("%s", (_, hand, bank, stake, expected) => {
		expect(settleHand(pays, hand, bank, stake)).toBe(expected);
	});
});

describe("a round of eenentwintigen", () => {
	it("starts by asking every player for points, with nothing dealt", () => {
		const state = createCardGame(game, [], 3, mulberry32(1));
		if (state.family !== "bank") throw new Error("bank");
		expect(state.phase).toBe("stake");
		expect(state.bank).toEqual([]);
		expect(state.hands.flat()).toEqual([]);
		expect(viewBank(rules, state, 0).canStake).toBe(true);
	});

	it("deals two cards each, and two to the bank, once everyone has picked", () => {
		let state = createBank(rules, 2, mulberry32(3));
		state = applyBank(rules, state, 1, { type: "stake", amount: 5 }, random);
		expect(state.phase).toBe("stake");
		expect(viewBank(rules, state, 1).canStake).toBe(false);
		state = applyBank(rules, state, 0, { type: "stake", amount: 1 }, random);
		expect(state.hands.map((hand) => hand.length)).toEqual([2, 2]);
		expect(state.bank).toHaveLength(2);
		expect(state.stakes).toEqual([1, 5]);
		expect(state.events.map((event) => event.type)).toContain("deal");
	});

	it("hides the bank's second card until the bank plays", () => {
		const state = playing();
		const view = viewBank(rules, state, 0);
		expect(view.bank).toEqual(["SK#0", null]);
		expect(view.bankTotal).toBe(10);
		const serialized = JSON.stringify(viewBank(rules, state, null));
		expect(serialized).not.toContain('"H7#0"');
		for (const card of state.stock) {
			expect(serialized).not.toContain(`"${card}"`);
		}
		// Players' cards are dealt face up, so everyone sees every hand.
		expect(viewBank(rules, state, 1).hands).toEqual(state.hands);
	});

	it("lets the player on turn take cards, and stops them at 21", () => {
		const hit = applyBank(
			rules,
			playing({
				hands: [
					["H2#0", "S3#0"],
					["D9#0", "C8#0"],
				],
				stock: ["C6#0", "H10#0"],
			}),
			0,
			{ type: "hit" },
			random,
		);
		expect(hit.hands[0]).toEqual(["H2#0", "S3#0", "H10#0"]);
		expect(hit.turn).toBe(0);
		const twentyOne = applyBank(rules, hit, 0, { type: "hit" }, random);
		expect(handValue(twentyOne.hands[0]).total).toBe(21);
		expect(twentyOne.done[0]).toBe(true);
		expect(twentyOne.turn).toBe(1);
	});

	it("ends a hand that goes over 21 and moves on", () => {
		const state = applyBank(
			rules,
			playing({ stock: ["C2#0", "HK#0"] }),
			0,
			{ type: "hit" },
			random,
		);
		expect(handValue(state.hands[0]).total).toBe(26);
		expect(state.done[0]).toBe(true);
		expect(state.turn).toBe(1);
		expect(state.events.at(-1)).toMatchObject({ type: "bust", seat: 0 });
	});

	it("lets the bank draw to 17 after the last player stops, then settles", () => {
		let state = playing({
			bank: ["SK#0", "H4#0"],
			stock: ["C9#0", "D2#0", "S3#0"],
		});
		state = applyBank(rules, state, 0, { type: "stand" }, random);
		expect(state.bankRevealed).toBe(false);
		state = applyBank(rules, state, 1, { type: "stand" }, random);
		// 14, then 3 makes 17 and the bank stops.
		expect(state.bank).toEqual(["SK#0", "H4#0", "S3#0"]);
		expect(state.results).toEqual([[-2, 0]]);
		expect(state.phase).toBe("stake");
		expect(state.round).toBe(2);
		expect(state.stakes).toEqual([null, null]);
		expect(state.bankRevealed).toBe(true);
		expect(viewBank(rules, state, 0).bank).toEqual(state.bank);
		expect(state.events.map((event) => event.type).slice(-4)).toEqual([
			"stand",
			"bankReveal",
			"bankDraw",
			"settle",
		]);
	});

	it("keeps the bank on soft 17 unless the house rule says draw", () => {
		const soft = playing({ bank: ["SA#0", "H6#0"], stock: ["C9#0", "D2#0"] });
		const stands = applyBank(
			rules,
			applyBank(rules, soft, 0, { type: "stand" }, random),
			1,
			{ type: "stand" },
			random,
		);
		expect(stands.bank).toHaveLength(2);
		const hitsSoft = { ...rules, bankHitsSoft: true };
		const draws = applyBank(
			hitsSoft,
			applyBank(hitsSoft, soft, 0, { type: "stand" }, random),
			1,
			{ type: "stand" },
			random,
		);
		expect(draws.bank).toEqual(["SA#0", "H6#0", "D2#0"]);
	});

	it("leaves the bank alone when every hand is already over 21", () => {
		let state = playing({
			bank: ["SK#0", "H4#0"],
			stock: ["C9#0", "DK#0", "SK#1"],
		});
		state = applyBank(rules, state, 0, { type: "hit" }, random);
		state = applyBank(rules, state, 1, { type: "hit" }, random);
		expect(state.bank).toEqual(["SK#0", "H4#0"]);
		expect(state.results).toEqual([[-2, -2]]);
	});

	/** A fresh round whose deal hands out `next` in order: seats, bank, seats, bank. */
	function dealing(seats: number, next: string[], starter = 0) {
		const state = createBank(rules, seats, mulberry32(1), starter);
		state.stock = [
			...state.stock.filter((card) => !next.includes(card)),
			...[...next].reverse(),
		];
		return state;
	}

	it("skips a natural's turn", () => {
		let state = dealing(2, ["SA#0", "H9#0", "S5#0", "DK#0", "D8#0", "C6#0"]);
		state = applyBank(rules, state, 0, { type: "stake", amount: 2 }, random);
		state = applyBank(rules, state, 1, { type: "stake", amount: 2 }, random);
		expect(state.hands).toEqual([
			["SA#0", "DK#0"],
			["H9#0", "D8#0"],
		]);
		expect(state.bank).toEqual(["S5#0", "C6#0"]);
		expect(state.done).toEqual([true, false]);
		expect(state.turn).toBe(1);
	});

	it("settles at once when every hand is a natural", () => {
		let state = dealing(2, ["SA#0", "HA#0", "S5#0", "DK#0", "DQ#0", "C6#0"]);
		state = applyBank(rules, state, 0, { type: "stake", amount: 2 }, random);
		state = applyBank(rules, state, 1, { type: "stake", amount: 1 }, random);
		expect(state.bank).toEqual(["S5#0", "C6#0"]);
		expect(state.results).toEqual([[3, 2]]);
		expect(state.round).toBe(2);
		expect(state.phase).toBe("stake");
	});

	it("doubles only when the house rule is on, on two cards", () => {
		const state = playing({
			hands: [
				["H5#0", "S6#0"],
				["D9#0", "C8#0"],
			],
			stock: ["C2#0", "HK#0"],
		});
		expect(
			codeOf(() => applyBank(rules, state, 0, { type: "double" }, random)),
		).toBe("cardsCannotDouble");
		const doubling = { ...rules, doubleDown: true };
		expect(viewBank(doubling, state, 0).canDouble).toBe(true);
		const doubled = applyBank(doubling, state, 0, { type: "double" }, random);
		expect(doubled.hands[0]).toEqual(["H5#0", "S6#0", "HK#0"]);
		expect(doubled.stakes[0]).toBe(4);
		expect(doubled.done[0]).toBe(true);
		expect(doubled.turn).toBe(1);
		const three = playing({
			hands: [
				["H2#0", "S3#0", "D4#0"],
				["D9#0", "C8#0"],
			],
		});
		expect(
			codeOf(() => applyBank(doubling, three, 0, { type: "double" }, random)),
		).toBe("cardsCannotDouble");
	});

	it("ends the match after the last round, highest total winning", () => {
		const last = playing({
			round: rules.rounds,
			results: [[3, 1]],
			bank: ["SK#0", "H8#0"],
		});
		let state = applyBank(rules, last, 0, { type: "stand" }, random);
		state = applyBank(rules, state, 1, { type: "stand" }, random);
		// 16 and 17 both lose 2 against 18: totals 1 and -1.
		expect(state.phase).toBe("finished");
		expect(state.winners).toEqual([0]);
		expect(viewBank(rules, state, 0).totals).toEqual([1, -1]);
		expect(state.events.at(-1)).toMatchObject({ type: "win", seats: [0] });
	});

	it("shuffles the used cards back in when the stock runs low", () => {
		const low = createBank(rules, 2, mulberry32(4));
		low.discard = low.stock.splice(0, low.stock.length - 10);
		let state = applyBank(rules, low, 0, { type: "stake", amount: 1 }, random);
		state = applyBank(rules, state, 1, { type: "stake", amount: 1 }, random);
		expect(state.events.map((event) => event.type)).toContain("reshuffle");
		expect(state.discard).toEqual([]);
		expect(state.stock.length + 6).toBe(rules.decks * 52);
	});

	it("passes the lead on each round and in the rematch", () => {
		expect(nextStarter(createCardGame(game, [], 3, mulberry32(1), 1))).toBe(2);
		let state = dealing(
			3,
			["C2#0", "C3#0", "C4#0", "C5#0", "D2#0", "D3#0", "D4#0", "D5#0"],
			1,
		);
		state.round = 2;
		for (const seat of [0, 1, 2]) {
			state = applyBank(
				rules,
				state,
				seat,
				{ type: "stake", amount: 1 },
				random,
			);
		}
		expect(state.turn).toBe(2);
	});
});

describe("refused moves at a bank table", () => {
	const act = (state: BankState, seat: number, action: CardAction) =>
		codeOf(() => applyCardAction(game, [], state, seat, action, random));

	it.each([
		["a stake that is not on offer", "stake", 3, "cardsBadStake"],
		["a stake of nothing", "stake", 0, "cardsBadStake"],
	] as const)("refuses %s", (_, type, amount, code) => {
		expect(act(createBank(rules, 2, random), 0, { type, amount })).toBe(code);
	});

	it("refuses picking points twice in a round", () => {
		const once = applyBank(
			rules,
			createBank(rules, 2, random),
			0,
			{ type: "stake", amount: 2 },
			random,
		);
		expect(act(once, 0, { type: "stake", amount: 1 })).toBe(
			"cardsAlreadyStaked",
		);
	});

	it("refuses picking points once the cards are out", () => {
		expect(act(playing(), 0, { type: "stake", amount: 1 })).toBe(
			"cardsStakesClosed",
		);
	});

	it.each(["hit", "stand", "double"] as const)(
		"refuses %s before everyone has picked points",
		(type) => {
			expect(act(createBank(rules, 2, random), 0, { type })).toBe(
				"cardsWaitForStakes",
			);
		},
	);

	it.each(["hit", "stand", "double"] as const)(
		"refuses %s out of turn",
		(type) => {
			expect(act(playing(), 1, { type })).toBe("notYourTurn");
		},
	);

	it("refuses another family's moves", () => {
		expect(act(playing(), 0, { type: "draw" })).toBe("cardsWrongAction");
		expect(act(playing(), 0, { type: "nextRound" })).toBe("cardsWrongAction");
	});

	it("refuses anything once the match is over", () => {
		const over = playing({ phase: "finished", winners: [0] });
		expect(act(over, 0, { type: "hit" })).toBe("gameAlreadyFinished");
		expect(act(over, 0, { type: "stake", amount: 1 })).toBe(
			"gameAlreadyFinished",
		);
	});

	it("never changes the state it refused", () => {
		const state = playing();
		const before = JSON.stringify(state);
		act(state, 1, { type: "hit" });
		act(state, 0, { type: "stake", amount: 1 });
		expect(JSON.stringify(state)).toBe(before);
	});
});

describe("house rules", () => {
	it("plays 5 or 20 rounds, never both", () => {
		expect(resolvedRules(game, ["shortMatch"]).rules).toMatchObject({
			rounds: 5,
		});
		expect(resolvedRules(game, ["longMatch"]).rules).toMatchObject({
			rounds: 20,
		});
		expect(() => normalizeOptions(game, ["shortMatch", "longMatch"])).toThrow(
			GameRuleError,
		);
		expect(normalizeOptions(game, ["longMatch", "doubleDown"])).toEqual([
			"doubleDown",
			"longMatch",
		]);
	});

	it("switches the other match length off when one is switched on", () => {
		const short = toggleOption(game, ["doubleDown"], "shortMatch");
		expect(short).toEqual(["doubleDown", "shortMatch"]);
		expect(toggleOption(game, short, "longMatch")).toEqual([
			"doubleDown",
			"longMatch",
		]);
		expect(toggleOption(game, short, "shortMatch")).toEqual(["doubleDown"]);
		expect(toggleOption(CARD_GAMES.pesten, ["plain2"], "plain7")).toEqual([
			"plain2",
			"plain7",
		]);
	});
});

describe("the computer at a bank table", () => {
	it("picks points for every computer seat, then waits for people", () => {
		let state = createBank(rules, 3, random);
		const first = botBankMove(rules, state, [1, 2], random);
		if (!first) throw new Error("expected a move");
		expect(first).toMatchObject({ seat: 1, action: { type: "stake" } });
		state = applyBank(rules, state, 1, first.action, random);
		expect(botBankMove(rules, state, [1, 2], random)?.seat).toBe(2);
		state = applyBank(rules, state, 2, { type: "stake", amount: 1 }, random);
		expect(botBankMove(rules, state, [1, 2], random)).toBeNull();
	});

	it("stops on 17, takes a card on 11, and doubles 11 when it may", () => {
		const bot = (hand: string[], doubling = false) =>
			botBankMove(
				{ ...rules, doubleDown: doubling },
				playing({ hands: [hand, ["D9#0", "C8#0"]], bank: ["S9#0", "H7#0"] }),
				[0],
				random,
			)?.action.type;
		expect(bot(["H10#0", "S7#0"])).toBe("stand");
		expect(bot(["H5#0", "S6#0"])).toBe("hit");
		expect(bot(["H5#0", "S6#0"], true)).toBe("double");
		expect(bot(["HA#0", "S6#0"])).toBe("hit");
		expect(bot(["HA#0", "S7#0"])).toBe("stand");
	});

	it("leaves a person's turn alone", () => {
		expect(botBankMove(rules, playing(), [1], random)).toBeNull();
	});
});
