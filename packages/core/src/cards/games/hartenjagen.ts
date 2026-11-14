import type { CardGameDefinition } from "../engine";

const QUEEN_OF_SPADES = { SQ: 13 } as const;

/**
 * Hartenjagen (Hearts): avoid hearts and the queen of spades. Every rule below
 * is data; the tricks family has no Hartenjagen-specific code. Text lives in
 * the message catalog under `games.cards.games.hartenjagen`.
 */
export const hartenjagen = {
	id: "hartenjagen",
	family: "tricks",
	felt: "midnight",
	showcase: ["H2#0", "HK#0", "HA#0", "SQ#0"],
	players: { min: 3, max: 6 },
	rules: {
		ranks: ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"],
		// Low diamonds and clubs leave, so everyone gets the same number of cards.
		// The two of clubs stays: it opens every deal.
		stripped: {
			3: ["D2"],
			5: ["D2", "C3"],
			6: ["D2", "C3", "D3", "C4"],
		},
		passing: { count: 3, cycle: ["left", "right", "across", "keep"] },
		firstLead: "C2",
		breaking: { suit: "H", alsoBrokenBy: [] },
		schedule: "fullDeck",
		trumpChoice: "none",
		seating: "alone",
		scoring: "penaltyCards",
		suitPoints: { H: 1 },
		cardPoints: QUEEN_OF_SPADES,
		shootTheMoon: true,
		target: 100,
	},
	options: [
		{ id: "noPassing", patch: { passing: null } },
		{
			id: "queenBreaksHearts",
			patch: { breaking: { suit: "H", alsoBrokenBy: ["SQ"] } },
		},
		{
			id: "jackOfDiamonds",
			patch: { cardPoints: { ...QUEEN_OF_SPADES, DJ: -10 } },
		},
		{ id: "to50", patch: { target: 50 } },
	],
} as const satisfies CardGameDefinition;
