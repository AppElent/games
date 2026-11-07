import { describe, expect, it } from "vitest";
import { CARD_ASPECT, cardBackArt, cardFaceArt } from "../cards/art";
import { buildDeck, type CardId, parseCard } from "../cards/deck";
import { getCardGame, resolvedRules } from "../cards/engine";
import type { CardEvent } from "../cards/events";
import { buildMeld, type Meld } from "../cards/melds";
import type { RummyRules, RummyView } from "../cards/rummy";
import type { SheddingView } from "../cards/shedding";
import {
	type CardWords,
	cardName,
	cardTilt,
	describeEvent,
	eventsSince,
	latestEventText,
	meldCardNames,
	nextFreshCards,
	opponentOrder,
	planFlights,
	rummyHint,
	rummyMeldAction,
	rummyTurn,
	seatIsSilent,
	seatName,
	sheddingHint,
	sortCards,
	startFreshCards,
} from "../cards/table-view";
import { en } from "../i18n/en";
import { nl } from "../i18n/nl";

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

const jokeren = resolvedRules(getCardGame("jokeren"), []);
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
