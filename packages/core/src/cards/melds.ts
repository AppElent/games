/**
 * Rummy melds: sets (same rank, different suits) and runs (same suit, in
 * order), with jokers standing in. A run's `low` is the value of its first
 * position: 1 is a low ace, 14 a high ace.
 */
import {
	type CardId,
	isJoker,
	parseCard,
	RANKS,
	type Rank,
	SUITS,
	type Suit,
} from "./deck";

/** Ace to king: the ace counts low or high, not both. */
const MAX_RUN = 13;
export type MeldRules = {
	minMeldSize: number;
	/** Fewest real cards in a meld, so jokers cannot carry one alone. */
	minNaturals: number;
	/** Points by rank when a card sits in a meld or stays in a hand. */
	points: Record<Rank, number>;
	/** A low ace in A-2-3 is worth this in a meld. */
	lowAcePoints: number;
	jokerPoints: number;
};

export type MeldShape =
	| { kind: "set"; cards: CardId[]; rank: Rank }
	| { kind: "run"; cards: CardId[]; suit: Suit; low: number };

export type Meld = MeldShape & { id: number };

/** 1 for an ace, up to 13 for a king. */
function rankValue(rank: Rank) {
	return RANKS.indexOf(rank) + 1;
}

function rankAt(position: number): Rank {
	return RANKS[(position - 1) % 13];
}

function buildSet(
	cards: readonly CardId[],
	rules: MeldRules,
): MeldShape | null {
	const naturals = cards.filter((card) => !isJoker(card));
	if (
		cards.length > SUITS.length ||
		naturals.length < rules.minNaturals ||
		cards.length < rules.minMeldSize
	) {
		return null;
	}
	const parsed = naturals.map((card) => parseCard(card));
	const first = parsed[0];
	if (first.joker) {
		return null;
	}
	const suits = new Set<Suit>();
	for (const card of parsed) {
		if (card.joker || card.rank !== first.rank || suits.has(card.suit)) {
			return null;
		}
		suits.add(card.suit);
	}
	return { kind: "set", cards: [...cards], rank: first.rank };
}

/** Tries one ace value; returns the laid-out run with jokers in the gaps. */
function layOutRun(
	naturals: ReadonlyArray<{ card: CardId; position: number }>,
	jokers: readonly CardId[],
	suit: Suit,
): MeldShape | null {
	const sorted = [...naturals].sort((a, b) => a.position - b.position);
	const low = sorted[0].position;
	const high = sorted[sorted.length - 1].position;
	const gaps = high - low + 1 - sorted.length;
	if (gaps > jokers.length) {
		return null;
	}
	if (new Set(sorted.map((entry) => entry.position)).size !== sorted.length) {
		return null;
	}
	const spare = jokers.length - gaps;
	// Spare jokers extend upward first, then below the lowest card.
	const above = Math.min(spare, 14 - high);
	const below = spare - above;
	if (low - below < 1) {
		return null;
	}
	const pool = [...jokers];
	const cards: CardId[] = [];
	for (let position = low - below; position <= high + above; position += 1) {
		const natural = sorted.find((entry) => entry.position === position);
		cards.push(natural ? natural.card : (pool.pop() as CardId));
	}
	return { kind: "run", cards, suit, low: low - below };
}

function buildRun(
	cards: readonly CardId[],
	rules: MeldRules,
): MeldShape | null {
	const jokers = cards.filter(isJoker);
	const naturals = cards.filter((card) => !isJoker(card));
	if (
		naturals.length < rules.minNaturals ||
		cards.length < rules.minMeldSize ||
		cards.length > MAX_RUN
	) {
		return null;
	}
	const parsed = naturals.map((card) => parseCard(card));
	const first = parsed[0];
	if (first.joker) {
		return null;
	}
	const suit = first.suit;
	const positions: Array<{ card: CardId; position: number }> = [];
	for (let i = 0; i < parsed.length; i += 1) {
		const card = parsed[i];
		if (card.joker || card.suit !== suit) {
			return null;
		}
		positions.push({ card: naturals[i], position: rankValue(card.rank) });
	}
	const direct = layOutRun(positions, jokers, suit);
	if (direct) {
		return direct;
	}
	// The ace also plays high, after the king.
	return layOutRun(
		positions.map((entry) =>
			entry.position === 1 ? { ...entry, position: 14 } : entry,
		),
		jokers,
		suit,
	);
}

/** The meld these cards form, or null. Sets and runs cannot be confused: the rule of two real cards settles it. */
export function buildMeld(
	cards: readonly CardId[],
	rules: MeldRules,
): MeldShape | null {
	return buildSet(cards, rules) ?? buildRun(cards, rules);
}

/** The face a meld position stands for, for the joker chip and for swapping. */
export function runFaceAt(meld: Extract<Meld, { kind: "run" }>, index: number) {
	return { suit: meld.suit, rank: rankAt(meld.low + index) };
}

function positionPoints(position: number, rules: MeldRules) {
	return position === 1 ? rules.lowAcePoints : rules.points[rankAt(position)];
}

export function meldPoints(meld: MeldShape, rules: MeldRules) {
	if (meld.kind === "set") {
		return meld.cards.length * rules.points[meld.rank];
	}
	return meld.cards.reduce(
		(sum, _card, index) => sum + positionPoints(meld.low + index, rules),
		0,
	);
}

export function handPoints(hand: readonly CardId[], rules: MeldRules) {
	return hand.reduce((sum, card) => {
		const parsed = parseCard(card);
		return sum + (parsed.joker ? rules.jokerPoints : rules.points[parsed.rank]);
	}, 0);
}

/** The meld with `card` added, or null when it does not fit. */
export function extendMeld(meld: Meld, card: CardId): Meld | null {
	const parsed = parseCard(card);
	if (meld.kind === "run" && meld.cards.length >= MAX_RUN) {
		return null;
	}
	if (meld.kind === "set") {
		if (meld.cards.length >= SUITS.length) {
			return null;
		}
		if (parsed.joker) {
			return { ...meld, cards: [...meld.cards, card] };
		}
		const takenSuits = meld.cards.flatMap((existing) => {
			const face = parseCard(existing);
			return face.joker ? [] : [face.suit];
		});
		if (parsed.rank !== meld.rank || takenSuits.includes(parsed.suit)) {
			return null;
		}
		return { ...meld, cards: [...meld.cards, card] };
	}
	const high = meld.low + meld.cards.length - 1;
	if (parsed.joker) {
		if (high < 14) {
			return { ...meld, cards: [...meld.cards, card] };
		}
		return meld.low > 1
			? { ...meld, cards: [card, ...meld.cards], low: meld.low - 1 }
			: null;
	}
	if (parsed.suit !== meld.suit) {
		return null;
	}
	const value = rankValue(parsed.rank);
	const above = high + 1;
	const fitsAbove = above <= 14 && rankAt(above) === parsed.rank;
	if (fitsAbove) {
		return { ...meld, cards: [...meld.cards, card] };
	}
	if (meld.low - 1 === value) {
		return { ...meld, cards: [card, ...meld.cards], low: value };
	}
	return null;
}

/**
 * An order in which all of `cards` go onto the meld, or null when they don't all
 * fit. Natural cards go first, so a joker only fills a gap nothing else can.
 */
export function fitOnMeld(
	meld: Meld,
	cards: readonly CardId[],
): CardId[] | null {
	const order: CardId[] = [];
	const left = [...cards].sort(
		(a, b) => Number(isJoker(a)) - Number(isJoker(b)),
	);
	let current = meld;
	while (left.length > 0) {
		const index = left.findIndex((card) => extendMeld(current, card) !== null);
		if (index < 0) {
			return null;
		}
		const [card] = left.splice(index, 1);
		current = extendMeld(current, card) as Meld;
		order.push(card);
	}
	return order;
}

/** The meld with a joker replaced by `card`, and that joker; null when `card` is not what any joker stands for. */
export function swapJoker(
	meld: Meld,
	card: CardId,
): { meld: Meld; joker: CardId } | null {
	const parsed = parseCard(card);
	if (parsed.joker) {
		return null;
	}
	if (meld.kind === "set") {
		const joker = meld.cards.find(isJoker);
		if (!joker || parsed.rank !== meld.rank) {
			return null;
		}
		const taken = meld.cards.some((existing) => {
			const face = parseCard(existing);
			return !face.joker && face.suit === parsed.suit;
		});
		if (taken) {
			return null;
		}
		return {
			meld: {
				...meld,
				cards: meld.cards.map((existing) =>
					existing === joker ? card : existing,
				),
			},
			joker,
		};
	}
	if (parsed.suit !== meld.suit) {
		return null;
	}
	for (let index = 0; index < meld.cards.length; index += 1) {
		if (
			isJoker(meld.cards[index]) &&
			runFaceAt(meld, index).rank === parsed.rank
		) {
			const cards = [...meld.cards];
			const joker = cards[index];
			cards[index] = card;
			return { meld: { ...meld, cards }, joker };
		}
	}
	return null;
}
