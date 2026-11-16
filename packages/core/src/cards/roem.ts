/**
 * Roem: bonus points for card patterns that fall together in one trick, as in
 * Klaverjassen. The trick's taker scores them. Runs follow the natural order
 * (7 8 9 10 J Q K A), whatever order the game plays its cards in.
 */
import { type CardId, parseCard, type Rank, type Suit } from "./deck";

/** What a trick's roem is made of; clients name each kind in a callout. */
export const ROEM_KINDS = ["three", "four", "stuk", "square", "jacks"] as const;
export type RoemKind = (typeof ROEM_KINDS)[number];

export const ROEM_POINTS: Readonly<Record<RoemKind, number>> = {
	three: 20,
	four: 50,
	stuk: 20,
	square: 100,
	jacks: 200,
};

/** Natural order, low to high, so a run is consecutive positions. */
const RUN_ORDER: readonly Rank[] = [
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
];

/** The longest run of consecutive ranks among these cards of one suit. */
function longestRun(ranks: readonly Rank[]) {
	const positions = [...new Set(ranks.map((rank) => RUN_ORDER.indexOf(rank)))]
		.filter((position) => position >= 0)
		.sort((a, b) => a - b);
	let best = 0;
	let run = 0;
	positions.forEach((position, index) => {
		run = index > 0 && position === positions[index - 1] + 1 ? run + 1 : 1;
		best = Math.max(best, run);
	});
	return best;
}

/**
 * The roem in one trick: a run of three (20) or four (50) in a suit, the king
 * and queen of trump ("stuk", 20, on top of any run), or four of a kind (100,
 * four jacks 200).
 */
export function roemOf(cards: readonly CardId[], trump: Suit | null) {
	const parsed = cards.flatMap((card) => {
		const { suit, rank } = parseCard(card);
		return suit === null ? [] : [{ suit, rank }];
	});
	const kinds: RoemKind[] = [];
	const first = parsed[0]?.rank;
	if (parsed.length === 4 && parsed.every((card) => card.rank === first)) {
		kinds.push(first === "J" ? "jacks" : "square");
	}
	const suits = new Set(parsed.map((card) => card.suit));
	for (const suit of suits) {
		const run = longestRun(
			parsed.filter((card) => card.suit === suit).map((card) => card.rank),
		);
		if (run >= 4) {
			kinds.push("four");
		} else if (run === 3) {
			kinds.push("three");
		}
	}
	const holds = (rank: Rank) =>
		parsed.some((card) => card.suit === trump && card.rank === rank);
	if (trump !== null && holds("K") && holds("Q")) {
		kinds.push("stuk");
	}
	return {
		points: kinds.reduce((sum, kind) => sum + ROEM_POINTS[kind], 0),
		kinds,
	};
}
