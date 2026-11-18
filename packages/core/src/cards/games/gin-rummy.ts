import type { CardGameDefinition } from "../engine";

/**
 * Gin Rummy for two: one deck, ten cards, knock at 10 or go gin. Every rule
 * below is data; the gin family has no Gin Rummy-specific code. Text lives in
 * the message catalog under `games.cards.games["gin-rummy"]`.
 */
export const ginRummy = {
	id: "gin-rummy",
	family: "gin",
	felt: "midnight",
	showcase: ["S7#0", "S8#0", "S9#0", "D9#0"],
	players: { min: 2, max: 2 },
	rules: {
		handSize: 10,
		minMeldSize: 3,
		minNaturals: 3,
		points: {
			A: 1,
			"2": 2,
			"3": 3,
			"4": 4,
			"5": 5,
			"6": 6,
			"7": 7,
			"8": 8,
			"9": 9,
			"10": 10,
			J: 10,
			Q: 10,
			K: 10,
		},
		lowAcePoints: 1,
		jokerPoints: 0,
		knockLimit: 10,
		ginBonus: 25,
		undercutBonus: 25,
		targetScore: 100,
		stockFloor: 2,
	},
	options: [
		{ id: "shortMatch", patch: { targetScore: 50 } },
		// Only gin ends a hand: nobody may knock with deadwood.
		{ id: "straightGin", patch: { knockLimit: 0 } },
	],
} as const satisfies CardGameDefinition;
