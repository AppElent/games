import type { CardGameDefinition } from "../engine";

/**
 * Klaverjassen: two teams of partners sitting opposite, a 32-card deck, a
 * trump called in turn, and roem. Every rule below is data for the tricks
 * family. Text lives under `games.cards.games.klaverjassen`.
 */
export const klaverjassen = {
	id: "klaverjassen",
	family: "tricks",
	felt: "bottle",
	showcase: ["CJ#0", "C9#0", "CA#0", "C10#0"],
	players: { min: 4, max: 4 },
	rules: {
		// Outside trump: A 10 K Q J 9 8 7, high to low. The ranks also make the deck.
		ranks: ["7", "8", "9", "J", "Q", "K", "10", "A"],
		// In trump: J 9 A 10 K Q 8 7.
		trumpRanks: ["7", "8", "Q", "K", "10", "A", "9", "J"],
		stripped: {},
		passing: null,
		firstLead: null,
		breaking: null,
		schedule: "fullDeck",
		// A suit is put to the table; seats play it or pass ("vrij").
		trumpChoice: "random",
		callTrump: true,
		// Rotterdams: always trump and overtrump when you can.
		mustTrump: "always",
		seating: "opposite",
		scoring: "pointsAndRoem",
		suitPoints: {},
		cardPoints: {},
		rankPoints: { A: 11, "10": 10, K: 4, Q: 3, J: 2 },
		trumpPoints: { J: 20, "9": 14, A: 11, "10": 10, K: 4, Q: 3 },
		lastTrickBonus: 10,
		roem: true,
		pitBonus: 100,
		shootTheMoon: false,
		target: null,
		deals: 16,
		highWins: true,
	},
	options: [
		// "Verplicht" (Utrechts): the seat left of the dealer names trump.
		{ id: "forcedTrump", patch: { trumpChoice: "none" } },
		{ id: "amsterdams", patch: { mustTrump: "unlessPartnerWins" } },
		{ id: "shortMatch", patch: { deals: 8 } },
		// Only card points and the last trick count; pit is roem too.
		{ id: "noRoem", patch: { roem: false, pitBonus: 0 } },
	],
} as const satisfies CardGameDefinition;
