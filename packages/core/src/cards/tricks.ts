/**
 * Trick-taking family: everyone plays one card to a trick, the highest card of
 * the suit led (or the highest trump) takes it, and a deal is scored from the
 * tricks taken. What differs between games in the family is `TricksRules` data
 * plus a scorer named by `rules.scoring`; see the card games contract for how
 * Boerenbridge, Toepen and Klaverjassen are meant to fit.
 */
import { GameRuleError } from "../errors";
import { type Rng, shuffle } from "../random";
import {
	buildDeck,
	type CardId,
	cardFace,
	clone,
	deal,
	parseCard,
	type Rank,
	removeCard,
	type Suit,
} from "./deck";
import { type CardEvent, pushEvent } from "./events";
import type { BotMove } from "./table";

/** Where passed cards go: the next seat in play, the one before, or opposite. */
export const PASS_DIRECTIONS = ["left", "right", "across", "keep"] as const;
export type PassDirection = (typeof PASS_DIRECTIONS)[number];

/**
 * How a match ends: once someone reaches `target` and the lowest total wins,
 * or seats drop out at `target` and the last one in wins.
 */
export const MATCH_ENDS = ["lowestAtTarget", "lastStanding"] as const;
export type MatchEnd = (typeof MATCH_ENDS)[number];

export type TricksRules = {
	/** Low to high. Also which ranks are dealt, so a short deck is just fewer ranks. */
	ranks: readonly Rank[];
	/** Faces taken out of the deck, by seat count, so it deals out evenly. */
	stripped: Readonly<Record<number, readonly string[]>>;
	/** Cards passed before each deal, the direction cycling per deal; null for none. */
	passing: { count: number; cycle: readonly PassDirection[] } | null;
	/** The face that must open each deal, led by whoever holds it; null: left of the dealer leads. */
	firstLead: string | null;
	/** A suit nobody may lead until it has been played (or one of `alsoBrokenBy` has). */
	breaking: { suit: Suit; alsoBrokenBy: readonly string[] } | null;
	/** Which entry in `SCHEDULES` sets how many cards each seat is dealt. */
	schedule: keyof typeof SCHEDULES;
	/** Which entry in `TRUMPS` picks a deal's trump suit. */
	trumpChoice: keyof typeof TRUMPS;
	/** Which entry in `SEATINGS` puts seats into teams. */
	seating: keyof typeof SEATINGS;
	/** Which scorer in `SCORERS` turns the tricks taken into points. */
	scoring: keyof typeof SCORERS;
	/** Points per card of a suit; `cardPoints` overrides a single face. */
	suitPoints: Readonly<Partial<Record<Suit, number>>>;
	cardPoints: Readonly<Record<string, number>>;
	/** Taking every positive card in a deal gives their total to everyone else instead. */
	shootTheMoon: boolean;
	/** The total that ends the match, or puts a seat out (see `matchEnd`). */
	target: number;
	/** Absent: the lowest total wins once someone reaches `target`. */
	matchEnd?: MatchEnd;
	/**
	 * Absent: no stakes. Present: each deal is played for a stake of 1 that any
	 * seat may raise by knocking; everyone else then stays in or folds. With
	 * `lastLife`, a deal starts at 2 while someone is one point from out.
	 */
	knocking?: { lastLife: boolean };
	/**
	 * Rank sets: a hand made only of one set's ranks may be swapped for a fresh
	 * one before the deal's first card. Absent or empty: no swapping.
	 */
	swapHands?: readonly (readonly Rank[])[];
};

type TrickPlay = { seat: number; card: CardId };

export type TricksState = {
	family: "tricks";
	hands: CardId[][];
	dealer: number;
	/** Deals played so far, counting this one. */
	round: number;
	/** "knocking": a knock (or the last-life raise) waits for answers. */
	phase: "passing" | "knocking" | "playing" | "roundOver" | "finished";
	/** This deal's direction; "keep" when nobody passes. */
	passDirection: PassDirection;
	/** Cards each seat set aside to pass, until everyone has. Private. */
	passing: Array<CardId[] | null>;
	/** Cards each seat was passed this deal. Private to that seat. */
	received: CardId[][];
	turn: number;
	trick: TrickPlay[];
	lastTrick: { plays: TrickPlay[]; winner: number } | null;
	/** Hearts has none; a future game sets it per deal. */
	trump: Suit | null;
	broken: boolean;
	/** Cards each seat has won this deal. They were played face up, so not secret. */
	taken: CardId[][];
	tricksTaken: number[];
	/** Points per finished deal, one entry per seat. */
	scores: number[][];
	/** Who shot the moon in the last scored deal. */
	moon: number | null;
	winners: number[];
	events: CardEvent[];
	nextSeq: number;
	// Optional, so tables dealt before stakes and elimination still read.
	/** Seats out of the match; they are dealt no cards. */
	out?: boolean[];
	/** Seats that folded this deal: their cards are gone and they play no more. */
	folded?: boolean[];
	/** Points each seat has already lost this deal by folding. */
	paid?: number[];
	/** This deal's stake, with `knocking`. */
	stake?: number;
	/** Who knocked last: they may not knock again until someone else has. */
	lastKnocker?: number | null;
	knock?: KnockState | null;
	/** Who won the last scored deal, for scorers that name one. */
	dealWinner?: number | null;
	/** Cards nobody was dealt, for swapped hands. Private; absent on older tables. */
	stock?: CardId[];
	/** Folded and swapped-away cards, face down. Private. */
	mucked?: CardId[];
};

/** A raise waiting for answers. `by` is null for the last-life raise. */
export type KnockState = {
	by: number | null;
	/** Seats that must answer, in answering order. */
	asked: number[];
	answers: Array<"stay" | "fold" | null>;
};

export type TricksAction =
	| { type: "passCards"; cards: CardId[] }
	| { type: "play"; card: CardId }
	| { type: "nextRound" }
	| { type: "knock" }
	| { type: "stay" }
	| { type: "fold" }
	| { type: "swapHand" };

/** Keyed by action type, so a new action cannot be left out. */
export const TRICKS_ACTIONS: Record<TricksAction["type"], true> = {
	passCards: true,
	play: true,
	nextRound: true,
	knock: true,
	stay: true,
	fold: true,
	swapHand: true,
};

export type TricksView = {
	family: "tricks";
	phase: TricksState["phase"];
	round: number;
	target: number;
	turn: number;
	handCounts: number[];
	hand: CardId[];
	/** Cards this seat may play now; empty when it isn't their turn. */
	legal: CardId[];
	passDirection: PassDirection;
	passCount: number;
	/** This seat's own cards set aside to pass. */
	passed: CardId[] | null;
	/** Who has chosen their cards to pass. */
	passReady: boolean[];
	/** Cards passed to this seat this deal. */
	received: CardId[];
	trick: TrickPlay[];
	lastTrick: TricksState["lastTrick"];
	trump: Suit | null;
	broken: boolean;
	/** Points each seat has taken so far this deal, before any moon. */
	roundPoints: number[];
	tricksTaken: number[];
	scores: number[][];
	totals: number[];
	moon: number | null;
	winners: number[];
	events: CardEvent[];
	matchEnd: MatchEnd;
	/** This deal's stake; null when the game has no stakes. */
	stake: number | null;
	folded: boolean[];
	out: boolean[];
	knock: KnockState | null;
	lastKnocker: number | null;
	/** Whether this seat may knock, or swap its hand, right now. */
	canKnock: boolean;
	canSwap: boolean;
	dealWinner: number | null;
};

const suitOf = (card: CardId) => parseCard(card).suit as Suit;

/** A card's position in the game's rank order, low to high. */
export function rankIndex(rules: Pick<TricksRules, "ranks">, card: CardId) {
	return rules.ranks.indexOf(parseCard(card).rank as Rank);
}

/** What one card scores under the penalty rules. */
export function cardValue(
	rules: Pick<TricksRules, "suitPoints" | "cardPoints">,
	card: CardId,
) {
	return (
		rules.cardPoints[cardFace(card)] ?? rules.suitPoints[suitOf(card)] ?? 0
	);
}

function pointsOf(rules: TricksRules, cards: readonly CardId[]) {
	return cards.reduce((sum, card) => sum + cardValue(rules, card), 0);
}

/** The deck for this many seats: the game's ranks, minus what keeps the deal even. */
export function tricksDeck(rules: TricksRules, seats: number) {
	const stripped = rules.stripped[seats] ?? [];
	return buildDeck(1, 0, rules.ranks).filter(
		(card) => !stripped.includes(cardFace(card)),
	);
}

/** This deal's direction. Across needs someone opposite, so odd tables skip it. */
export function passDirectionFor(
	rules: TricksRules,
	seats: number,
	round: number,
): PassDirection {
	const cycle = (rules.passing?.cycle ?? []).filter(
		(direction) => direction !== "across" || seats % 2 === 0,
	);
	return cycle.length === 0 ? "keep" : cycle[(round - 1) % cycle.length];
}

/** Seats along the table a passed card travels. */
export function passShift(direction: PassDirection, seats: number) {
	switch (direction) {
		case "left":
			return 1;
		case "right":
			return seats - 1;
		case "across":
			return seats / 2;
		case "keep":
			return 0;
	}
}

/**
 * Who takes the trick: the highest trump, else the highest card of the suit led.
 * A seat that folded (`live` false) left its card in the trick: it still set the
 * suit if it led, but cannot win.
 */
export function trickWinner(
	rules: Pick<TricksRules, "ranks">,
	plays: readonly TrickPlay[],
	trump: Suit | null,
	live: (seat: number) => boolean = () => true,
) {
	const led = suitOf(plays[0].card);
	// Trumps beat the suit led, which beats the rest; those never win.
	const tier = (card: CardId) =>
		suitOf(card) === trump ? 2 : suitOf(card) === led ? 1 : 0;
	let best: TrickPlay | undefined;
	for (const play of plays.filter((candidate) => live(candidate.seat))) {
		const [mine, theirs] = [tier(play.card), best ? tier(best.card) : -1];
		const beats =
			mine > theirs ||
			(best !== undefined &&
				mine === theirs &&
				mine > 0 &&
				rankIndex(rules, play.card) > rankIndex(rules, best.card));
		if (beats) {
			best = play;
		}
	}
	return (best ?? plays[0]).seat;
}

function opener(rules: TricksRules, state: TricksState) {
	if (rules.firstLead) {
		const face = rules.firstLead;
		const holder = state.hands.findIndex((hand) =>
			hand.some((card) => cardFace(card) === face),
		);
		if (holder >= 0) {
			return holder;
		}
	}
	return nextLive(state, state.dealer);
}

const isOut = (state: TricksState, seat: number) => state.out?.[seat] === true;

/** Still playing this deal: not out of the match and not folded. */
const inDeal = (state: TricksState, seat: number) =>
	!isOut(state, seat) && state.folded?.[seat] !== true;

function nextWhere(
	state: TricksState,
	seat: number,
	keep: (seat: number) => boolean,
) {
	const seats = state.hands.length;
	for (let step = 1; step <= seats; step += 1) {
		const next = (seat + step) % seats;
		if (keep(next)) {
			return next;
		}
	}
	return seat;
}

/** The next seat along that is still in the match. */
function nextLive(state: TricksState, seat: number) {
	return nextWhere(state, seat, (next) => !isOut(state, next));
}

/** The next seat along that is still in this deal. */
function nextInDeal(state: TricksState, seat: number) {
	return nextWhere(state, seat, (next) => inDeal(state, next));
}

function seatsInDeal(state: TricksState) {
	return state.hands.flatMap((_, seat) => (inDeal(state, seat) ? [seat] : []));
}

function tricksPlayed(state: TricksState) {
	return state.tricksTaken.reduce((sum, count) => sum + count, 0);
}

/** Why `card` can't be played now, or null when it can. */
function refusal(
	rules: TricksRules,
	state: TricksState,
	seat: number,
	card: CardId,
) {
	const hand = state.hands[seat];
	if (!hand.includes(card)) {
		return "cardsNotInHand";
	}
	const suit = suitOf(card);
	if (state.trick.length > 0) {
		const led = suitOf(state.trick[0].card);
		return suit !== led && hand.some((held) => suitOf(held) === led)
			? "cardsMustFollow"
			: null;
	}
	const first = rules.firstLead;
	if (
		first &&
		tricksPlayed(state) === 0 &&
		hand.some((held) => cardFace(held) === first)
	) {
		return cardFace(card) === first ? null : "cardsMustOpenWith";
	}
	const breaking = rules.breaking;
	if (
		breaking &&
		!state.broken &&
		suit === breaking.suit &&
		hand.some((held) => suitOf(held) !== breaking.suit)
	) {
		return "cardsLeadNotBroken";
	}
	return null;
}

/** Every card `seat` may play now. */
export function legalTricksCards(
	rules: TricksRules,
	state: TricksState,
	seat: number,
) {
	if (state.phase !== "playing" || state.turn !== seat) {
		return [];
	}
	return state.hands[seat].filter(
		(card) => refusal(rules, state, seat, card) === null,
	);
}

/**
 * Hand sizes by name: the whole deck shared out, or (for a later game such as
 * Boerenbridge) a size that changes with the round.
 */
const SCHEDULES = {
	fullDeck: (deck: number, seats: number, _round: number) => deck / seats,
	fourEach: (_deck: number, _seats: number, _round: number) => 4,
} satisfies Record<
	string,
	(deck: number, seats: number, round: number) => number
>;

/**
 * Trump choosers by name, given the cards left over after the deal. A later
 * game turns one up, or has a seat choose it in a phase of its own.
 */
const TRUMPS = {
	none: (_rest: readonly CardId[]): Suit | null => null,
} satisfies Record<string, (rest: readonly CardId[]) => Suit | null>;

/**
 * Teams by name: each seat's team number. Partners share a total, so a team
 * game (Klaverjassen) wins or loses together.
 */
const SEATINGS = {
	alone: (seats: number) => Array.from({ length: seats }, (_, seat) => seat),
} satisfies Record<string, (seats: number) => number[]>;

function dealTricks(
	rules: TricksRules,
	seats: number,
	random: Rng,
	dealer: number,
	carried?: Pick<
		TricksState,
		"round" | "scores" | "events" | "nextSeq" | "out"
	>,
): TricksState {
	const stock = shuffle(tricksDeck(rules, seats), random);
	const round = carried?.round ?? 1;
	const out = carried?.out ?? Array.from({ length: seats }, () => false);
	const live = out.flatMap((gone, seat) => (gone ? [] : [seat]));
	const handSize = SCHEDULES[rules.schedule](stock.length, live.length, round);
	if (
		!Number.isInteger(handSize) ||
		handSize < 1 ||
		handSize * live.length > stock.length
	) {
		throw new Error(
			`the deck does not deal ${handSize} cards to ${live.length} seats`,
		);
	}
	// Seats out of the match get nothing.
	const dealt = deal(stock, live.length, handSize);
	const hands: CardId[][] = Array.from({ length: seats }, () => []);
	live.forEach((seat, index) => {
		hands[seat] = dealt[index];
	});
	// `deal` took the hands off the stock: what remains was never dealt.
	const undealt = stock;
	const direction = passDirectionFor(rules, seats, round);
	const state: TricksState = {
		family: "tricks",
		hands,
		dealer,
		round,
		phase: direction === "keep" ? "playing" : "passing",
		passDirection: direction,
		passing: hands.map(() => null),
		received: hands.map(() => []),
		turn: 0,
		trick: [],
		lastTrick: null,
		trump: TRUMPS[rules.trumpChoice](undealt),
		broken: false,
		taken: hands.map(() => []),
		tricksTaken: hands.map(() => 0),
		scores: carried?.scores ?? [],
		moon: null,
		winners: [],
		events: carried?.events ?? [],
		nextSeq: carried?.nextSeq ?? 0,
		...(rules.matchEnd === "lastStanding" ? { out } : {}),
		stock: undealt,
	};
	if (rules.knocking) {
		state.folded = hands.map(() => false);
		state.paid = hands.map(() => 0);
		state.stake = 1;
		state.lastKnocker = null;
		state.knock = null;
		state.dealWinner = null;
	}
	// While cards are being passed nobody has the turn, and naming the 2 of
	// clubs' holder early would say who was dealt it: the exchange picks the opener.
	state.turn =
		state.phase === "playing" ? opener(rules, state) : (dealer + 1) % seats;
	const skipped = out.flatMap((gone, seat) => (gone ? [seat] : []));
	pushEvent(state, {
		type: "deal",
		round,
		...(skipped.length > 0 ? { skipped } : {}),
	});
	if (rules.knocking?.lastLife) {
		raiseForLastLife(rules, state);
	}
	return state;
}

/** Seats one point from out: the deal starts at 2, and the others choose first. */
function raiseForLastLife(rules: TricksRules, state: TricksState) {
	const totals = totalsOf(state.scores, state.hands.length);
	const lastLife = (seat: number) => totals[seat] === rules.target - 1;
	const live = seatsInDeal(state);
	if (!live.some(lastLife)) {
		return;
	}
	state.stake = 2;
	const asked = live.filter((seat) => !lastLife(seat));
	pushEvent(state, { type: "raise", seat: null, stake: 2 });
	if (asked.length === 0) {
		return;
	}
	state.phase = "knocking";
	state.knock = {
		by: null,
		asked,
		answers: state.hands.map(() => null),
	};
}

/** Deals so `starter` sits left of the dealer. */
export function createTricks(
	rules: TricksRules,
	seats: number,
	random: Rng,
	starter: number,
) {
	return dealTricks(rules, seats, random, (starter + seats - 1) % seats);
}

/** Who sits left of the dealer in the rematch: the deal moves on one seat. */
export function nextTricksStarter(state: TricksState) {
	return (state.dealer + 2) % state.hands.length;
}

type DealScore = {
	points: number[];
	moon: number | null;
	/** The seat that won the deal, for scorers that have one. */
	winner?: number;
};

/** Penalty cards: each card scores its value, unless someone shot the moon. */
function scorePenaltyCards(rules: TricksRules, state: TricksState): DealScore {
	const raw = state.taken.map((cards) => pointsOf(rules, cards));
	if (!rules.shootTheMoon) {
		return { points: raw, moon: null };
	}
	const positive = (cards: readonly CardId[]) =>
		cards.reduce((sum, card) => sum + Math.max(0, cardValue(rules, card)), 0);
	const total = positive(state.taken.flat());
	const shooter = state.taken.findIndex(
		(cards) => total > 0 && positive(cards) === total,
	);
	if (shooter < 0) {
		return { points: raw, moon: null };
	}
	// The shooter keeps anything that counts in their favour; everyone else takes the lot.
	return {
		points: raw.map((points, seat) =>
			seat === shooter ? points - total : points + total,
		),
		moon: shooter,
	};
}

/**
 * Only the last trick counts: whoever takes it (or is the last one in after
 * everyone else folded) wins the deal, and everyone else still in loses the
 * stake. Folded seats lost theirs when they folded.
 */
function scoreLastTrick(_rules: TricksRules, state: TricksState): DealScore {
	const playing = seatsInDeal(state);
	const winner =
		playing.length === 1 ? playing[0] : (state.lastTrick?.winner ?? -1);
	const stake = state.stake ?? 1;
	return {
		points: state.hands.map(
			(_, seat) =>
				(state.paid?.[seat] ?? 0) +
				(inDeal(state, seat) && seat !== winner ? stake : 0),
		),
		moon: null,
		winner,
	};
}

/**
 * Scorers by name. A new game whose deals score differently (bids met, the
 * last trick, team points with roem) adds one here and names it in its rules.
 */
const SCORERS = {
	penaltyCards: scorePenaltyCards,
	lastTrick: scoreLastTrick,
} satisfies Record<
	string,
	(rules: TricksRules, state: TricksState) => DealScore
>;

function totalsOf(scores: readonly number[][], seats: number) {
	return Array.from({ length: seats }, (_, seat) =>
		scores.reduce((sum, round) => sum + (round[seat] ?? 0), 0),
	);
}

function scoreDeal(rules: TricksRules, state: TricksState) {
	const { points, moon, winner } = SCORERS[rules.scoring](rules, state);
	state.scores.push(points);
	state.moon = moon;
	if (moon !== null) {
		pushEvent(state, { type: "moon", seat: moon });
	}
	if (winner !== undefined) {
		state.dealWinner = winner;
		pushEvent(state, { type: "dealWon", seat: winner });
	}
	if (rules.matchEnd === "lastStanding") {
		endByElimination(rules, state);
		return;
	}
	// Partners play for one total, so the match ends and is won by team.
	const seats = state.hands.length;
	const team = SEATINGS[rules.seating](seats);
	const totals = totalsOf(state.scores, seats);
	const teamTotals = team.map((own) =>
		totals.reduce(
			(sum, total, seat) => (team[seat] === own ? sum + total : sum),
			0,
		),
	);
	if (Math.max(...teamTotals) < rules.target) {
		state.phase = "roundOver";
		return;
	}
	const lowest = Math.min(...teamTotals);
	state.phase = "finished";
	state.winners = teamTotals.flatMap((total, seat) =>
		total === lowest ? [seat] : [],
	);
	pushEvent(state, { type: "win", seats: state.winners });
}

/** Seats reaching `target` drop out; the match ends when one is left. */
function endByElimination(rules: TricksRules, state: TricksState) {
	const totals = totalsOf(state.scores, state.hands.length);
	const out = state.out ?? state.hands.map(() => false);
	const dropped = totals.flatMap((total, seat) =>
		!out[seat] && total >= rules.target ? [seat] : [],
	);
	for (const seat of dropped) {
		out[seat] = true;
		pushEvent(state, { type: "out", seat });
	}
	state.out = out;
	const live = out.flatMap((gone, seat) => (gone ? [] : [seat]));
	if (live.length > 1) {
		state.phase = "roundOver";
		return;
	}
	state.phase = "finished";
	// The deal's winner never loses points, so someone is always left.
	state.winners = live;
	pushEvent(state, { type: "win", seats: live });
}

function passCards(
	rules: TricksRules,
	state: TricksState,
	seat: number,
	cards: readonly CardId[],
) {
	if (state.phase !== "passing") {
		throw new GameRuleError("cardsNotPassing");
	}
	if (state.passing[seat] !== null) {
		throw new GameRuleError("cardsAlreadyPassed");
	}
	const count = rules.passing?.count ?? 0;
	if (cards.length !== count || new Set(cards).size !== count) {
		throw new GameRuleError("cardsPassCount", { count });
	}
	for (const card of cards) {
		if (!removeCard(state.hands[seat], card)) {
			throw new GameRuleError("cardsNotInHand");
		}
	}
	state.passing[seat] = [...cards];
	pushEvent(state, { type: "passReady", seat });
	if (state.passing.some((chosen) => chosen === null)) {
		return;
	}
	const seats = state.hands.length;
	const shift = passShift(state.passDirection, seats);
	state.passing.forEach((chosen, from) => {
		const to = (from + shift) % seats;
		state.hands[to].push(...(chosen ?? []));
		state.received[to] = chosen ?? [];
	});
	state.passing = state.hands.map(() => null);
	state.phase = "playing";
	state.turn = opener(rules, state);
	pushEvent(state, { type: "exchange", shift, count });
}

function playCard(
	rules: TricksRules,
	state: TricksState,
	seat: number,
	card: CardId,
) {
	if (state.phase === "passing") {
		throw new GameRuleError("cardsPassFirst");
	}
	if (state.phase === "knocking") {
		throw new GameRuleError("cardsKnockPending");
	}
	if (state.phase !== "playing") {
		throw new GameRuleError("noActiveRound");
	}
	if (state.turn !== seat) {
		throw new GameRuleError("notYourTurn");
	}
	const why = refusal(rules, state, seat, card);
	if (why) {
		throw new GameRuleError(why);
	}
	removeCard(state.hands[seat], card);
	state.trick.push({ seat, card });
	pushEvent(state, { type: "play", seat, card });
	const breaking = rules.breaking;
	if (
		breaking &&
		!state.broken &&
		(suitOf(card) === breaking.suit ||
			breaking.alsoBrokenBy.includes(cardFace(card)))
	) {
		state.broken = true;
		pushEvent(state, { type: "broken", suit: breaking.suit });
	}
	if (!trickComplete(state)) {
		state.turn = nextInDeal(state, seat);
		return;
	}
	takeTrick(rules, state);
}

/** Every seat still in the deal has played to the trick; folded seats' cards stay in it. */
function trickComplete(state: TricksState) {
	const plays = state.trick.filter((play) => inDeal(state, play.seat));
	return plays.length > 0 && plays.length === seatsInDeal(state).length;
}

function takeTrick(rules: TricksRules, state: TricksState) {
	const winner = trickWinner(rules, state.trick, state.trump, (seat) =>
		inDeal(state, seat),
	);
	const cards = state.trick.map((play) => play.card);
	state.taken[winner].push(...cards);
	state.tricksTaken[winner] += 1;
	state.lastTrick = { plays: state.trick, winner };
	state.trick = [];
	state.turn = winner;
	pushEvent(state, {
		type: "trickWon",
		seat: winner,
		points: pointsOf(rules, cards),
	});
	if (state.hands.every((hand) => hand.length === 0)) {
		scoreDeal(rules, state);
	}
}

function muck(state: TricksState, cards: readonly CardId[]) {
	state.mucked = [...(state.mucked ?? []), ...cards];
}

/** Why `seat` can't knock now, or null when it can. */
function knockRefusal(rules: TricksRules, state: TricksState, seat: number) {
	if (!rules.knocking) {
		return "cardsWrongAction";
	}
	if (state.phase === "knocking") {
		return "cardsKnockPending";
	}
	if (state.phase !== "playing") {
		return "noActiveRound";
	}
	if (isOut(state, seat)) {
		return "cardsOutOfMatch";
	}
	if (!inDeal(state, seat)) {
		return "cardsFolded";
	}
	if (state.lastKnocker === seat) {
		return "cardsKnockedLast";
	}
	// Losing more than this would put the seat past the limit for nothing.
	const total = totalsOf(state.scores, state.hands.length)[seat];
	if (
		rules.matchEnd === "lastStanding" &&
		total + (state.stake ?? 1) >= rules.target
	) {
		return "cardsKnockAtLimit";
	}
	return null;
}

function knock(rules: TricksRules, state: TricksState, seat: number) {
	const why = knockRefusal(rules, state, seat);
	if (why) {
		throw new GameRuleError(why);
	}
	state.stake = (state.stake ?? 1) + 1;
	state.lastKnocker = seat;
	state.phase = "knocking";
	// Answers go round from the knocker's left.
	const asked: number[] = [];
	for (let next = nextInDeal(state, seat); next !== seat; ) {
		asked.push(next);
		next = nextInDeal(state, next);
	}
	state.knock = { by: seat, asked, answers: state.hands.map(() => null) };
	pushEvent(state, { type: "raise", seat, stake: state.stake });
}

function answerKnock(
	rules: TricksRules,
	state: TricksState,
	seat: number,
	stay: boolean,
) {
	if (!rules.knocking) {
		throw new GameRuleError("cardsWrongAction");
	}
	const pending = state.knock;
	if (state.phase !== "knocking" || !pending) {
		throw new GameRuleError("cardsNothingToAnswer");
	}
	if (pending.by === seat) {
		throw new GameRuleError("cardsOwnKnock");
	}
	if (!pending.asked.includes(seat)) {
		throw new GameRuleError("cardsNotAsked");
	}
	if (pending.answers[seat] !== null) {
		throw new GameRuleError("cardsAlreadyAnswered");
	}
	pending.answers[seat] = stay ? "stay" : "fold";
	if (stay) {
		pushEvent(state, { type: "stay", seat });
	} else {
		// Folding costs the stake as it was before this raise.
		const cost = (state.stake ?? 1) - 1;
		const folded = state.folded ?? state.hands.map(() => false);
		const paid = state.paid ?? state.hands.map(() => 0);
		folded[seat] = true;
		paid[seat] += cost;
		state.folded = folded;
		state.paid = paid;
		muck(state, state.hands[seat]);
		state.hands[seat] = [];
		pushEvent(state, { type: "fold", seat, cost });
	}
	if (pending.asked.some((asked) => pending.answers[asked] === null)) {
		return;
	}
	resumeAfterKnock(rules, state);
}

/** Everyone has answered: play on without the folded seats, or end the deal. */
function resumeAfterKnock(rules: TricksRules, state: TricksState) {
	state.knock = null;
	state.phase = "playing";
	const left = seatsInDeal(state);
	if (left.length === 1) {
		muck(
			state,
			state.trick.map((play) => play.card),
		);
		state.trick = [];
		scoreDeal(rules, state);
		return;
	}
	// A folded seat's card stays in the trick: it still sets the suit, but can't win.
	if (!inDeal(state, state.turn)) {
		state.turn = nextInDeal(state, state.turn);
	}
	if (trickComplete(state)) {
		takeTrick(rules, state);
	}
}

/** Why `seat` can't swap its hand now, or null when it can. */
function swapRefusal(rules: TricksRules, state: TricksState, seat: number) {
	const sets = rules.swapHands ?? [];
	if (sets.length === 0) {
		return "cardsWrongAction";
	}
	if (
		(state.phase !== "playing" && state.phase !== "knocking") ||
		state.trick.length > 0 ||
		tricksPlayed(state) > 0
	) {
		return "cardsSwapTooLate";
	}
	if (isOut(state, seat)) {
		return "cardsOutOfMatch";
	}
	if (!inDeal(state, seat)) {
		return "cardsFolded";
	}
	const hand = state.hands[seat];
	const fits = sets.some((ranks) =>
		hand.every((card) => ranks.includes(parseCard(card).rank as Rank)),
	);
	if (hand.length === 0 || !fits) {
		return "cardsHandNotSwappable";
	}
	if ((state.stock?.length ?? 0) < hand.length) {
		return "cardsStockEmpty";
	}
	return null;
}

function swapHand(rules: TricksRules, state: TricksState, seat: number) {
	const why = swapRefusal(rules, state, seat);
	if (why) {
		throw new GameRuleError(why);
	}
	const stock = state.stock ?? [];
	// The old hand is set aside face down; it does not come back this deal.
	muck(state, state.hands[seat]);
	state.hands[seat] = stock.splice(stock.length - state.hands[seat].length);
	pushEvent(state, { type: "swapHand", seat });
}

export function applyTricks(
	rules: TricksRules,
	previous: TricksState,
	seat: number,
	action: TricksAction,
	random: Rng,
): TricksState {
	const state = clone(previous);
	switch (action.type) {
		case "passCards":
			passCards(rules, state, seat, action.cards);
			return state;
		case "play":
			playCard(rules, state, seat, action.card);
			return state;
		case "knock":
			knock(rules, state, seat);
			return state;
		case "stay":
		case "fold":
			answerKnock(rules, state, seat, action.type === "stay");
			return state;
		case "swapHand":
			swapHand(rules, state, seat);
			return state;
		case "nextRound":
			if (state.phase !== "roundOver") {
				throw new GameRuleError("currentGameNotFinished");
			}
			return dealTricks(
				rules,
				state.hands.length,
				random,
				nextLive(state, state.dealer),
				{
					round: state.round + 1,
					scores: state.scores,
					events: state.events,
					nextSeq: state.nextSeq,
					out: state.out,
				},
			);
	}
}

/** What `seat` may see: their own hand and passes, never anyone else's. */
export function viewTricks(
	rules: TricksRules,
	state: TricksState,
	seat: number | null,
): TricksView {
	return {
		family: "tricks",
		phase: state.phase,
		round: state.round,
		target: rules.target,
		turn: state.turn,
		handCounts: state.hands.map(
			(hand, index) => hand.length + (state.passing[index]?.length ?? 0),
		),
		hand: seat === null ? [] : state.hands[seat],
		legal: seat === null ? [] : legalTricksCards(rules, state, seat),
		passDirection: state.passDirection,
		passCount: state.passDirection === "keep" ? 0 : (rules.passing?.count ?? 0),
		passed: seat === null ? null : state.passing[seat],
		passReady: state.passing.map((chosen) => chosen !== null),
		received: seat === null ? [] : state.received[seat],
		trick: state.trick,
		lastTrick: state.lastTrick,
		trump: state.trump,
		broken: state.broken,
		roundPoints: state.taken.map((cards) => pointsOf(rules, cards)),
		tricksTaken: state.tricksTaken,
		scores: state.scores,
		totals: totalsOf(state.scores, state.hands.length),
		moon: state.moon,
		winners: state.winners,
		events: state.events,
		matchEnd: rules.matchEnd ?? "lowestAtTarget",
		stake: rules.knocking ? (state.stake ?? 1) : null,
		folded: state.hands.map((_, index) => state.folded?.[index] === true),
		out: state.hands.map((_, index) => isOut(state, index)),
		knock: state.knock ?? null,
		lastKnocker: state.lastKnocker ?? null,
		canKnock: seat !== null && knockRefusal(rules, state, seat) === null,
		canSwap: seat !== null && swapRefusal(rules, state, seat) === null,
		dealWinner: state.dealWinner ?? null,
	};
}

// The computer player, which also plays autopiloted seats.

/** How much a card hurts to keep: points first, then height. */
function risk(rules: TricksRules, card: CardId) {
	const value = cardValue(rules, card);
	return (
		(value > 0 ? 20 + value : value < 0 ? -20 : 0) + rankIndex(rules, card)
	);
}

/** The riskiest cards go: points and high cards, never a card worth having. */
export function choosePass(rules: TricksRules, hand: readonly CardId[]) {
	const count = rules.passing?.count ?? 0;
	return [...hand]
		.sort((a, b) => risk(rules, b) - risk(rules, a))
		.slice(0, count);
}

/** A sensible card: lead low, duck under the winner, dump points when void. */
export function chooseTricksCard(
	rules: TricksRules,
	state: TricksState,
	seat: number,
) {
	const legal = legalTricksCards(rules, state, seat);
	if (rules.scoring === "lastTrick") {
		// Only the last trick counts: spend the weakest card, keep the best for it.
		return [...legal].sort(
			(a, b) => rankIndex(rules, a) - rankIndex(rules, b),
		)[0];
	}
	const byRisk = (a: CardId, b: CardId) => risk(rules, a) - risk(rules, b);
	// A card worth taking (the jack of diamonds) stays home rather than be given away.
	const spare = (cards: CardId[]) => {
		const giveable = cards.filter((card) => cardValue(rules, card) >= 0);
		return giveable.length > 0 ? giveable : cards;
	};
	if (state.trick.length === 0) {
		return spare(legal).sort(byRisk)[0];
	}
	const led = suitOf(state.trick[0].card);
	const following = legal.filter((card) => suitOf(card) === led);
	if (following.length === 0) {
		return [...legal].sort(byRisk).at(-1) as CardId;
	}
	const winning = state.trick.find(
		(play) => play.seat === trickWinner(rules, state.trick, state.trump),
	) as TrickPlay;
	const highest = (cards: CardId[]) =>
		[...cards].sort((a, b) => rankIndex(rules, a) - rankIndex(rules, b)).at(-1);
	const ducks = following.filter(
		(card) =>
			suitOf(winning.card) !== led ||
			rankIndex(rules, card) < rankIndex(rules, winning.card),
	);
	if (ducks.length > 0) {
		return highest(spare(ducks)) as CardId;
	}
	// This seat takes the trick anyway. Last to play, it may as well go high,
	// but not with a card that scores against it.
	const last = state.trick.length === state.hands.length - 1;
	if (last) {
		const safe = following.filter((card) => cardValue(rules, card) <= 0);
		return highest(safe.length > 0 ? safe : following) as CardId;
	}
	return spare(following).sort(byRisk)[0];
}

/** Cards nobody can see in a hand any more: taken in tricks or on the table. */
function playedCards(state: TricksState) {
	return new Set([
		...state.taken.flat(),
		...state.trick.map((play) => play.card),
	]);
}

/**
 * The seat's cards that can still take the trick that decides: any card in hand
 * before the last trick; on it, the seat's own play if it is winning, or a card
 * in hand that would beat the winner.
 */
function liveCards(rules: TricksRules, state: TricksState, seat: number) {
	const hand = state.hands[seat];
	const takes = (plays: readonly TrickPlay[]) =>
		trickWinner(rules, plays, state.trump, (other) => inDeal(state, other)) ===
		seat;
	const played = state.trick.find((play) => play.seat === seat);
	if (hand.length + (played ? 1 : 0) !== 1) {
		return hand;
	}
	if (played) {
		return takes(state.trick) ? [played.card] : [];
	}
	return hand.filter(
		(card) =>
			state.trick.length === 0 || takes([...state.trick, { seat, card }]),
	);
}

/** Live cards that no unseen card of their suit can beat. */
function topCards(rules: TricksRules, state: TricksState, seat: number) {
	const known = new Set(
		[...playedCards(state), ...state.hands[seat]].map((card) => cardFace(card)),
	);
	return liveCards(rules, state, seat).filter((card) =>
		rules.ranks
			.slice(rankIndex(rules, card) + 1)
			.every((rank) => known.has(`${suitOf(card)}${rank}`)),
	);
}

/** The strongest card in a hand by rank, -1 for an empty hand. */
function bestRank(rules: TricksRules, hand: readonly CardId[]) {
	return Math.max(-1, ...hand.map((card) => rankIndex(rules, card)));
}

/** How often the computer knocks on a hand it doesn't trust, so knocks aren't a tell. */
const BLUFF_CHANCE = 0.08;
/** From this rank index up (Toepen: the 9 and 10) a card is worth staying in for. */
const STRONG_FROM = 6;

/** Knock with cards that should take the last trick, and now and then without. */
export function wantsKnock(
	rules: TricksRules,
	state: TricksState,
	seat: number,
	random: Rng,
) {
	if (knockRefusal(rules, state, seat) !== null) {
		return false;
	}
	const left = state.hands[seat].length;
	const tops = topCards(rules, state, seat).length;
	if (tops >= 2 || (tops === 1 && left <= 2)) {
		return true;
	}
	return left <= 2 &&
		bestRank(rules, liveCards(rules, state, seat)) >= STRONG_FROM - 1
		? random() < BLUFF_CHANCE
		: false;
}

/** Stay in with a card that could take the last trick, or when folding costs as much. */
export function wantsToStay(
	rules: TricksRules,
	state: TricksState,
	seat: number,
) {
	const stake = state.stake ?? 1;
	const total = totalsOf(state.scores, state.hands.length)[seat];
	const elimination = rules.matchEnd === "lastStanding";
	// Out either way: losing more changes nothing.
	if (elimination && total + stake - 1 >= rules.target) {
		return true;
	}
	if (topCards(rules, state, seat).length > 0) {
		return true;
	}
	const best = bestRank(rules, liveCards(rules, state, seat));
	// Losing the raised stake would end the match for this seat: only stay when strong.
	if (elimination && total + stake >= rules.target) {
		return best >= STRONG_FROM + 1;
	}
	return best >= STRONG_FROM;
}

/** Swap a hand of only weak cards; a strong one stays. */
function wantsSwap(rules: TricksRules, state: TricksState, seat: number) {
	return (
		swapRefusal(rules, state, seat) === null &&
		bestRank(rules, state.hands[seat]) < rules.ranks.length / 2
	);
}

export function botTricksMove(
	rules: TricksRules,
	state: TricksState,
	bots: readonly number[],
	random: Rng = Math.random,
): BotMove<TricksAction> | null {
	if (state.phase === "roundOver") {
		// Humans deal the next round, unless every one still in is on autopilot.
		const live = state.hands.flatMap((_, seat) =>
			isOut(state, seat) ? [] : [seat],
		);
		return live.every((seat) => bots.includes(seat))
			? { seat: bots[0], action: { type: "nextRound" }, pace: "reaction" }
			: null;
	}
	if (state.phase === "knocking") {
		const pending = state.knock;
		const seat = bots.find(
			(bot) => pending?.asked.includes(bot) && pending.answers[bot] === null,
		);
		return seat === undefined
			? null
			: {
					seat,
					action: {
						type: wantsToStay(rules, state, seat) ? "stay" : "fold",
					},
					pace: "turn",
				};
	}
	if (state.phase === "passing") {
		const seat = bots.find((bot) => state.passing[bot] === null);
		return seat === undefined
			? null
			: {
					seat,
					action: {
						type: "passCards",
						cards: choosePass(rules, state.hands[seat]),
					},
					pace: "turn",
				};
	}
	if (state.phase !== "playing") {
		return null;
	}
	const swapper = bots.find((bot) => wantsSwap(rules, state, bot));
	if (swapper !== undefined) {
		return { seat: swapper, action: { type: "swapHand" }, pace: "turn" };
	}
	if (!bots.includes(state.turn)) {
		return null;
	}
	if (wantsKnock(rules, state, state.turn, random)) {
		return { seat: state.turn, action: { type: "knock" }, pace: "turn" };
	}
	// Before the first card, people may still swap their hands: give them time.
	const opening =
		(rules.swapHands?.length ?? 0) > 0 &&
		state.trick.length === 0 &&
		tricksPlayed(state) === 0;
	return {
		seat: state.turn,
		action: { type: "play", card: chooseTricksCard(rules, state, state.turn) },
		pace: opening ? "reaction" : "turn",
	};
}
