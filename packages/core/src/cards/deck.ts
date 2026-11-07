/**
 * Playing cards as compact, JSON-safe ids: `H7#0` is the seven of hearts from
 * deck 0, `JK#3` the fourth joker. The deck index keeps ids unique when a game
 * shuffles several decks together.
 */
export const SUITS = ["S", "H", "D", "C"] as const;
export const RANKS = [
	"A",
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
] as const;

export type Suit = (typeof SUITS)[number];
export type Rank = (typeof RANKS)[number];
export type CardId = string;
export type Random = () => number;

type ParsedCard =
	| { joker: true; suit: null; rank: null }
	| { joker: false; suit: Suit; rank: Rank };

const JOKER: ParsedCard = { joker: true, suit: null, rank: null };

export function parseCard(id: CardId): ParsedCard {
	if (id.startsWith("JK")) {
		return JOKER;
	}
	const hash = id.indexOf("#");
	return {
		joker: false,
		suit: id[0] as Suit,
		rank: id.slice(1, hash) as Rank,
	};
}

export function isJoker(id: CardId) {
	return id.startsWith("JK");
}

export function buildDeck(decks: number, jokers: number): CardId[] {
	const cards: CardId[] = [];
	for (let deck = 0; deck < decks; deck += 1) {
		for (const suit of SUITS) {
			for (const rank of RANKS) {
				cards.push(`${suit}${rank}#${deck}`);
			}
		}
	}
	for (let joker = 0; joker < jokers; joker += 1) {
		cards.push(`JK#${joker}`);
	}
	return cards;
}

export function shuffle<T>(items: readonly T[], random: Random): T[] {
	const result = [...items];
	for (let i = result.length - 1; i > 0; i -= 1) {
		const j = Math.floor(random() * (i + 1));
		[result[i], result[j]] = [result[j], result[i]];
	}
	return result;
}

/** Cards per seat dealt one at a time from the end of the stock. */
export function deal(stock: CardId[], seats: number, handSize: number) {
	const hands: CardId[][] = Array.from({ length: seats }, () => []);
	for (let round = 0; round < handSize; round += 1) {
		for (const hand of hands) {
			hand.push(stock.pop() as CardId);
		}
	}
	return hands;
}

/**
 * Takes up to `count` cards from the stock, reshuffling the discard pile (all
 * but its top card) when the stock runs out. Returns the cards it found, which
 * is fewer than `count` only when nothing is left to reshuffle.
 */
export function drawCards(
	piles: { stock: CardId[]; discard: CardId[] },
	count: number,
	random: Random,
) {
	const drawn: CardId[] = [];
	let reshuffled = false;
	for (let i = 0; i < count; i += 1) {
		if (piles.stock.length === 0) {
			if (piles.discard.length <= 1) {
				break;
			}
			const top = piles.discard.pop() as CardId;
			piles.stock = shuffle(piles.discard, random);
			piles.discard = [top];
			reshuffled = true;
		}
		drawn.push(piles.stock.pop() as CardId);
	}
	return { drawn, reshuffled };
}

export function removeCard(hand: CardId[], card: CardId) {
	const index = hand.indexOf(card);
	if (index < 0) {
		return false;
	}
	hand.splice(index, 1);
	return true;
}

export function clone<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}
