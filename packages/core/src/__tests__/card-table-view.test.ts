import { describe, expect, it } from "vitest";
import { CARD_ASPECT, cardBackArt, cardFaceArt } from "../cards/art";
import type { BankView } from "../cards/bank";
import { buildDeck, type CardId, parseCard } from "../cards/deck";
import { getCardGame, resolvedRules } from "../cards/engine";
import type { CardEvent } from "../cards/events";
import {
	applyGin,
	createGin,
	type GinRules,
	type GinState,
	viewGin,
} from "../cards/gin";
import { buildMeld, type Meld } from "../cards/melds";
import type { RummyRules, RummyView } from "../cards/rummy";
import type { SheddingView } from "../cards/shedding";
import {
	bankHint,
	bankSeatNote,
	bidTotal,
	type CardWords,
	cardName,
	cardTilt,
	describeEvent,
	eventsSince,
	faceUpCards,
	ginHint,
	ginLayoffOrder,
	ginMeldMarks,
	ginTurn,
	groupGinHand,
	latestEventText,
	meldCardNames,
	nextFreshCards,
	onAutopilot,
	openTrickSlots,
	opponentOrder,
	planFlights,
	rummyHint,
	rummyMeldAction,
	rummyTurn,
	seatName,
	sheddingHint,
	signedPoints,
	sortCards,
	sortTricksHand,
	specialCards,
	startFreshCards,
	tricksChoices,
	tricksDealSummary,
	tricksHint,
	tricksMatchTitle,
	tricksRoundLabel,
	tricksRuleLines,
	tricksRuleSections,
	tricksScoreRows,
	tricksSeatNote,
	tricksStandings,
	tricksTeams,
} from "../cards/table-view";
import type { TricksRules, TricksView } from "../cards/tricks";
import { en } from "../i18n/en";
import { fmt } from "../i18n/format";
import { nl } from "../i18n/nl";
import { seatIsSilent } from "../table-engine";

function wordsFor(cards: typeof en.games.cards): CardWords {
	return {
		cards,
		fmt: (template, params) =>
			template.replace(/\{(\w+)\}/g, (_, key) => String(params[key])),
		countOf: (count, forms) =>
			(count === 1 ? forms.one : forms.other).replace("{count}", String(count)),
	};
}

const words = wordsFor(en.games.cards);
const cards = en.games.cards;

const seat = (
	over: Partial<{
		botIndex: number | null;
		name: string | null;
		autopilot: boolean;
		lastSeen: number | null;
	}> = {},
) => ({
	botIndex: null,
	name: "Hanna",
	autopilot: false,
	lastSeen: null,
	...over,
});

const table = {
	you: 1,
	seats: [seat(), seat({ name: "Me" }), seat({ botIndex: 0, name: null })],
};

const jokeren = resolvedRules(getCardGame("jokeren"), [], null);
if (jokeren.family !== "rummy") throw new Error("Jokeren is rummy");
const rummyRules: RummyRules = jokeren.rules;

function rummyView(over: Partial<RummyView> = {}): RummyView {
	return {
		family: "rummy",
		phase: "play",
		turn: 0,
		round: 1,
		totalRounds: 5,
		top: "S2#0",
		underTop: [],
		stockCount: 40,
		melds: [],
		opened: [false, false],
		handCounts: [5, 5],
		hand: [],
		takenDiscard: null,
		scores: [],
		totals: [0, 0],
		roundWinner: null,
		revealed: null,
		winners: [],
		events: [],
		...over,
	};
}

function meldOf(cardsIn: CardId[], id = 7): Meld {
	const built = buildMeld(cardsIn, rummyRules);
	if (!built) throw new Error("not a meld");
	return { ...built, id };
}

describe("seats", () => {
	it("calls this player you and bots by their catalog name", () => {
		expect(seatName(cards, table, 1)).toBe(cards.table.you);
		expect(seatName(cards, table, 0)).toBe("Hanna");
		expect(seatName(cards, table, 2)).toBe(cards.bots.bot0);
	});

	it("lists opponents in the order play reaches them", () => {
		expect(opponentOrder(table)).toEqual([2, 0]);
	});

	it("shows a spectator every seat", () => {
		expect(opponentOrder({ ...table, you: null })).toEqual([0, 1, 2]);
	});

	it("only lets a quiet person go silent", () => {
		const long = 10 * 60_000;
		expect(seatIsSilent(seat({ lastSeen: 0 }), long)).toBe(true);
		expect(seatIsSilent(seat({ lastSeen: long - 1 }), long)).toBe(false);
		expect(seatIsSilent(seat({ lastSeen: null }), long)).toBe(false);
		expect(seatIsSilent(seat({ botIndex: 1, lastSeen: 0 }), long)).toBe(false);
		expect(seatIsSilent(seat({ autopilot: true, lastSeen: 0 }), long)).toBe(
			false,
		);
	});
});

describe("cards as data", () => {
	it("sorts with aces high and jokers last", () => {
		const hand: CardId[] = ["JK#0", "HA#0", "H2#0", "S9#0"];
		expect(sortCards(hand, "suit")).toEqual(["S9#0", "H2#0", "HA#0", "JK#0"]);
		expect(sortCards(hand, "rank")).toEqual(["H2#0", "S9#0", "HA#0", "JK#0"]);
	});

	it("leans the same card the same way, within a small angle", () => {
		expect(buildDeck(2, 4).length).toBe(108);
		for (const card of buildDeck(2, 4)) {
			expect(cardTilt(card)).toBe(cardTilt(card));
			expect(Math.abs(cardTilt(card))).toBeLessThanOrEqual(7);
		}
	});

	it("draws every card in the deck, each with a shape", () => {
		expect(CARD_ASPECT).toBeGreaterThan(1);
		expect(cardBackArt().length).toBeGreaterThan(0);
		for (const card of buildDeck(1, 2)) {
			const parsed = parseCard(card);
			const glyph = parsed.joker ? "J" : parsed.rank;
			expect(cardFaceArt(card, glyph).length).toBeGreaterThan(0);
		}
	});

	it("says what a joker in a run stands for", () => {
		const meld = meldOf(["S5#0", "JK#0", "S7#0"]);
		expect(meldCardNames(cards, meld)[1]).toBe(
			cards.rummy.jokerAs.replace(
				"{card}",
				cards.cardName
					.replace("{rank}", cards.ranks["6"])
					.replace("{suit}", cards.suits.S),
			),
		);
		expect(cardName(cards, "JK#0")).toBe(cards.joker);
	});
});

describe("narration", () => {
	const events: CardEvent[] = [
		{ seq: 1, type: "deal", round: 1 },
		{ seq: 2, type: "deal", round: 2 },
		{ seq: 3, type: "play", seat: 0, card: "S7#0" },
		{ seq: 4, type: "play", seat: 1, card: "S7#0" },
		{ seq: 5, type: "play", seat: 0, card: "SJ#0", suit: "H" },
		{ seq: 6, type: "play", seat: 1, card: "SJ#0", suit: "H" },
		{ seq: 7, type: "draw", seat: 0, count: 1, source: "stock" },
		{ seq: 8, type: "draw", seat: 1, count: 1, source: "stock" },
		{ seq: 9, type: "draw", seat: 0, count: 1, source: "discard" },
		{ seq: 10, type: "draw", seat: 1, count: 1, source: "discard" },
		{ seq: 11, type: "penalty", seat: 0, count: 2 },
		{ seq: 12, type: "penalty", seat: 1, count: 1 },
		{ seq: 13, type: "skip", seat: 0 },
		{ seq: 14, type: "skip", seat: 1 },
		{ seq: 15, type: "reverse", direction: -1 },
		{ seq: 16, type: "again", seat: 0 },
		{ seq: 17, type: "again", seat: 1 },
		{ seq: 18, type: "pass", seat: 0 },
		{ seq: 19, type: "pass", seat: 1 },
		{ seq: 20, type: "reshuffle" },
		{ seq: 21, type: "lastCard", seat: 0 },
		{ seq: 22, type: "lastCard", seat: 1 },
		{ seq: 23, type: "caught", seat: 0, by: 1, count: 2 },
		{ seq: 24, type: "caught", seat: 1, by: 0, count: 2 },
		{ seq: 25, type: "caught", seat: 0, by: 2, count: 1 },
		{ seq: 26, type: "finishPenalty", seat: 0, count: 5 },
		{ seq: 27, type: "finishPenalty", seat: 1, count: 5 },
		{ seq: 28, type: "meld", seat: 0, meldIds: [1], opened: true },
		{ seq: 29, type: "meld", seat: 1, meldIds: [1], opened: true },
		{ seq: 30, type: "meld", seat: 0, meldIds: [1], opened: false },
		{ seq: 31, type: "meld", seat: 1, meldIds: [1], opened: false },
		{ seq: 32, type: "layoff", seat: 0, meldId: 1, cards: ["S7#0"] },
		{ seq: 33, type: "layoff", seat: 1, meldId: 1, cards: ["S7#0"] },
		{ seq: 34, type: "swap", seat: 0, meldId: 1, card: "S7#0" },
		{ seq: 35, type: "swap", seat: 1, meldId: 1, card: "S7#0" },
		{ seq: 36, type: "discard", seat: 0, card: "S7#0" },
		{ seq: 37, type: "discard", seat: 1, card: "S7#0" },
		{ seq: 38, type: "roundEnd", winner: 0, round: 1 },
		{ seq: 39, type: "roundEnd", winner: 1, round: 1 },
		{ seq: 40, type: "roundEnd", winner: null, round: 1 },
		{ seq: 41, type: "win", seats: [0] },
		{ seq: 42, type: "win", seats: [1] },
		{ seq: 43, type: "win", seats: [0, 1] },
		{ seq: 44, type: "stake", seat: 0, amount: 1 },
		{ seq: 45, type: "stake", seat: 1, amount: 5 },
		{ seq: 46, type: "natural", seat: 0 },
		{ seq: 47, type: "natural", seat: 1 },
		{ seq: 48, type: "hit", seat: 0, card: "S7#0", total: 17 },
		{ seq: 49, type: "hit", seat: 1, card: "S7#0", total: 17 },
		{ seq: 50, type: "double", seat: 0, card: "S7#0", total: 18 },
		{ seq: 51, type: "double", seat: 1, card: "S7#0", total: 18 },
		{ seq: 52, type: "stand", seat: 0, total: 19 },
		{ seq: 53, type: "stand", seat: 1, total: 19 },
		{ seq: 54, type: "bust", seat: 0, total: 24 },
		{ seq: 55, type: "bust", seat: 1, total: 24 },
		{ seq: 56, type: "bankReveal", card: "HK#0", total: 16 },
		{ seq: 57, type: "bankDraw", card: "H5#0", total: 21 },
		{ seq: 58, type: "settle", round: 2, results: [2, 3, -1], bankTotal: 18 },
		{ seq: 59, type: "settle", round: 2, results: [2, -5, -1], bankTotal: 18 },
		{ seq: 60, type: "settle", round: 2, results: [2, 0, -1], bankTotal: 18 },
		{ seq: 61, type: "passReady", seat: 0 },
		{ seq: 62, type: "passReady", seat: 1 },
		{ seq: 63, type: "exchange", shift: 1, count: 3 },
		{ seq: 64, type: "trickWon", seat: 0, points: 0 },
		{ seq: 65, type: "trickWon", seat: 0, points: 14 },
		{ seq: 66, type: "trickWon", seat: 1, points: 0 },
		{ seq: 67, type: "trickWon", seat: 1, points: 1 },
		{ seq: 68, type: "broken", suit: "H" },
		{ seq: 69, type: "moon", seat: 0 },
		{ seq: 70, type: "moon", seat: 1 },
		{ seq: 71, type: "knock", seat: 0, gin: false },
		{ seq: 72, type: "knock", seat: 1, gin: false },
		{ seq: 73, type: "knock", seat: 0, gin: true },
		{ seq: 74, type: "knock", seat: 1, gin: true },
		{ seq: 75, type: "handEnd", winner: 0, kind: "knock", points: 1 },
		{ seq: 76, type: "handEnd", winner: 1, kind: "knock", points: 14 },
		{ seq: 77, type: "handEnd", winner: 0, kind: "gin", points: 40 },
		{ seq: 78, type: "handEnd", winner: 1, kind: "gin", points: 40 },
		{ seq: 79, type: "handEnd", winner: 0, kind: "undercut", points: 25 },
		{ seq: 80, type: "handEnd", winner: 1, kind: "undercut", points: 25 },
		{ seq: 81, type: "bid", seat: 0, count: 2 },
		{ seq: 82, type: "bid", seat: 1, count: 0 },
		{ seq: 83, type: "raise", seat: 0, stake: 2 },
		{ seq: 84, type: "raise", seat: 1, stake: 3 },
		{ seq: 85, type: "raise", seat: null, stake: 2 },
		{ seq: 86, type: "stay", seat: 0 },
		{ seq: 87, type: "stay", seat: 1 },
		{ seq: 88, type: "fold", seat: 0, cost: 1 },
		{ seq: 89, type: "fold", seat: 1, cost: 2 },
		{ seq: 90, type: "swapHand", seat: 0 },
		{ seq: 91, type: "swapHand", seat: 1 },
		{ seq: 92, type: "dealWon", seat: 0 },
		{ seq: 93, type: "dealWon", seat: 1 },
		{ seq: 94, type: "out", seat: 0 },
		{ seq: 95, type: "out", seat: 1 },
		{ seq: 96, type: "deal", round: 2, skipped: [1] },
	];

	it.each([
		["en", en.games.cards],
		["nl", nl.games.cards],
	] as const)("leaves no placeholder behind in %s", (_, messages) => {
		for (const event of events) {
			const text = describeEvent(event, wordsFor(messages), table);
			expect(text.length).toBeGreaterThan(0);
			expect(text).not.toMatch(/[{}]|undefined/);
		}
	});

	it("puts a skip after the play that caused it", () => {
		const text = latestEventText(
			[
				{ seq: 1, type: "play", seat: 0, card: "S8#0" },
				{ seq: 2, type: "skip", seat: 2 },
			],
			words,
			table,
		);
		expect(text).toContain(cardName(cards, "S8#0"));
		expect(text).toContain(cards.bots.bot0);
	});

	it("tells a player what the round at the bank brought them", () => {
		const settle = (results: number[]): CardEvent => ({
			seq: 1,
			type: "settle",
			round: 3,
			results,
			bankTotal: 20,
		});
		expect(describeEvent(settle([0, 3, 1]), words, table)).toBe(
			words.countOf(3, cards.events.settleYouWin),
		);
		expect(describeEvent(settle([0, -2, 1]), words, table)).toBe(
			words.countOf(2, cards.events.settleYouLose),
		);
		expect(describeEvent(settle([0, 0, 1]), words, table)).toBe(
			cards.events.settleYouEven,
		);
		expect(
			describeEvent(settle([0, 3, 1]), words, { ...table, you: null }),
		).toBe(words.fmt(cards.events.settle, { round: 3 }));
	});

	it("has nothing to say about an empty log", () => {
		expect(latestEventText([], words, table)).toBe("");
	});
});

describe("sheddingHint", () => {
	const view = (over: Partial<SheddingView>) =>
		({
			pendingDraw: 0,
			legal: [],
			drawnCard: null,
			mustContinue: false,
			...over,
		}) as SheddingView;

	it("stays quiet on someone else's turn", () => {
		expect(sheddingHint(view({}), false, words)).toBeNull();
	});

	it("tells the player what the turn asks for", () => {
		expect(sheddingHint(view({}), true, words)).toBe(cards.shedding.noMove);
		expect(sheddingHint(view({ legal: ["S2#0"] }), true, words)).toBe(
			cards.shedding.pickMove,
		);
		expect(sheddingHint(view({ mustContinue: true }), true, words)).toBe(
			cards.shedding.mustContinue,
		);
		expect(sheddingHint(view({ drawnCard: "S2#0" }), true, words)).toBe(
			cards.shedding.playDrawnHint,
		);
		expect(
			sheddingHint(view({ pendingDraw: 4, legal: ["S2#0"] }), true, words),
		).toContain("4");
	});
});

describe("bank table", () => {
	function bankView(over: Partial<BankView> = {}): BankView {
		return {
			family: "bank",
			phase: "play",
			turn: 1,
			round: 2,
			totalRounds: 10,
			hands: [
				["S10#0", "HK#0"],
				["SA#0", "D5#0"],
				["C9#0", "C8#0", "C7#0"],
			],
			handTotals: [20, 16, 24],
			handCounts: [2, 2, 3],
			bank: ["H9#0", null],
			bankTotal: 9,
			stockCount: 80,
			stakes: [1, 2, 5],
			results: [[1, -2, 0]],
			totals: [1, -2, 0],
			stakeOptions: [1, 2, 5],
			canStake: false,
			canDouble: false,
			winners: [],
			events: [],
			...over,
		};
	}

	it("signs a round's points", () => {
		expect(signedPoints(words, 3)).toBe("+3");
		expect(signedPoints(words, -2)).toBe("−2");
		expect(signedPoints(words, 0)).toBe("±0");
	});

	it("asks for a stake, then waits for the others", () => {
		const staking = bankView({ phase: "stake", canStake: true });
		expect(bankHint(staking, 1, words)).toBe(cards.bank.stakeHint);
		expect(bankHint({ ...staking, canStake: false }, 1, words)).toBe(
			cards.bank.stakeWaiting,
		);
		expect(bankHint(staking, null, words)).toBeNull();
	});

	it("holds the next stakes back while the last round's result is on show", () => {
		const staking = bankView({ phase: "stake", canStake: true, round: 3 });
		expect(bankHint(staking, 1, words, true)).toBe(
			words.fmt(cards.bank.roundSettled, { round: 2 }),
		);
		expect(bankHint(staking, 1, words, false)).toBe(cards.bank.stakeHint);
	});

	it("shows face-up cards as marks and as spoken names", () => {
		const shown = faceUpCards(cards, ["SK#0", "H7#0", "D10#0"]);
		expect(shown.text).toBe("K♠ 7♥ 10♦");
		expect(shown.label).toBe(
			[
				cardName(cards, "SK#0"),
				cardName(cards, "H7#0"),
				cardName(cards, "D10#0"),
			].join(", "),
		);
		expect(faceUpCards(cards, []).text).toBe("");
	});

	it("knows when the computer plays this device's seat", () => {
		const seat = (autopilot: boolean) => ({
			botIndex: null,
			name: null,
			autopilot,
			lastSeen: null,
		});
		expect(onAutopilot({ seats: [seat(false), seat(true)], you: 1 })).toBe(
			true,
		);
		expect(onAutopilot({ seats: [seat(false), seat(true)], you: 0 })).toBe(
			false,
		);
		expect(onAutopilot({ seats: [seat(true)], you: null })).toBe(false);
	});

	it("gives the total on your turn only", () => {
		expect(bankHint(bankView(), 1, words)).toBe(
			words.fmt(cards.bank.playHint, { total: 16 }),
		);
		expect(bankHint(bankView({ turn: 0 }), 1, words)).toBeNull();
		expect(bankHint(bankView({ phase: "finished" }), 1, words)).toBeNull();
	});

	it("notes each hand's total and what it plays for", () => {
		const view = bankView({
			hands: [
				["SA#0", "HK#0"],
				["SA#0", "D5#0"],
				["C9#0", "C8#0", "C7#0"],
			],
			handTotals: [21, 16, 24],
		});
		const forPoints = (count: number) =>
			words.countOf(count, cards.bank.playingFor);
		expect(bankSeatNote(words, view, 0)).toBe(
			`${cards.bank.natural} · ${forPoints(1)}`,
		);
		expect(bankSeatNote(words, view, 1)).toBe(`16 · ${forPoints(2)}`);
		expect(bankSeatNote(words, view, 2)).toBe(
			`${cards.bank.over} · ${forPoints(5)}`,
		);
		expect(
			bankSeatNote(words, { ...view, stakes: [null, null, null] }, 1),
		).toBe("16");
	});

	it("shows last round's result between rounds", () => {
		const between = bankView({ phase: "stake" });
		expect(bankSeatNote(words, between, 0)).toBe("+1");
		expect(bankSeatNote(words, between, 1)).toBe("−2");
		expect(bankSeatNote(words, between, 2)).toBe("±0");
		expect(bankSeatNote(words, { ...between, results: [] }, 0)).toBe("");
	});
});

describe("rummyTurn", () => {
	const run: CardId[] = ["S10#0", "SJ#0", "SQ#0"];
	const hand: CardId[] = [...run, "H2#0", "H3#0"];
	const turn = (
		view: Partial<RummyView>,
		selected: CardId[] = [],
		staged: CardId[][] = [],
	) =>
		rummyTurn({
			view: rummyView({ hand, ...view }),
			rules: rummyRules,
			you: 0,
			selected,
			staged,
		});

	it("knows drawing from playing, and neither on another's turn", () => {
		expect(turn({ phase: "draw" }).drawing).toBe(true);
		expect(turn({ phase: "play" }).playing).toBe(true);
		const theirs = turn({ turn: 1 });
		expect(theirs.mine).toBe(false);
		expect(theirs.playing).toBe(false);
	});

	it("opens at once when the selection reaches the opening points", () => {
		const opening = turn({}, run);
		expect(opening.shapePoints).toBe(30);
		expect(opening.canOpenNow).toBe(true);
	});

	it("needs more than a meld under the opening points", () => {
		const low = turn({ hand: ["S2#0", "S3#0", "S4#0", "H9#0"] }, [
			"S2#0",
			"S3#0",
			"S4#0",
		]);
		expect(low.shape).not.toBeNull();
		expect(low.canOpenNow).toBe(false);
	});

	it("counts what's set aside towards the opening", () => {
		const setAside = turn({}, [], [run]);
		expect(setAside.stagedPoints).toBe(30);
		expect(setAside.canOpen).toBe(true);
		expect(setAside.inHand).toEqual(["H2#0", "H3#0"]);
	});

	it("won't lay down the last card, because a turn ends on a discard", () => {
		const everything = turn({ hand: run, opened: [true, false] }, run);
		expect(everything.keepsOne).toBe(false);
		expect(everything.canOpenNow).toBe(false);
	});

	it("discards one card, but not the one just taken from the pile", () => {
		expect(turn({}, ["H2#0"]).canDiscard).toBe(true);
		expect(turn({}, ["H2#0", "H3#0"]).canDiscard).toBe(false);
		const taken = turn({ takenDiscard: "H2#0" }, ["H2#0"]);
		expect(taken.cantReturn).toBe(true);
		expect(taken.canDiscard).toBe(false);
	});

	it("forgets selected cards that left the hand", () => {
		expect(turn({}, ["D9#0"]).selection).toEqual([]);
	});

	it("only offers the pile when the rules and the phase allow it", () => {
		expect(turn({ phase: "draw" }).canTakeDiscard).toBe(true);
		expect(turn({ phase: "play" }).canTakeDiscard).toBe(false);
		expect(turn({ phase: "draw", top: null }).canTakeDiscard).toBe(false);
	});
});

describe("rummyMeldAction", () => {
	const opened = [true, false];

	it("adds a card that fits, in the order the meld needs", () => {
		const meld = meldOf(["S5#0", "S6#0", "S7#0"]);
		const turn = rummyTurn({
			view: rummyView({ hand: ["S8#0", "H2#0"], opened, melds: [meld] }),
			rules: rummyRules,
			you: 0,
			selected: ["S8#0"],
			staged: [],
		});
		expect(rummyMeldAction(turn, meld)).toEqual({
			type: "add",
			order: ["S8#0"],
		});
	});

	it("takes the joker back rather than adding", () => {
		const meld = meldOf(["S5#0", "JK#0", "S7#0"]);
		const turn = rummyTurn({
			view: rummyView({ hand: ["S6#0", "H2#0"], opened, melds: [meld] }),
			rules: rummyRules,
			you: 0,
			selected: ["S6#0"],
			staged: [],
		});
		expect(rummyMeldAction(turn, meld)).toEqual({ type: "swap" });
	});

	it("offers nothing before opening or for a card that doesn't fit", () => {
		const meld = meldOf(["S5#0", "S6#0", "S7#0"]);
		const notOpened = rummyTurn({
			view: rummyView({ hand: ["S8#0", "H2#0"], melds: [meld] }),
			rules: rummyRules,
			you: 0,
			selected: ["S8#0"],
			staged: [],
		});
		expect(rummyMeldAction(notOpened, meld)).toBeNull();
		const misfit = rummyTurn({
			view: rummyView({ hand: ["H9#0", "H2#0"], opened, melds: [meld] }),
			rules: rummyRules,
			you: 0,
			selected: ["H9#0"],
			staged: [],
		});
		expect(rummyMeldAction(misfit, meld)).toBeNull();
	});
});

describe("rummyHint", () => {
	const hint = (
		view: Partial<RummyView>,
		selected: CardId[] = [],
		staged: CardId[][] = [],
	) => {
		const full = rummyView(view);
		const turn = rummyTurn({
			view: full,
			rules: rummyRules,
			you: 0,
			selected,
			staged,
		});
		return rummyHint(turn, full, rummyRules, staged, {
			serverErrors: en.serverErrors,
			words,
		});
	};
	const hand: CardId[] = ["S10#0", "SJ#0", "SQ#0", "H2#0"];

	it("walks through a turn", () => {
		expect(hint({ phase: "draw", hand })).toBe(cards.rummy.drawHint);
		expect(hint({ hand })).toBe(cards.rummy.selectHint);
		expect(hint({ hand }, ["H2#0"])).toBe(cards.rummy.discardHint);
		expect(hint({ hand }, ["S10#0", "H2#0"])).toBe(cards.rummy.invalidMeld);
		expect(hint({ hand }, ["S10#0", "SJ#0", "SQ#0"])).toBe(
			cards.rummy.openNowHint,
		);
		expect(hint({ turn: 1, hand })).toBeNull();
	});

	it("explains why the card just taken can't go back", () => {
		expect(hint({ hand, takenDiscard: "H2#0" }, ["H2#0"])).toBe(
			en.serverErrors.cardsCannotReturnDiscard,
		);
	});
});

describe("gin turns", () => {
	const gin = resolvedRules(getCardGame("gin-rummy"), [], null);
	if (gin.family !== "gin") throw new Error("Gin Rummy is gin");
	const ginRules: GinRules = gin.rules;
	const ids = (faces: string) => faces.split(" ").map((face) => `${face}#0`);
	const fixed = () => 0.5;
	// Three runs for seat 0, then two loose cards; seat 1 holds nothing useful.
	const KNOCKER = "S2 S3 S4 H5 H6 H7 D9 D10 DJ";
	const DEFENDER = "S5 H8 DQ C3 C7 HK HQ D2 D4 CJ";

	function state(seat0: string, over: Partial<GinState> = {}): GinState {
		const hands = [ids(seat0), ids(DEFENDER)];
		const used = new Set([...hands.flat(), "C5#0"]);
		return {
			...createGin(ginRules, 2, fixed),
			hands,
			stock: buildDeck(1, 0).filter((card) => !used.has(card)),
			discard: ["C5#0"],
			turn: 0,
			phase: "play",
			events: [],
			...over,
		};
	}
	const turnFor = (game: GinState, you: number | null, selected = "") => {
		const view = viewGin(ginRules, game, you);
		const turn = ginTurn({
			view,
			rules: ginRules,
			you,
			selected: selected ? ids(selected) : [],
		});
		const hint = ginHint(turn, view, {
			cards,
			fmt: words.fmt,
			serverErrors: en.serverErrors,
			knocker: "Hanna",
		});
		return { view, turn, hint };
	};

	it("draws first, from either pile", () => {
		const game = state(DEFENDER.replace("S5", "SA"), { phase: "draw" });
		const { turn, hint } = turnFor(game, 0);
		expect(turn.drawing).toBe(true);
		expect(turn.canTakeDiscard).toBe(true);
		expect(hint).toBe(cards.gin.drawHint);
	});

	it("counts the deadwood the best discard leaves, and offers the knock", () => {
		const game = state(`${KNOCKER} C9 SK`);
		const none = turnFor(game, 0);
		expect(none.turn.deadwood).toBe(9);
		expect(none.turn.knockPossible).toBe(true);
		expect(none.hint).toBe(cards.gin.canKnockHint);

		const knock = turnFor(game, 0, "SK");
		expect(knock.turn.canKnock).toBe(true);
		expect(knock.turn.knockDeadwood).toBe(9);
		expect(knock.turn.gin).toBe(false);
		expect(knock.hint).toBe(words.fmt(cards.gin.knockHint, { deadwood: 9 }));

		const breakRun = turnFor(game, 0, "S2");
		expect(breakRun.turn.canDiscard).toBe(true);
		expect(breakRun.turn.canKnock).toBe(false);
		expect(breakRun.hint).toBe(cards.gin.discardHint);

		expect(turnFor(game, 0, "S2 S3").hint).toBe(cards.gin.oneCard);
	});

	it("goes gin when the discard leaves no deadwood", () => {
		const { turn, hint } = turnFor(state(`${KNOCKER} D8 CK`), 0, "CK");
		expect(turn.gin).toBe(true);
		expect(hint).toBe(cards.gin.ginHint);
	});

	it("won't discard the card just taken from the pile", () => {
		const game = state(`${KNOCKER} C9 SK`, { takenDiscard: "SK#0" });
		const { turn, hint } = turnFor(game, 0, "SK");
		expect(turn.canDiscard).toBe(false);
		expect(turn.canKnock).toBe(false);
		expect(hint).toBe(en.serverErrors.cardsCannotReturnDiscard);
		// The best discard skips the taken card too.
		expect(turn.deadwood).toBe(9 + 10 - 9);
	});

	it("waits on the other player, and shows a spectator no count", () => {
		const game = state(`${KNOCKER} C9 SK`);
		const other = turnFor(game, 1);
		expect(other.turn.mine).toBe(false);
		expect(other.hint).toBeNull();
		expect(other.turn.deadwood).toBeGreaterThan(0);
		expect(turnFor(game, null).turn.deadwood).toBeNull();
	});

	it("lays off what fits on the knocker's melds", () => {
		const knocked = applyGin(
			ginRules,
			state(`${KNOCKER} C2 SK`),
			0,
			{ type: "knock", card: "SK#0" },
			fixed,
		);
		expect(knocked.phase).toBe("layoff");

		const idle = turnFor(knocked, 1);
		expect(idle.turn.layingOff).toBe(true);
		// Everything the defender holds is still unmatched before laying off.
		expect(idle.turn.deadwood).toBeGreaterThan(0);
		expect(idle.hint).toBe(words.fmt(cards.gin.layoffHint, { name: "Hanna" }));

		const fits = turnFor(knocked, 1, "S5");
		const spades = fits.view.melds.find((meld) => meld.cards.includes("S2#0"));
		if (!spades) throw new Error("spade run");
		expect(ginLayoffOrder(fits.turn, spades)).toEqual(["S5#0"]);
		expect(fits.hint).toBe(cards.gin.layoffTapMeld);

		const loose = turnFor(knocked, 1, "CJ");
		expect(
			loose.view.melds.every((meld) => !ginLayoffOrder(loose.turn, meld)),
		).toBe(true);
		expect(loose.hint).toBe(cards.gin.layoffNoFit);
	});

	it("holds melds together, runs in their own order, then the deadwood", () => {
		expect(groupGinHand(ids("HK S3 SA C9 S2"), ginRules)).toEqual([
			...ids("SA S2 S3"),
			...sortCards(ids("C9 HK"), "suit"),
		]);
	});

	it("numbers each meld from 1 and leaves deadwood unmarked", () => {
		const hand = ids("HK S3 SA C9 S2 H5 D5 C5");
		const marks = ginMeldMarks(hand, ginRules);
		const run = marks.get("SA#0");
		const set = marks.get("H5#0");
		expect([run, set].sort()).toEqual([1, 2]);
		expect(marks.get("S2#0")).toBe(run);
		expect(marks.get("S3#0")).toBe(run);
		expect(marks.get("D5#0")).toBe(set);
		expect(marks.get("C5#0")).toBe(set);
		expect(marks.has("HK#0")).toBe(false);
		expect(marks.has("C9#0")).toBe(false);
		// The numbers follow the order groupGinHand lays the melds out in.
		const grouped = groupGinHand(hand, ginRules);
		expect(marks.get(grouped[0])).toBe(1);
		expect(marks.get(grouped[3])).toBe(2);
	});
});

describe("fresh cards", () => {
	const deal: CardEvent = { seq: 1, type: "deal", round: 1 };
	const draw: CardEvent = {
		seq: 2,
		type: "draw",
		seat: 0,
		count: 1,
		source: "stock",
	};

	it("marks nothing on the first look or a new deal", () => {
		const first = nextFreshCards(startFreshCards(true), ["S2#0"], true, [deal]);
		expect(first.fresh).toEqual([]);
		const redeal = nextFreshCards(first, ["H9#0"], true, [
			{ seq: 9, type: "deal", round: 2 },
		]);
		expect(redeal.fresh).toEqual([]);
	});

	it("marks a drawn card until the next turn begins", () => {
		const first = nextFreshCards(startFreshCards(true), ["S2#0"], true, [deal]);
		const drew = nextFreshCards(first, ["S2#0", "S3#0"], true, [deal, draw]);
		expect(drew.fresh).toEqual(["S3#0"]);
		const waiting = nextFreshCards(drew, ["S2#0", "S3#0"], false, [deal, draw]);
		expect(waiting.fresh).toEqual(["S3#0"]);
		const again = nextFreshCards(waiting, ["S2#0", "S3#0"], true, [deal, draw]);
		expect(again.fresh).toEqual([]);
	});

	it("treats a rematch's restarted log as a new deal", () => {
		const late = nextFreshCards(startFreshCards(true), ["S2#0"], true, [
			{ seq: 50, type: "pass", seat: 1 },
		]);
		const rematch = nextFreshCards(late, ["H9#0"], true, [
			{ seq: 3, type: "pass", seat: 1 },
		]);
		expect(rematch.fresh).toEqual([]);
	});
});

describe("flights", () => {
	const plan = (events: CardEvent[], you: number | null = 0) =>
		planFlights(events, {
			you,
			seatCount: 3,
			meldCard: (id) => (id === 4 ? "S5#0" : null),
		});

	it("returns only what's new, or everything after a rematch", () => {
		const events: CardEvent[] = [
			{ seq: 5, type: "reshuffle" },
			{ seq: 6, type: "reshuffle" },
		];
		expect(eventsSince(events, 5).map((event) => event.seq)).toEqual([6]);
		expect(eventsSince(events, 40)).toEqual(events);
	});

	it("deals a few cards to each seat from the stock", () => {
		const { flights } = plan([{ seq: 1, type: "deal", round: 1 }]);
		expect(flights.length).toBe(9);
		expect(flights.every((flight) => flight.from === "stock")).toBe(true);
		expect(new Set(flights.map((flight) => flight.to))).toEqual(
			new Set(["hand", "seat-1", "seat-2"]),
		);
	});

	it("flies a played card from where it was, staggered", () => {
		const { flights } = plan([
			{ seq: 1, type: "play", seat: 0, card: "S7#0" },
			{ seq: 2, type: "discard", seat: 1, card: "H7#0" },
		]);
		expect(flights[0]).toMatchObject({
			card: "S7#0",
			from: "hand",
			to: "discard",
			fromHandCard: true,
			delay: 0,
		});
		expect(flights[1]).toMatchObject({
			card: "H7#0",
			from: "seat-1",
			fromHandCard: false,
		});
		expect(flights[1].delay).toBeGreaterThan(0);
	});

	it("keeps drawn cards face down, and caps a big penalty", () => {
		const { flights } = plan([
			{ seq: 1, type: "draw", seat: 1, count: 2, source: "discard" },
			{ seq: 2, type: "penalty", seat: 2, count: 20 },
		]);
		expect(flights.every((flight) => flight.card === null)).toBe(true);
		expect(flights.slice(0, 2).every((f) => f.from === "discard")).toBe(true);
		expect(flights.length).toBe(8);
	});

	it("aims melds, additions and swaps at their meld", () => {
		const { flights } = plan([
			{ seq: 1, type: "meld", seat: 1, meldIds: [4], opened: true },
			{ seq: 2, type: "layoff", seat: 2, meldId: 4, cards: ["S8#0"] },
			{ seq: 3, type: "swap", seat: 0, meldId: 4, card: "S6#0" },
		]);
		expect(
			flights.map((flight) => [flight.card, flight.from, flight.to]),
		).toEqual([
			["S5#0", "seat-1", "meld-4"],
			["S8#0", "seat-2", "meld-4"],
			["S6#0", "hand", "meld-4"],
		]);
	});

	it("deals a hit to its hand and a bank card to the bank", () => {
		const { flights } = plan([
			{ seq: 1, type: "hit", seat: 0, card: "S7#0", total: 17 },
			{ seq: 2, type: "double", seat: 2, card: "S8#0", total: 18 },
			{ seq: 3, type: "bankDraw", card: "S9#0", total: 19 },
		]);
		expect(
			flights.map((flight) => [flight.card, flight.from, flight.to]),
		).toEqual([
			["S7#0", "stock", "hand"],
			["S8#0", "stock", "seat-2"],
			["S9#0", "stock", "bank"],
		]);
	});

	it("deals two cards each and two to the bank at a bank table", () => {
		const { flights } = plan([
			{ seq: 1, type: "deal", round: 1, perSeat: 2, bank: true },
		]);
		expect(flights.map((flight) => flight.to)).toEqual([
			"hand",
			"seat-1",
			"seat-2",
			"bank",
			"hand",
			"seat-1",
			"seat-2",
			"bank",
		]);
	});

	it("bumps the seat that was skipped, and a spectator has no hand", () => {
		const { flash } = plan([{ seq: 1, type: "skip", seat: 2 }]);
		expect(flash).toBe(2);
		const watching = plan(
			[{ seq: 1, type: "play", seat: 0, card: "S7#0" }],
			null,
		);
		expect(watching.flights[0]).toMatchObject({
			from: "seat-0",
			fromHandCard: false,
		});
	});
});

describe("specialCards", () => {
	it("lists every Pesten special card with its effect and switch", () => {
		const list = specialCards(wordsFor(en.games.cards), getCardGame("pesten"));
		expect(list.map((card) => card.key).sort()).toEqual(
			["2", "7", "8", "A", "J", "joker"].sort(),
		);
		const two = list.find((card) => card.key === "2");
		expect(two).toMatchObject({
			sample: "S2#0",
			name: "Two pulls two",
			effect: "Next player takes 2",
			option: "plain2",
			adds: false,
			minPlayers: null,
		});
		expect(list.find((card) => card.key === "joker")?.sample).toBe("JK#0");
	});

	it("has Dutch text for every card", () => {
		const names = nl.games.cards.games.pesten.powers as Record<string, string>;
		for (const card of specialCards(
			wordsFor(nl.games.cards),
			getCardGame("pesten"),
		)) {
			expect(card.name).toBe(names[card.key]);
			expect(card.effect).not.toMatch(/\{/);
		}
	});

	it("is empty for a game without special cards", () => {
		expect(
			specialCards(wordsFor(en.games.cards), getCardGame("jokeren")),
		).toEqual([]);
	});
});

const hartenjagen = (options: string[] = []) => {
	const resolved = resolvedRules(getCardGame("hartenjagen"), options, null);
	if (resolved.family !== "tricks") throw new Error("Hartenjagen takes tricks");
	return resolved.rules;
};

function tricksView(over: Partial<TricksView> = {}): TricksView {
	return {
		family: "tricks",
		phase: "playing",
		round: 1,
		target: 100,
		deals: null,
		handSize: 13,
		turn: 1,
		teams: [0, 1, 2],
		offered: null,
		trumpPassed: [false, false, false],
		maker: null,
		roem: [0, 0, 0],
		lastDeal: null,
		handCounts: [13, 13, 13],
		hand: [],
		legal: [],
		passDirection: "left",
		passCount: 3,
		passed: null,
		passReady: [false, false, false],
		received: [],
		trick: [],
		lastTrick: null,
		trump: null,
		turnedUp: null,
		bids: null,
		legalBids: [],
		blockedBid: null,
		broken: false,
		roundPoints: [0, 0, 0],
		tricksTaken: [0, 0, 0],
		scores: [],
		totals: [0, 0, 0],
		moon: null,
		winners: [],
		events: [],
		matchEnd: "lowestAtTarget",
		stake: null,
		folded: [false, false, false],
		out: [false, false, false],
		knock: null,
		lastKnocker: null,
		canKnock: false,
		canSwap: false,
		dealWinner: null,
		...over,
	};
}

describe("tricksHint", () => {
	const rules: TricksRules = hartenjagen();

	it("asks for the pass, then waits for the others", () => {
		const passing = tricksView({ phase: "passing" });
		expect(tricksHint(passing, 1, words, rules)).toBe(
			"Pick 3 cards to pass to the left.",
		);
		expect(
			tricksHint(
				{ ...passing, passed: ["S2#0", "S3#0", "S4#0"] },
				1,
				words,
				rules,
			),
		).toBe(cards.tricks.passWaiting);
		expect(tricksHint(passing, null, words, rules)).toBeNull();
	});

	it("stays quiet on someone else's turn", () => {
		expect(tricksHint(tricksView({ turn: 0 }), 1, words, rules)).toBeNull();
	});

	it("names the opening card", () => {
		const view = tricksView({ hand: ["C2#0", "H5#0"], legal: ["C2#0"] });
		expect(tricksHint(view, 1, words, rules)).toBe("Lead the two of clubs.");
	});

	it("says whether the player can follow", () => {
		const trick = [{ seat: 0, card: "S9#0" as CardId }];
		expect(
			tricksHint(
				tricksView({ trick, hand: ["S2#0", "H4#0"], legal: ["S2#0"] }),
				1,
				words,
				rules,
			),
		).toBe("Follow suit: play spades.");
		expect(
			tricksHint(
				tricksView({ trick, hand: ["D2#0", "H4#0"], legal: ["D2#0", "H4#0"] }),
				1,
				words,
				rules,
			),
		).toBe("No spades left: play any card.");
	});

	it("warns about hearts only while they are held back", () => {
		const held = tricksView({ hand: ["S2#0", "H4#0"], legal: ["S2#0"] });
		expect(tricksHint(held, 1, words, rules)).toBe(
			"Your lead. No hearts until they're broken.",
		);
		const onlyHearts = tricksView({ hand: ["H4#0"], legal: ["H4#0"] });
		expect(tricksHint(onlyHearts, 1, words, rules)).toBe(cards.tricks.lead);
		const broken = tricksView({
			broken: true,
			hand: ["S2#0", "H4#0"],
			legal: ["S2#0", "H4#0"],
		});
		expect(tricksHint(broken, 1, words, rules)).toBe(cards.tricks.lead);
	});
});

describe("tricksSeatNote", () => {
	it("says who has passed, then signs this round's points", () => {
		const passing = tricksView({
			phase: "passing",
			passReady: [false, true, false],
		});
		expect(tricksSeatNote(passing, 1, words)).toBe(cards.tricks.passedNote);
		expect(tricksSeatNote(passing, 0, words)).toBe("0 pts · +0");
		const scored = tricksView({ totals: [12, 3, 0], roundPoints: [5, -10, 0] });
		expect(tricksSeatNote(scored, 0, words)).toBe("12 pts · +5");
		expect(tricksSeatNote(scored, 1, words)).toBe("3 pts · −10");
	});
});

describe("tricksRuleLines", () => {
	it.each([
		["en", en.games.cards],
		["nl", nl.games.cards],
	] as const)("writes every rule in %s", (_, messages) => {
		for (const options of [
			[],
			["noPassing", "queenBreaksHearts", "jackOfDiamonds", "to50"],
		]) {
			const lines = tricksRuleLines(wordsFor(messages), hartenjagen(options));
			const all = [
				lines.goal,
				...(lines.passing ?? []),
				...lines.turn,
				...lines.points,
			];
			for (const line of all) {
				expect(line.length).toBeGreaterThan(0);
				expect(line).not.toMatch(/[{}]|undefined/);
			}
		}
	});

	it("follows the house rules", () => {
		const plain = tricksRuleLines(words, hartenjagen());
		expect(plain.goal).toContain("100");
		expect(plain.passing?.[0]).toContain("to the left, to the right, across");
		expect(plain.turn).toContain(
			"From high to low: A K Q J 10 9 8 7 6 5 4 3 2.",
		);
		expect(plain.points).toHaveLength(3);

		const house = tricksRuleLines(
			words,
			hartenjagen(["noPassing", "queenBreaksHearts", "jackOfDiamonds", "to50"]),
		);
		expect(house.goal).toContain("50");
		expect(house.passing).toEqual([cards.rules.tricks.noPass]);
		expect(house.turn.join(" ")).toContain("queen of spades");
		expect(house.points.join(" ")).toContain("jack of diamonds");
	});
});

const toepen = (options: string[] = []) => {
	const resolved = resolvedRules(getCardGame("toepen"), options, null);
	if (resolved.family !== "tricks") throw new Error("Toepen takes tricks");
	return resolved.rules;
};

/** A Toepen table: three seats with a stake. */
function stakesView(over: Partial<TricksView> = {}) {
	return tricksView({
		target: 10,
		passDirection: "keep",
		passCount: 0,
		handCounts: [4, 4, 4],
		matchEnd: "lastStanding",
		stake: 1,
		...over,
	});
}

describe("toepen at the table", () => {
	const rules = toepen();

	it("leaves an empty place in the trick only for seats still to play", () => {
		const view = stakesView({
			handCounts: [3, 4, 0, 4],
			trick: [{ seat: 0, card: "S7#0" }],
			folded: [false, false, false, true],
			out: [false, false, true, false],
		});
		expect(openTrickSlots(view)).toBe(1);
		expect(openTrickSlots({ ...view, phase: "knocking" })).toBe(0);
	});

	it("asks the seats a knock waits on, and tells the rest to wait", () => {
		const view = stakesView({
			phase: "knocking",
			stake: 3,
			knock: { by: 0, asked: [1, 2], answers: [null, "stay", null] },
		});
		expect(tricksHint(view, 2, words, rules)).toBe(
			"The stake is now 3. Stay in, or fold and take 2 points.",
		);
		expect(tricksHint(view, 1, words, rules)).toBe(cards.tricks.knockWaiting);
		expect(tricksHint(view, 0, words, rules)).toBe(cards.tricks.knockWaiting);
		expect(tricksChoices(view, 2).answer).toBe(true);
		expect(tricksChoices(view, 1).answer).toBe(false);
		expect(tricksChoices(view, null).answer).toBe(false);
		const lastLife = stakesView({
			phase: "knocking",
			stake: 2,
			knock: { by: null, asked: [0], answers: [null, null, null] },
		});
		expect(tricksHint(lastLife, 0, words, rules)).toBe(
			"Someone is one point from out: the stake starts at 2. Stay in, or fold and take 1 point.",
		);
	});

	it("tells a folded or knocked-out seat to wait, and offers a swap", () => {
		expect(
			tricksHint(stakesView({ folded: [true, false, false] }), 0, words, rules),
		).toBe(cards.tricks.foldedHint);
		expect(
			tricksHint(stakesView({ out: [true, false, false] }), 0, words, rules),
		).toBe(cards.tricks.outHint);
		const swap = stakesView({ canSwap: true, canKnock: true });
		expect(tricksHint(swap, 0, words, rules)).toBe(cards.tricks.swapHint);
		expect(tricksChoices(swap, 0)).toEqual({
			knock: true,
			answer: false,
			swap: true,
		});
	});

	it("notes each seat's penalty points and what it did", () => {
		const view = stakesView({
			phase: "knocking",
			totals: [3, 9, 10],
			folded: [false, true, false],
			out: [false, false, true],
			knock: { by: 0, asked: [1], answers: [null, "fold", null] },
		});
		expect(tricksSeatNote(view, 0, words)).toBe("3 of 10 · Knocked");
		expect(tricksSeatNote(view, 1, words)).toBe("9 of 10 · Folded");
		expect(tricksSeatNote(view, 2, words)).toBe("10 of 10 · Out");
		const waiting = stakesView({
			phase: "knocking",
			knock: { by: 2, asked: [0, 1], answers: ["stay", null, null] },
		});
		expect(tricksSeatNote(waiting, 0, words)).toBe("0 of 10 · Stays in");
		expect(tricksSeatNote(waiting, 1, words)).toBe("0 of 10 · Deciding…");
		expect(tricksSeatNote(stakesView(), 1, words)).toBe("0 of 10");
		expect(tricksRoundLabel(stakesView({ round: 3 }), words)).toBe(
			"Round 3 · out at 10",
		);
	});

	it.each([
		["en", en.games.cards],
		["nl", nl.games.cards],
	] as const)("writes every rule in %s", (_, messages) => {
		const all = ["outAt15", "vuileWas", "armoede", "lastLife"];
		const lines = tricksRuleLines(wordsFor(messages), toepen(all));
		for (const line of [lines.goal, ...lines.turn, ...lines.stakes]) {
			expect(line.length).toBeGreaterThan(0);
			expect(line).not.toMatch(/[{}]|undefined/);
		}
		expect(lines.passing).toBeNull();
		expect(lines.points).toEqual([]);
	});

	it("writes the stakes from the house rules", () => {
		const plain = tricksRuleLines(words, toepen());
		expect(plain.goal).toContain("At 10 penalty points you're out.");
		expect(plain.turn).toContain("From high to low: 10 9 8 7 A K Q J.");
		expect(plain.turn).toContain(cards.rules.tricks.lastTrickOnly);
		expect(plain.stakes).not.toContain(cards.rules.tricks.lastLife);
		const house = tricksRuleLines(
			words,
			toepen(["outAt15", "vuileWas", "armoede", "lastLife"]),
		);
		expect(house.goal).toContain("15");
		expect(house.stakes).toContain(cards.rules.tricks.lastLife);
		expect(house.stakes.filter((line) => line.includes("swapped"))).toEqual([
			"A hand of only J Q K A may be swapped for new cards before the first card is played.",
			"A hand of only 7 8 9 10 may be swapped for new cards before the first card is played.",
		]);
	});

	it("deals no cards to a seat that is out", () => {
		const { flights } = planFlights(
			[{ seq: 1, type: "deal", round: 2, skipped: [1] }],
			{ you: 0, seatCount: 3, meldCard: () => null },
		);
		expect(flights.some((flight) => flight.to === "seat-1")).toBe(false);
		expect(flights.some((flight) => flight.to === "seat-2")).toBe(true);
	});
});

const klaverjassen = (options: string[] = []) => {
	const resolved = resolvedRules(getCardGame("klaverjassen"), options, null);
	if (resolved.family !== "tricks")
		throw new Error("Klaverjassen takes tricks");
	return resolved.rules;
};

const fourSeats = {
	you: 1,
	seats: [
		seat({ name: "Anna" }),
		seat({ name: "Me" }),
		seat({ name: "Bram" }),
		seat({ name: "Cas" }),
	],
};

/** A Klaverjassen deal in progress: seats 0 and 2 against 1 and 3. */
function teamView(over: Partial<TricksView> = {}): TricksView {
	return tricksView({
		target: null,
		deals: 16,
		handSize: 8,
		round: 3,
		teams: [0, 1, 0, 1],
		trumpPassed: [false, false, false, false],
		roem: [20, 0, 0, 50],
		handCounts: [8, 8, 8, 8],
		passDirection: "keep",
		passCount: 0,
		passReady: [false, false, false, false],
		roundPoints: [30, 12, 8, 0],
		tricksTaken: [0, 0, 0, 0],
		scores: [
			[100, 82, 100, 82],
			[0, 262, 0, 262],
		],
		totals: [100, 344, 100, 344],
		...over,
	});
}

describe("team tables", () => {
	it("groups seats in teams, the viewer's own first", () => {
		const teams = tricksTeams(teamView(), 1);
		expect(teams).toEqual([
			{ team: 1, seats: [1, 3], total: 344, points: 12, roem: 50, yours: true },
			{
				team: 0,
				seats: [0, 2],
				total: 100,
				points: 38,
				roem: 20,
				yours: false,
			},
		]);
		expect(tricksTeams(teamView(), null)[0].team).toBe(0);
	});

	it("scores one row per team, and one per seat without teams", () => {
		const rows = tricksScoreRows(teamView(), fourSeats, cards);
		expect(rows.labels).toEqual(["You & Cas", "Anna & Bram"]);
		expect(rows.scores).toEqual([
			[82, 100],
			[262, 0],
		]);
		expect(rows.totals).toEqual([344, 100]);
		const solo = tricksScoreRows(
			tricksView({ totals: [4, 9, 2] }),
			table,
			cards,
		);
		expect(solo.labels).toHaveLength(3);
		expect(solo.totals).toEqual([4, 9, 2]);
	});

	it("ranks the highest first when the highest wins, else the lowest first", () => {
		expect(
			tricksStandings(teamView(), fourSeats, cards, true).map((row) => [
				row.label,
				row.best,
			]),
		).toEqual([
			["You & Cas", true],
			["Anna & Bram", false],
		]);
		const solo = tricksStandings(
			tricksView({ totals: [4, 9, 2] }),
			table,
			cards,
			false,
		);
		expect(solo.map((row) => row.total)).toEqual([2, 4, 9]);
		expect(solo[0].best).toBe(true);
	});

	it("labels the round by deals or by target", () => {
		expect(tricksRoundLabel(teamView(), words)).toBe("Round 3 of 16 · 8 cards");
		expect(tricksRoundLabel(tricksView(), words)).toBe("Round 1 · to 100");
	});

	it("names the winning team, or yours", () => {
		const theirs = teamView({ phase: "finished", winners: [0, 2] });
		expect(tricksMatchTitle(theirs, fourSeats, words)).toBe(
			"Anna & Bram win the game!",
		);
		const yours = teamView({ phase: "finished", winners: [1, 3] });
		expect(tricksMatchTitle(yours, fourSeats, words)).toBe(
			cards.tricks.matchYourTeamWins,
		);
		const tie = teamView({ phase: "finished", winners: [0, 1, 2, 3] });
		expect(tricksMatchTitle(tie, fourSeats, words)).toBe(cards.tricks.matchTie);
	});

	it("sums up the last deal with its nat and pit headlines", () => {
		expect(tricksDealSummary(teamView(), fourSeats, words)).toBeNull();
		const nat = teamView({
			lastDeal: {
				points: [70, 92],
				roem: [20, 0],
				maker: 0,
				nat: true,
				pit: null,
				scores: [0, 182],
			},
		});
		expect(tricksDealSummary(nat, fourSeats, words)).toEqual({
			headlines: ["Anna & Bram went nat: the other team scores everything."],
			teams: [
				{
					team: 1,
					label: "You & Cas",
					detail: "92 points + 0 roem",
					score: 182,
				},
				{
					team: 0,
					label: "Anna & Bram",
					detail: "70 points + 20 roem",
					score: 0,
				},
			],
		});
		const pit = teamView({
			lastDeal: {
				points: [0, 162],
				roem: [0, 100],
				maker: 1,
				nat: false,
				pit: 1,
				scores: [0, 262],
			},
		});
		expect(tricksDealSummary(pit, fourSeats, words)?.headlines).toEqual([
			cards.tricks.youPit,
		]);
	});

	it("marks partner and maker under the seats, and who passed on trump", () => {
		const playing = teamView({ maker: 3 });
		expect(tricksSeatNote(playing, 3, words, 1)).toBe("Partner · Plays");
		expect(tricksSeatNote(playing, 0, words, 1)).toBe("");
		const calling = teamView({
			phase: "trump",
			trumpPassed: [false, false, true, false],
		});
		expect(tricksSeatNote(calling, 2, words, 1)).toBe(
			cards.tricks.trumpPassedNote,
		);
	});
});

describe("klaverjassen hints", () => {
	const rules = klaverjassen();

	it("asks for a trump call in turn", () => {
		const offer = teamView({ phase: "trump", turn: 1, offered: "H" });
		expect(tricksHint(offer, 1, words, rules)).toBe(
			"Play with hearts as trump, or pass.",
		);
		expect(tricksHint(offer, 0, words, rules)).toBeNull();
		const named = teamView({ phase: "trump", turn: 1 });
		expect(tricksHint(named, 1, words, rules)).toBe(
			cards.tricks.trumpChooseHint,
		);
		const forced = teamView({
			phase: "trump",
			turn: 1,
			trumpPassed: [true, true, true, true],
		});
		expect(tricksHint(forced, 1, words, rules)).toBe(
			cards.tricks.trumpForcedHint,
		);
	});

	it("explains the trump duties", () => {
		const base = { trump: "H" as const, turn: 1 };
		const ruffed = teamView({
			...base,
			trick: [{ seat: 0, card: "S9#0" }],
			hand: ["H7#0", "HJ#0", "D7#0"],
			legal: ["H7#0", "HJ#0"],
		});
		expect(tricksHint(ruffed, 1, words, rules)).toBe(
			"No spades left: play a trump.",
		);
		const over = teamView({
			...base,
			trick: [
				{ seat: 3, card: "S9#0" },
				{ seat: 0, card: "H10#0" },
			],
			hand: ["H7#0", "HJ#0", "D7#0"],
			legal: ["HJ#0"],
		});
		expect(tricksHint(over, 1, words, rules)).toBe(
			"No spades left: play a higher trump.",
		);
		const under = teamView({
			...base,
			trick: [
				{ seat: 3, card: "S9#0" },
				{ seat: 0, card: "HJ#0" },
			],
			hand: ["H7#0", "D7#0"],
			legal: ["D7#0"],
		});
		expect(tricksHint(under, 1, words, rules)).toBe(
			"No spades left: any card but a lower trump.",
		);
		const led = teamView({
			...base,
			trick: [{ seat: 0, card: "H10#0" }],
			hand: ["H7#0", "HJ#0", "D7#0"],
			legal: ["HJ#0"],
		});
		expect(tricksHint(led, 1, words, rules)).toBe(cards.tricks.overtrump);
	});

	it("sorts a hand by suit, trumps by trump rank", () => {
		const hand: CardId[] = ["HJ#0", "H9#0", "HA#0", "SJ#0", "SA#0", "S9#0"];
		expect(sortTricksHand(hand, rules, "H")).toEqual([
			"S9#0",
			"SJ#0",
			"SA#0",
			"HA#0",
			"H9#0",
			"HJ#0",
		]);
	});
});

describe("klaverjassen rules sheet", () => {
	it.each([
		["en", en.games.cards],
		["nl", nl.games.cards],
	] as const)("writes every rule in %s", (_, messages) => {
		for (const options of [[], ["forcedTrump", "amsterdams", "shortMatch"]]) {
			const lines = tricksRuleLines(wordsFor(messages), klaverjassen(options));
			const sections = tricksRuleSections(lines, messages);
			expect(sections.map((section) => section.heading)).toEqual([
				messages.rules.trumpHeading,
				messages.rules.turnHeading,
				messages.rules.pointsHeading,
				messages.rules.roemHeading,
			]);
			for (const line of [lines.goal, ...sections.flatMap((s) => s.lines)]) {
				expect(line).not.toMatch(/[{}]|undefined/);
			}
		}
	});

	it("follows the house rules", () => {
		const plain = tricksRuleLines(words, klaverjassen());
		expect(plain.goal).toContain("16");
		expect(plain.trump[0]).toBe(cards.rules.tricks.callTrump);
		expect(plain.turn).not.toContain(cards.rules.tricks.partnerWins);
		expect(plain.turn).toContain("Trump, from high to low: J 9 A 10 K Q 8 7.");
		const house = tricksRuleLines(
			words,
			klaverjassen(["forcedTrump", "amsterdams", "shortMatch"]),
		);
		expect(house.goal).toContain("8");
		expect(house.trump[0]).toBe(cards.rules.tricks.nameTrump);
		expect(house.turn).toContain(cards.rules.tricks.partnerWins);
	});

	it("keeps Hartenjagen's sections", () => {
		const lines = tricksRuleLines(words, hartenjagen());
		expect(
			tricksRuleSections(lines, cards).map((section) => section.heading),
		).toEqual([
			cards.rules.passHeading,
			cards.rules.turnHeading,
			cards.rules.pointsHeading,
		]);
	});
});

describe("trick flights", () => {
	it("passes face-down cards between seats, and bumps the taker", () => {
		const { flights, flash } = planFlights(
			[
				{ seq: 1, type: "exchange", shift: 1, count: 3 },
				{ seq: 2, type: "trickWon", seat: 2, points: 1 },
			],
			{ you: 0, seatCount: 3, meldCard: () => null },
		);
		expect(flights).toHaveLength(9);
		expect(flights.every((flight) => flight.card === null)).toBe(true);
		expect(
			new Set(flights.map((flight) => `${flight.from}>${flight.to}`)),
		).toEqual(new Set(["hand>seat-1", "seat-1>seat-2", "seat-2>hand"]));
		expect(flash).toBe(2);
	});
});

const boerenbridge = (options: string[] = []) => {
	const resolved = resolvedRules(getCardGame("boerenbridge"), options, null);
	if (resolved.family !== "tricks")
		throw new Error("Boerenbridge takes tricks");
	return resolved.rules;
};

describe("bidding at the table", () => {
	const bidding = (over: Partial<TricksView> = {}) =>
		tricksView({
			phase: "bidding",
			target: null,
			deals: 25,
			handSize: 3,
			turn: 0,
			bids: [null, null, null],
			legalBids: [0, 1, 2, 3],
			passDirection: "keep",
			passCount: 0,
			...over,
		});

	it("asks for a bid, and tells the dealer which number is off limits", () => {
		const rules = boerenbridge();
		expect(tricksHint(bidding(), 0, words, rules)).toBe(
			"Bid how many tricks you'll take: 0 to 3.",
		);
		expect(tricksHint(bidding(), 1, words, rules)).toBeNull();
		const dealer = bidding({
			turn: 2,
			bids: [1, 1, null],
			blockedBid: 1,
			legalBids: [0, 2, 3],
		});
		expect(tricksHint(dealer, 2, words, rules)).toContain("can't bid 1");
	});

	it("shows each seat's tricks against its bid, and adds the bids up", () => {
		const view = bidding({ bids: [2, null, null] });
		expect(tricksSeatNote(view, 0, words)).toBe("Bid 2 · 0 pts");
		expect(tricksSeatNote(view, 1, words)).toBe("0 pts");
		const playing = bidding({
			phase: "playing",
			bids: [2, 0, 1],
			tricksTaken: [1, 0, 0],
			totals: [14, -2, 10],
		});
		expect(tricksSeatNote(playing, 0, words)).toBe("1 of 2 · 14 pts");
		expect(bidTotal(playing)).toBe(3);
		expect(bidTotal(tricksView())).toBeNull();
	});

	it.each([
		["en", en.games.cards],
		["nl", nl.games.cards],
	] as const)("writes the bidding rules in %s", (_, messages) => {
		for (const options of [
			[],
			["upOnly", "dealerFree"],
			["downOnly"],
			["shortHands"],
		]) {
			const lines = tricksRuleLines(wordsFor(messages), boerenbridge(options));
			expect(lines.passing).toBeNull();
			const all = [
				lines.goal,
				...(lines.bidding ?? []),
				...lines.turn,
				...lines.points,
			];
			for (const line of all) {
				expect(line.length).toBeGreaterThan(0);
				expect(line).not.toMatch(/[{}]|undefined/);
			}
		}
	});

	it("follows the house rules", () => {
		const plain = tricksRuleLines(words, boerenbridge());
		const r = cards.rules.tricks;
		expect(plain.goal).toBe(r.goalLastHigh);
		expect(plain.bidding).toEqual([r.schedules.upDown, r.bid, r.dealerRule]);
		expect(plain.turn).toContain(r.trumpTurnUp);
		expect(plain.turn).toContain(r.trickTrump);
		expect(plain.points).toEqual([
			"Bid met exactly: 10 points plus 2 per trick.",
			"Bid missed: 2 points off for every trick you're out by.",
		]);
		const house = tricksRuleLines(
			words,
			boerenbridge(["upOnly", "dealerFree"]),
		);
		expect(house.bidding).toEqual([r.schedules.up, r.bid]);
		const short = tricksRuleLines(words, boerenbridge(["shortHands"]));
		expect(short.bidding).toEqual([
			r.schedules.upDown,
			fmt(r.maxHand, { max: 7 }),
			r.bid,
			r.dealerRule,
		]);
	});
});
