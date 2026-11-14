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
	/** The match ends after the deal in which someone reaches this; lowest total wins. */
	target: number;
};

type TrickPlay = { seat: number; card: CardId };

export type TricksState = {
	family: "tricks";
	hands: CardId[][];
	dealer: number;
	/** Deals played so far, counting this one. */
	round: number;
	phase: "passing" | "playing" | "roundOver" | "finished";
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
};

export type TricksAction =
	| { type: "passCards"; cards: CardId[] }
	| { type: "play"; card: CardId }
	| { type: "nextRound" };

/** Keyed by action type, so a new action cannot be left out. */
export const TRICKS_ACTIONS: Record<TricksAction["type"], true> = {
	passCards: true,
	play: true,
	nextRound: true,
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

/** Who takes the trick: the highest trump, else the highest card of the suit led. */
export function trickWinner(
	rules: Pick<TricksRules, "ranks">,
	plays: readonly TrickPlay[],
	trump: Suit | null,
) {
	let best = plays[0];
	for (const play of plays.slice(1)) {
		const suit = suitOf(play.card);
		// The best card so far is of the suit led or a trump: off-suit cards never beat it.
		const beats =
			suit === suitOf(best.card)
				? rankIndex(rules, play.card) > rankIndex(rules, best.card)
				: suit === trump;
		if (beats) {
			best = play;
		}
	}
	return best.seat;
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
	return (state.dealer + 1) % state.hands.length;
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
	carried?: Pick<TricksState, "round" | "scores" | "events" | "nextSeq">,
): TricksState {
	const stock = shuffle(tricksDeck(rules, seats), random);
	const round = carried?.round ?? 1;
	const handSize = SCHEDULES[rules.schedule](stock.length, seats, round);
	if (!Number.isInteger(handSize) || handSize * seats > stock.length) {
		throw new Error(
			`the deck does not deal ${handSize} cards to ${seats} seats`,
		);
	}
	const hands = deal(stock, seats, handSize);
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
		trump: TRUMPS[rules.trumpChoice](stock),
		broken: false,
		taken: hands.map(() => []),
		tricksTaken: hands.map(() => 0),
		scores: carried?.scores ?? [],
		moon: null,
		winners: [],
		events: carried?.events ?? [],
		nextSeq: carried?.nextSeq ?? 0,
	};
	// While cards are being passed nobody has the turn, and naming the 2 of
	// clubs' holder early would say who was dealt it: the exchange picks the opener.
	state.turn =
		state.phase === "playing" ? opener(rules, state) : (dealer + 1) % seats;
	pushEvent(state, { type: "deal", round });
	return state;
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

type DealScore = { points: number[]; moon: number | null };

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
 * Scorers by name. A new game whose deals score differently (bids met, the
 * last trick, team points with roem) adds one here and names it in its rules.
 */
const SCORERS = {
	penaltyCards: scorePenaltyCards,
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
	const { points, moon } = SCORERS[rules.scoring](rules, state);
	state.scores.push(points);
	state.moon = moon;
	if (moon !== null) {
		pushEvent(state, { type: "moon", seat: moon });
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
	const seats = state.hands.length;
	if (state.trick.length < seats) {
		state.turn = (seat + 1) % seats;
		return;
	}
	const winner = trickWinner(rules, state.trick, state.trump);
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
		case "nextRound":
			if (state.phase !== "roundOver") {
				throw new GameRuleError("currentGameNotFinished");
			}
			return dealTricks(
				rules,
				state.hands.length,
				random,
				(state.dealer + 1) % state.hands.length,
				{
					round: state.round + 1,
					scores: state.scores,
					events: state.events,
					nextSeq: state.nextSeq,
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

export function botTricksMove(
	rules: TricksRules,
	state: TricksState,
	bots: readonly number[],
): BotMove<TricksAction> | null {
	if (state.phase === "roundOver") {
		// Humans deal the next round, unless all of them are on autopilot.
		return bots.length === state.hands.length
			? { seat: bots[0], action: { type: "nextRound" }, pace: "reaction" }
			: null;
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
	if (state.phase !== "playing" || !bots.includes(state.turn)) {
		return null;
	}
	return {
		seat: state.turn,
		action: { type: "play", card: chooseTricksCard(rules, state, state.turn) },
		pace: "turn",
	};
}
