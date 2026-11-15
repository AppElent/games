/**
 * Trick-taking family: everyone plays one card to a trick, the highest card of
 * the suit led (or the highest trump) takes it, and a deal is scored from the
 * tricks taken. What differs between games in the family is `TricksRules` data
 * plus a scorer named by `rules.scoring`; see the card games contract for how
 * Boerenbridge, Toepen and Klaverjassen are meant to fit.
 */
import { GameRuleError } from "../errors";
import { type Rng, shuffle } from "../random";
import type { BotMove } from "../table-engine";
import {
	buildDeck,
	type CardId,
	cardFace,
	clone,
	deal,
	parseCard,
	type Rank,
	removeCard,
	SUITS,
	type Suit,
} from "./deck";
import { type CardEvent, pushEvent } from "./events";
import { type RoemKind, roemOf } from "./roem";

/** Where passed cards go: the next seat in play, the one before, or opposite. */
export const PASS_DIRECTIONS = ["left", "right", "across", "keep"] as const;
export type PassDirection = (typeof PASS_DIRECTIONS)[number];

/**
 * A bidding phase before play: each seat says how many tricks it will take,
 * starting left of the dealer, and a deal scores bids met and missed.
 */
export type TricksBidding = {
	/** The dealer may bid so the bids add up to the tricks in the deal. */
	dealerMayMatch: boolean;
	/** A bid met scores `exact` plus `perTrick` for every trick bid. */
	exact: number;
	perTrick: number;
	/** A bid missed loses this for every trick it is off by. */
	perTrickOff: number;
};

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
	/**
	 * The match ends after the deal in which someone reaches this. Null: it ends
	 * when the schedule runs out of deals.
	 */
	target: number | null;
	/** Bids before play; absent or null for none. */
	bidding?: TricksBidding | null;
	/** The highest total wins instead of the lowest. */
	highWins?: boolean;
	/**
	 * The match also ends after this many deals, for a schedule that never
	 * runs out (a full deck every deal).
	 */
	deals?: number;
	/** The trump suit's order, low to high, when it differs from `ranks`. */
	trumpRanks?: readonly Rank[];
	/**
	 * Seats call this deal's trump in turn before play: each accepts the suit
	 * `trumpChoice` put up or passes. When it put up none, or everyone passed,
	 * the seat left of the dealer must name one. Whoever calls it must win the deal.
	 */
	callTrump?: boolean;
	/**
	 * A seat that can't follow must trump, above any trump already played, and
	 * may only play a lower trump when it holds nothing else; when trumps are
	 * led it must go higher if it can. "unlessPartnerWins" lets a void seat
	 * skip trumping while its partner takes the trick; going higher on a trump
	 * lead and the ban on a lower trump still hold. Unset: a void seat plays
	 * anything.
	 */
	mustTrump?: "always" | "unlessPartnerWins";
	/** Points per rank, below `cardPoints` and above `suitPoints`. */
	rankPoints?: Readonly<Partial<Record<Rank, number>>>;
	/** Points per rank of the trump suit, above `rankPoints`. */
	trumpPoints?: Readonly<Partial<Record<Rank, number>>>;
	/** Extra points for whoever takes the last trick. */
	lastTrickBonus?: number;
	/** Each trick's roem (runs, the trump king and queen, four of a kind) goes to its taker. */
	roem?: boolean;
	/** Extra roem for a team that takes every trick of a deal. */
	pitBonus?: number;
};

type TrickPlay = { seat: number; card: CardId };

/** A trick's roem, as its kinds and their total. */
type Roem = { points: number; kinds: RoemKind[] };

/** How a deal went for each team, under `pointsAndRoem`. Indexed by team. */
export type TeamDeal = {
	/** Card points taken, the last-trick bonus included. */
	points: number[];
	/** Roem taken, with any pit bonus. */
	roem: number[];
	/** The team that called trump, if anyone did. */
	maker: number | null;
	/** The calling team didn't take more than half, so the other team scores it all. */
	nat: boolean;
	/** The team that took every trick, if one did. */
	pit: number | null;
	/** What each team scores for the deal. */
	scores: number[];
};

export type TricksState = {
	family: "tricks";
	hands: CardId[][];
	dealer: number;
	/** Deals played so far, counting this one. */
	round: number;
	phase: "trump" | "passing" | "bidding" | "playing" | "roundOver" | "finished";
	/** This deal's direction; "keep" when nobody passes. */
	passDirection: PassDirection;
	/** Cards each seat set aside to pass, until everyone has. Private. */
	passing: Array<CardId[] | null>;
	/** Cards each seat was passed this deal. Private to that seat. */
	received: CardId[][];
	turn: number;
	trick: TrickPlay[];
	lastTrick: { plays: TrickPlay[]; winner: number; roem?: Roem } | null;
	/** Set per deal by `trumpChoice` or the trump call; Hearts has none. */
	trump: Suit | null;
	/** The card turned up to show trump, face up for all; null when none was. */
	turnedUp?: CardId | null;
	/**
	 * Each seat's bid this deal, null until made. Absent for games without
	 * bidding (and for tables dealt before bidding existed).
	 */
	bids?: Array<number | null>;
	/**
	 * While seats call trump (`callTrump`): the suit put to them, or null once
	 * the seat left of the dealer must name one. Absent in tables dealt before
	 * trump calls existed, as are the other optional fields below.
	 */
	offered?: Suit | null;
	/** How many seats have passed on the trump this deal. */
	trumpPasses?: number;
	/** Who called trump; their team must win the deal. */
	maker?: number | null;
	/** Roem each seat took with its tricks this deal. */
	roem?: number[];
	/** How the last scored deal went, for a team game with roem. */
	lastDeal?: TeamDeal | null;
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
	| { type: "bid"; count: number }
	| { type: "play"; card: CardId }
	| { type: "nextRound" }
	| { type: "passTrump" }
	| { type: "chooseTrump"; suit: Suit };

/** Keyed by action type, so a new action cannot be left out. */
export const TRICKS_ACTIONS: Record<TricksAction["type"], true> = {
	passCards: true,
	bid: true,
	play: true,
	nextRound: true,
	passTrump: true,
	chooseTrump: true,
};

export type TricksView = {
	family: "tricks";
	phase: TricksState["phase"];
	round: number;
	target: number | null;
	/** Deals in the whole match, or null when it ends on `target`. */
	deals: number | null;
	/** Cards each seat was dealt this deal, so also the tricks in it. */
	handSize: number;
	turn: number;
	/** Each seat's team; partners share a total. A game without teams gives every seat its own. */
	teams: number[];
	/** See `TricksState.offered`; null outside the trump call. */
	offered: Suit | null;
	/** Which seats have passed on the trump this deal. */
	trumpPassed: boolean[];
	maker: number | null;
	/** Roem each seat has taken this deal. */
	roem: number[];
	lastDeal: TeamDeal | null;
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
	turnedUp: CardId | null;
	/** Bids so far this deal, public once made; null for a game without bidding. */
	bids: Array<number | null> | null;
	/** Bids this seat may make now; empty unless it is their turn to bid. */
	legalBids: number[];
	/** The bid the dealer may not make, as it would add up; null when none. */
	blockedBid: number | null;
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

/**
 * A card's position in the game's rank order, low to high; a trump's in
 * `trumpRanks` when the game has one.
 */
export function rankIndex(
	rules: Pick<TricksRules, "ranks" | "trumpRanks">,
	card: CardId,
	trump: Suit | null = null,
) {
	const rank = parseCard(card).rank as Rank;
	const order =
		trump !== null && suitOf(card) === trump && rules.trumpRanks
			? rules.trumpRanks
			: rules.ranks;
	return order.indexOf(rank);
}

type PointRules = Pick<
	TricksRules,
	"suitPoints" | "cardPoints" | "rankPoints" | "trumpPoints"
>;

/** What one card scores: its face, else its rank as trump, its rank, or its suit. */
export function cardValue(
	rules: PointRules,
	card: CardId,
	trump: Suit | null = null,
) {
	const suit = suitOf(card);
	const rank = parseCard(card).rank as Rank;
	return (
		rules.cardPoints[cardFace(card)] ??
		(suit === trump ? rules.trumpPoints?.[rank] : undefined) ??
		rules.rankPoints?.[rank] ??
		rules.suitPoints[suit] ??
		0
	);
}

function pointsOf(
	rules: PointRules,
	cards: readonly CardId[],
	trump: Suit | null = null,
) {
	return cards.reduce((sum, card) => sum + cardValue(rules, card, trump), 0);
}

/** Each seat's team number. */
export function teamsOf(rules: Pick<TricksRules, "seating">, seats: number) {
	return SEATINGS[rules.seating](seats);
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
	rules: Pick<TricksRules, "ranks" | "trumpRanks">,
	plays: readonly TrickPlay[],
	trump: Suit | null,
) {
	let best = plays[0];
	for (const play of plays.slice(1)) {
		const suit = suitOf(play.card);
		// The best card so far is of the suit led or a trump: off-suit cards never beat it.
		const beats =
			suit === suitOf(best.card)
				? rankIndex(rules, play.card, trump) >
					rankIndex(rules, best.card, trump)
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

/**
 * The `mustTrump` duties for a card that follows the rules of suit: trump when
 * void, go above the highest trump in the trick, never play a lower trump
 * while holding anything else. Under "unlessPartnerWins" a void seat need not
 * trump while its partner takes the trick; going higher when trumps are led
 * and the ban on a lower trump still hold.
 */
function trumpRefusal(
	rules: TricksRules,
	state: TricksState,
	seat: number,
	card: CardId,
	trump: Suit,
) {
	const hand = state.hands[seat];
	const led = suitOf(state.trick[0].card);
	const following = suitOf(card) === led;
	if (following && led !== trump) {
		return null;
	}
	const teams = teamsOf(rules, state.hands.length);
	const winner = trickWinner(rules, state.trick, trump);
	const partnerWins =
		rules.mustTrump === "unlessPartnerWins" && teams[winner] === teams[seat];
	const top = Math.max(
		-1,
		...state.trick
			.filter((play) => suitOf(play.card) === trump)
			.map((play) => rankIndex(rules, play.card, trump)),
	);
	const over = (held: CardId) =>
		suitOf(held) === trump && rankIndex(rules, held, trump) > top;
	const canOver = hand.some(over);
	if (following) {
		// Trumps were led: go higher if you can, whoever holds the trick.
		return canOver && !over(card) ? "cardsMustOvertrump" : null;
	}
	if (!partnerWins && canOver) {
		if (over(card)) {
			return null;
		}
		return top < 0 ? "cardsMustTrump" : "cardsMustOvertrump";
	}
	const under = suitOf(card) === trump && !over(card);
	return under && hand.some((held) => suitOf(held) !== trump || over(held))
		? "cardsNoUndertrump"
		: null;
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
		if (suit !== led && hand.some((held) => suitOf(held) === led)) {
			return "cardsMustFollow";
		}
		return rules.mustTrump && state.trump
			? trumpRefusal(rules, state, seat, card, state.trump)
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

/** The most cards each seat can be dealt from this deck. */
const mostCards = (deck: number, seats: number) => Math.floor(deck / seats);

/**
 * Hand sizes by name: the whole deck shared out, or a size that changes with
 * the round. Null means the schedule has no such round, so the match is over.
 */
const SCHEDULES = {
	fullDeck: (deck: number, seats: number, _round: number) => deck / seats,
	/** One card, up to as many as the deck allows, and back down to one. */
	upDown: (deck: number, seats: number, round: number) => {
		const most = mostCards(deck, seats);
		return round <= most ? round : round < most * 2 ? most * 2 - round : null;
	},
	up: (deck: number, seats: number, round: number) =>
		round <= mostCards(deck, seats) ? round : null,
	down: (deck: number, seats: number, round: number) => {
		const most = mostCards(deck, seats);
		return round <= most ? most + 1 - round : null;
	},
} satisfies Record<
	string,
	(deck: number, seats: number, round: number) => number | null
>;

/** A schedule that still deals after this many rounds is treated as endless. */
const ENDLESS = 500;

/** Cards per seat in `round`, or null when the schedule has no such round. */
export function handSizeFor(rules: TricksRules, seats: number, round: number) {
	return SCHEDULES[rules.schedule](
		tricksDeck(rules, seats).length,
		seats,
		round,
	);
}

/** How many deals the schedule has, or null when it never runs out. */
export function dealsInMatch(rules: TricksRules, seats: number) {
	const deck = tricksDeck(rules, seats).length;
	const sizeOf = SCHEDULES[rules.schedule];
	let round = 0;
	while (round < ENDLESS && sizeOf(deck, seats, round + 1) !== null) {
		round += 1;
	}
	return round === ENDLESS ? null : round;
}

type TrumpPick = { trump: Suit | null; turnedUp: CardId | null };

/**
 * Trump choosers by name, given the cards left over after the deal and the
 * deal's random source. With `callTrump` the suit is only put to the seats.
 */
const TRUMPS = {
	none: (_rest: readonly CardId[], _random: Rng): TrumpPick => ({
		trump: null,
		turnedUp: null,
	}),
	/** The top undealt card sets trump; when the deck dealt out exactly, there is none. */
	turnUp: (rest: readonly CardId[], _random: Rng): TrumpPick => {
		const top = rest[0];
		return top
			? { trump: suitOf(top), turnedUp: top }
			: { trump: null, turnedUp: null };
	},
	/** A suit drawn at random, as Klaverjassen puts one to the table. */
	random: (_rest: readonly CardId[], random: Rng): TrumpPick => ({
		trump: SUITS[Math.floor(random() * SUITS.length)],
		turnedUp: null,
	}),
} satisfies Record<string, (rest: readonly CardId[], random: Rng) => TrumpPick>;

/**
 * Teams by name: each seat's team number. Partners share a total, so a team
 * game (Klaverjassen) wins or loses together.
 */
const SEATINGS = {
	alone: (seats: number) => Array.from({ length: seats }, (_, seat) => seat),
	/** Two teams, partners sitting opposite: seats 0 and 2 against 1 and 3. */
	opposite: (seats: number) =>
		Array.from({ length: seats }, (_, seat) => seat % 2),
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
	if (
		handSize === null ||
		!Number.isInteger(handSize) ||
		handSize < 1 ||
		handSize * seats > stock.length
	) {
		throw new Error(
			`the deck does not deal ${handSize} cards to ${seats} seats`,
		);
	}
	const hands = deal(stock, seats, handSize);
	// `deal` took the hands off the stock: what remains was never dealt.
	const undealt = stock;
	const direction = passDirectionFor(rules, seats, round);
	const { trump, turnedUp } = TRUMPS[rules.trumpChoice](undealt, random);
	const calling = rules.callTrump === true;
	const state: TricksState = {
		family: "tricks",
		hands,
		dealer,
		round,
		phase: calling
			? "trump"
			: direction !== "keep"
				? "passing"
				: rules.bidding
					? "bidding"
					: "playing",
		passDirection: direction,
		passing: hands.map(() => null),
		received: hands.map(() => []),
		turn: 0,
		trick: [],
		lastTrick: null,
		trump: calling ? null : trump,
		turnedUp,
		...(rules.bidding ? { bids: hands.map(() => null) } : {}),
		offered: calling ? trump : null,
		trumpPasses: 0,
		maker: null,
		roem: hands.map(() => 0),
		lastDeal: null,
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
	// clubs' holder early would say who was dealt it: the exchange picks the
	// opener. A trump call and bidding start left of the dealer, so the dealer
	// goes last.
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

/**
 * A deal's points per seat. In a team game every seat scores its team's
 * points, so a team's total is any of its seats' totals.
 */
type DealScore = { points: number[]; moon: number | null; teams?: TeamDeal };

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

/** Bids: met exactly scores a bonus plus points per trick, missed loses per trick off. */
function scoreBids(rules: TricksRules, state: TricksState): DealScore {
	const bidding = rules.bidding;
	if (!bidding) {
		throw new Error("scoring bids needs rules.bidding");
	}
	return {
		points: state.tricksTaken.map((taken, seat) => {
			const bid = state.bids?.[seat] ?? 0;
			return taken === bid
				? bidding.exact + bidding.perTrick * bid
				: -bidding.perTrickOff * Math.abs(taken - bid);
		}),
		moon: null,
	};
}

/**
 * Team points plus roem (Klaverjassen): each team scores the card points and
 * roem it took, unless the team that called trump took no more than half of
 * everything. Then it goes "nat" and the other team scores it all. A team
 * that takes every trick adds `pitBonus`. Made for two teams.
 */
function scorePointsAndRoem(rules: TricksRules, state: TricksState): DealScore {
	const seats = state.hands.length;
	const teams = teamsOf(rules, seats);
	const count = Math.max(...teams) + 1;
	const points = Array.from({ length: count }, () => 0);
	const roem = Array.from({ length: count }, () => 0);
	const tricks = Array.from({ length: count }, () => 0);
	state.taken.forEach((cards, seat) => {
		points[teams[seat]] += pointsOf(rules, cards, state.trump);
		roem[teams[seat]] += state.roem?.[seat] ?? 0;
		tricks[teams[seat]] += state.tricksTaken[seat];
	});
	if (state.lastTrick) {
		points[teams[state.lastTrick.winner]] += rules.lastTrickBonus ?? 0;
	}
	const played = tricks.reduce((sum, taken) => sum + taken, 0);
	const pitTeam = tricks.indexOf(played);
	const pit = rules.pitBonus && pitTeam >= 0 ? pitTeam : null;
	if (pit !== null) {
		roem[pit] += rules.pitBonus ?? 0;
	}
	const maker =
		state.maker === null || state.maker === undefined
			? null
			: teams[state.maker];
	const own = points.map((value, team) => value + roem[team]);
	const all = own.reduce((sum, value) => sum + value, 0);
	const nat = maker !== null && own[maker] * 2 <= all;
	const scores = own.map((value, team) =>
		maker === null || !nat ? value : team === maker ? 0 : value + own[maker],
	);
	return {
		points: teams.map((team) => scores[team]),
		moon: null,
		teams: { points, roem, maker, nat, pit, scores },
	};
}

/**
 * Scorers by name. A new game whose deals score differently (the last trick
 * only) adds one here and names it in its rules.
 */
const SCORERS = {
	penaltyCards: scorePenaltyCards,
	bids: scoreBids,
	pointsAndRoem: scorePointsAndRoem,
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
	const { points, moon, teams } = SCORERS[rules.scoring](rules, state);
	state.scores.push(points);
	state.moon = moon;
	state.lastDeal = teams ?? null;
	if (moon !== null) {
		pushEvent(state, { type: "moon", seat: moon });
	}
	const seatsOf = (team: number) =>
		teamsOf(rules, state.hands.length).flatMap((own, seat) =>
			own === team ? [seat] : [],
		);
	if (teams?.nat && teams.maker !== null) {
		pushEvent(state, { type: "nat", seats: seatsOf(teams.maker) });
	}
	if (teams && teams.pit !== null) {
		pushEvent(state, { type: "pit", seats: seatsOf(teams.pit) });
	}
	// Partners score the same points, so a seat's total is its team's: the
	// match ends and is won by team.
	const seats = state.hands.length;
	const totals = totalsOf(state.scores, seats);
	const reached = rules.target !== null && Math.max(...totals) >= rules.target;
	const lastDeal =
		(rules.deals !== undefined && state.round >= rules.deals) ||
		handSizeFor(rules, seats, state.round + 1) === null;
	if (!reached && !lastDeal) {
		state.phase = "roundOver";
		return;
	}
	const best = rules.highWins ? Math.max(...totals) : Math.min(...totals);
	state.phase = "finished";
	state.winners = totals.flatMap((total, seat) =>
		total === best ? [seat] : [],
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
	state.phase = rules.bidding ? "bidding" : "playing";
	state.turn = rules.bidding
		? (state.dealer + 1) % seats
		: opener(rules, state);
	pushEvent(state, { type: "exchange", shift, count });
}

/** The seat whose turn it is to call trump, checked before any trump action. */
function requireTrumpTurn(state: TricksState, seat: number) {
	if (state.phase !== "trump") {
		throw new GameRuleError("cardsNotCallingTrump");
	}
	if (state.turn !== seat) {
		throw new GameRuleError("notYourTurn");
	}
}

function passTrump(state: TricksState, seat: number) {
	requireTrumpTurn(state, seat);
	if (!state.offered) {
		throw new GameRuleError("cardsMustChooseTrump");
	}
	const seats = state.hands.length;
	state.trumpPasses = (state.trumpPasses ?? 0) + 1;
	pushEvent(state, { type: "trumpPass", seat });
	// The dealer passes last, so the turn comes back to the seat on their left,
	// which must now name a trump.
	state.turn = (seat + 1) % seats;
	if (state.trumpPasses >= seats) {
		state.offered = null;
	}
}

function chooseTrump(
	rules: TricksRules,
	state: TricksState,
	seat: number,
	suit: Suit,
) {
	requireTrumpTurn(state, seat);
	if (!SUITS.includes(suit) || (state.offered && suit !== state.offered)) {
		throw new GameRuleError("cardsTrumpNotOffered");
	}
	state.trump = suit;
	state.offered = null;
	state.maker = seat;
	pushEvent(state, { type: "trump", seat, suit });
	if (state.passDirection !== "keep") {
		state.phase = "passing";
	} else if (rules.bidding) {
		state.phase = "bidding";
		state.turn = (state.dealer + 1) % state.hands.length;
	} else {
		state.phase = "playing";
		state.turn = opener(rules, state);
	}
}

/**
 * The bid the dealer may not make because the bids would add up to the tricks
 * in the deal, so someone must miss. Null when the rule is off, when it isn't
 * the dealer's turn to bid, or when that total is out of reach.
 */
export function blockedBid(rules: TricksRules, state: TricksState) {
	const bids = state.bids;
	if (
		!rules.bidding ||
		rules.bidding.dealerMayMatch ||
		!bids ||
		state.phase !== "bidding" ||
		state.turn !== state.dealer
	) {
		return null;
	}
	const others = bids.reduce<number>((sum, bid) => sum + (bid ?? 0), 0);
	const blocked = state.hands[state.dealer].length - others;
	return blocked >= 0 ? blocked : null;
}

/** Every bid `seat` may make now, low to high. */
export function legalBids(
	rules: TricksRules,
	state: TricksState,
	seat: number,
) {
	if (state.phase !== "bidding" || state.turn !== seat) {
		return [];
	}
	const blocked = blockedBid(rules, state);
	return Array.from(
		{ length: state.hands[seat].length + 1 },
		(_, count) => count,
	).filter((count) => count !== blocked);
}

function placeBid(
	rules: TricksRules,
	state: TricksState,
	seat: number,
	count: number,
) {
	if (state.phase !== "bidding" || !state.bids) {
		throw new GameRuleError("cardsNotBidding");
	}
	if (state.turn !== seat) {
		throw new GameRuleError("notYourTurn");
	}
	const most = state.hands[seat].length;
	if (!Number.isInteger(count) || count < 0 || count > most) {
		throw new GameRuleError("cardsBidRange", { max: most });
	}
	if (count === blockedBid(rules, state)) {
		throw new GameRuleError("cardsDealerBid", { count });
	}
	state.bids[seat] = count;
	pushEvent(state, { type: "bid", seat, count });
	if (seat === state.dealer) {
		state.phase = "playing";
		state.turn = opener(rules, state);
		return;
	}
	state.turn = (seat + 1) % state.hands.length;
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
	if (state.phase === "trump") {
		throw new GameRuleError("cardsCallTrumpFirst");
	}
	if (state.phase === "bidding") {
		throw new GameRuleError("cardsBidFirst");
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
		points: pointsOf(rules, cards, state.trump),
	});
	const roem = rules.roem ? roemOf(cards, state.trump) : null;
	if (roem && roem.points > 0) {
		state.roem ??= state.hands.map(() => 0);
		state.roem[winner] += roem.points;
		state.lastTrick.roem = roem;
		pushEvent(state, { type: "roem", seat: winner, ...roem });
	}
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
		case "bid":
			placeBid(rules, state, seat, action.count);
			return state;
		case "play":
			playCard(rules, state, seat, action.card);
			return state;
		case "passTrump":
			passTrump(state, seat);
			return state;
		case "chooseTrump":
			chooseTrump(rules, state, seat, action.suit);
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
	const seats = state.hands.length;
	const passes = state.trumpPasses ?? 0;
	return {
		family: "tricks",
		phase: state.phase,
		round: state.round,
		target: rules.target,
		deals: rules.deals ?? dealsInMatch(rules, seats),
		handSize: handSizeFor(rules, seats, state.round) ?? 0,
		turn: state.turn,
		teams: teamsOf(rules, seats),
		offered: state.phase === "trump" ? (state.offered ?? null) : null,
		trumpPassed: state.hands.map(
			(_, index) =>
				state.phase === "trump" &&
				(index - state.dealer - 1 + seats) % seats < passes,
		),
		maker: state.maker ?? null,
		roem: state.roem ?? state.hands.map(() => 0),
		lastDeal: state.lastDeal ?? null,
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
		turnedUp: state.turnedUp ?? null,
		bids: state.bids ?? null,
		legalBids: seat === null ? [] : legalBids(rules, state, seat),
		blockedBid: blockedBid(rules, state),
		broken: state.broken,
		roundPoints: state.taken.map((cards) =>
			pointsOf(rules, cards, state.trump),
		),
		tricksTaken: state.tricksTaken,
		scores: state.scores,
		totals: totalsOf(state.scores, seats),
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

/**
 * How many tricks a hand should take: high trumps nearly always win, an ace
 * usually does, a guarded king sometimes. Side cards win less often at a
 * fuller table, where someone is more likely to be void and trump them.
 */
export function estimateBid(
	rules: TricksRules,
	hand: readonly CardId[],
	trump: Suit | null,
	seats: number,
) {
	const top = rules.ranks.length - 1;
	const length = (suit: Suit) =>
		hand.filter((card) => suitOf(card) === suit).length;
	const crowd = Math.min(1.3, 4 / seats);
	const TRUMP_ODDS = [1, 0.85, 0.65, 0.45, 0.45];
	let expected = 0;
	for (const card of hand) {
		const fromTop = top - rankIndex(rules, card);
		const suit = suitOf(card);
		if (suit === trump) {
			expected += TRUMP_ODDS[fromTop] ?? 0.25;
		} else if (fromTop === 0) {
			expected += (length(suit) <= 5 ? 0.85 : 0.6) * crowd;
		} else if (fromTop === 1 && length(suit) >= 2) {
			expected += 0.45 * crowd;
		} else if (fromTop === 2 && length(suit) >= 3) {
			expected += 0.2 * crowd;
		}
	}
	return Math.min(hand.length, Math.round(expected));
}

/** The allowed bid nearest the hand's estimate, the lower one on a tie. */
export function chooseBid(
	rules: TricksRules,
	state: TricksState,
	seat: number,
) {
	const wanted = estimateBid(
		rules,
		state.hands[seat],
		state.trump,
		state.hands.length,
	);
	const allowed = legalBids(rules, state, seat);
	return allowed.reduce((best, bid) =>
		Math.abs(bid - wanted) < Math.abs(best - wanted) ? bid : best,
	);
}

/**
 * A card that steers towards the bid: short of it, win as cheaply as
 * possible; at it, lose with the highest card that still loses.
 */
export function chooseBidCard(
	rules: TricksRules,
	state: TricksState,
	seat: number,
) {
	const legal = legalTricksCards(rules, state, seat);
	const strength = (card: CardId) =>
		(suitOf(card) === state.trump ? rules.ranks.length : 0) +
		rankIndex(rules, card);
	const sorted = [...legal].sort((a, b) => strength(a) - strength(b));
	const short = (state.bids?.[seat] ?? 0) > state.tricksTaken[seat];
	if (state.trick.length === 0) {
		return (short ? sorted.at(-1) : sorted[0]) as CardId;
	}
	const wins = (card: CardId) =>
		trickWinner(rules, [...state.trick, { seat, card }], state.trump) === seat;
	const winners = sorted.filter(wins);
	const losers = sorted.filter((card) => !wins(card));
	return (
		short ? (winners[0] ?? losers[0]) : (losers.at(-1) ?? winners[0])
	) as CardId;
}

/** Worth calling trump on: well over an average hand's strength. */
const CALL_STRENGTH = 55;

/** How well a hand plays with `suit` as trump: its trumps' points and length, and side aces. */
export function trumpStrength(
	rules: TricksRules,
	hand: readonly CardId[],
	suit: Suit,
) {
	return hand.reduce((sum, card) => {
		const { rank } = parseCard(card);
		if (suitOf(card) === suit) {
			return sum + cardValue(rules, card, suit) + 8;
		}
		if (rank === "A") {
			return sum + 10;
		}
		const ace = hand.some(
			(held) => suitOf(held) === suitOf(card) && parseCard(held).rank === "A",
		);
		return rank === "10" && ace ? sum + 5 : sum;
	}, 0);
}

/** The trump to call, or null to pass on the suit offered. */
export function chooseTrumpCall(
	rules: TricksRules,
	hand: readonly CardId[],
	offered: Suit | null,
): Suit | null {
	if (offered) {
		return trumpStrength(rules, hand, offered) >= CALL_STRENGTH
			? offered
			: null;
	}
	return [...SUITS].sort(
		(a, b) => trumpStrength(rules, hand, b) - trumpStrength(rules, hand, a),
	)[0];
}

/**
 * A sensible card in a points game with trump and partners: draw trumps with
 * the best one, cash winners, feed points to a partner who has the trick,
 * win cheaply, and throw the least when the trick is lost.
 */
export function choosePointsCard(
	rules: TricksRules,
	state: TricksState,
	seat: number,
) {
	const legal = legalTricksCards(rules, state, seat);
	const trump = state.trump;
	const seats = state.hands.length;
	const teams = teamsOf(rules, seats);
	const value = (card: CardId) => cardValue(rules, card, trump);
	const power = (card: CardId) => rankIndex(rules, card, trump);
	const isTrump = (card: CardId) => suitOf(card) === trump;
	// What this seat has seen: its own hand and every card played face up.
	const seen = new Set([
		...state.taken.flat(),
		...state.trick.map((play) => play.card),
		...state.hands[seat],
	]);
	const unseen = (suit: Suit) =>
		tricksDeck(rules, seats).filter(
			(card) => suitOf(card) === suit && !seen.has(card),
		);
	const isBoss = (card: CardId) =>
		unseen(suitOf(card)).every((other) => power(other) < power(card));
	const cheapest = (cards: CardId[]) =>
		[...cards].sort((a, b) => value(a) - value(b) || power(a) - power(b))[0];
	const richest = (cards: CardId[]) =>
		[...cards].sort((a, b) => value(b) - value(a) || power(a) - power(b))[0];
	const side = legal.filter((card) => !isTrump(card));
	if (state.trick.length === 0) {
		const calling =
			state.maker !== null &&
			state.maker !== undefined &&
			teams[state.maker] === teams[seat];
		const trumps = legal.filter(isTrump);
		if (calling && trumps.length > 0 && trump && unseen(trump).length > 0) {
			const top = [...trumps].sort((a, b) => power(b) - power(a))[0];
			if (isBoss(top)) {
				return top;
			}
		}
		const winners = side.filter(isBoss);
		if (winners.length > 0) {
			return richest(winners);
		}
		return cheapest(side.length > 0 ? side : legal);
	}
	const winning = trickWinner(rules, state.trick, trump);
	const last = state.trick.length === seats - 1;
	if (teams[winning] === teams[seat]) {
		const partnerCard = state.trick.find((play) => play.seat === winning);
		const safe =
			last || (partnerCard !== undefined && isBoss(partnerCard.card));
		if (safe && side.length > 0) {
			return richest(side);
		}
		return cheapest(legal);
	}
	const beats = legal.filter(
		(card) =>
			trickWinner(rules, [...state.trick, { seat, card }], trump) === seat,
	);
	if (beats.length === 0) {
		return cheapest(legal);
	}
	if (last) {
		const sideBeats = beats.filter((card) => !isTrump(card));
		return sideBeats.length > 0 ? richest(sideBeats) : cheapest(beats);
	}
	const safeBeats = beats.filter(isBoss);
	if (safeBeats.length > 0) {
		return cheapest(safeBeats);
	}
	const atStake = state.trick.reduce((sum, play) => sum + value(play.card), 0);
	return atStake >= 10
		? [...beats].sort((a, b) => power(a) - power(b))[0]
		: cheapest(legal);
}

/** The card each scorer's bot plays, so a new scorer brings its own judgement. */
const CARD_CHOOSERS = {
	penaltyCards: chooseTricksCard,
	bids: chooseBidCard,
	pointsAndRoem: choosePointsCard,
} satisfies Record<
	keyof typeof SCORERS,
	(rules: TricksRules, state: TricksState, seat: number) => CardId
>;

export function botTricksMove(
	rules: TricksRules,
	state: TricksState,
	bots: readonly number[],
): BotMove<TricksAction> | null {
	if (state.phase === "trump") {
		if (!bots.includes(state.turn)) {
			return null;
		}
		const suit = chooseTrumpCall(
			rules,
			state.hands[state.turn],
			state.offered ?? null,
		);
		return {
			seat: state.turn,
			action: suit ? { type: "chooseTrump", suit } : { type: "passTrump" },
			pace: "turn",
		};
	}
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
	if (state.phase === "bidding") {
		return bots.includes(state.turn)
			? {
					seat: state.turn,
					action: { type: "bid", count: chooseBid(rules, state, state.turn) },
					pace: "turn",
				}
			: null;
	}
	if (state.phase !== "playing" || !bots.includes(state.turn)) {
		return null;
	}
	return {
		seat: state.turn,
		action: {
			type: "play",
			card: CARD_CHOOSERS[rules.scoring](rules, state, state.turn),
		},
		pace: "turn",
	};
}
