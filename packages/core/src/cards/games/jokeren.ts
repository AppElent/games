import type { CardGameDefinition } from "../engine";

/**
 * Jokeren: Dutch rummy with two decks and four jokers. Every rule below is
 * data; the rummy family has no Jokeren-specific code. Text lives in the
 * message catalog under `games.cards.games.jokeren`.
 */
export const jokeren = {
	id: "jokeren",
	family: "rummy",
	felt: "bottle",
	showcase: ["H7#0", "H8#0", "JK#0", "H10#0"],
	players: { min: 2, max: 6 },
	rules: {
		decks: 2,
		jokers: 4,
		handSize: 13,
		minMeldSize: 3,
		minNaturals: 2,
		openingPoints: 30,
		takeFromDiscard: true,
		rounds: 5,
		maxTurnsPerRound: 240,
		points: {
			A: 11,
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
		jokerPoints: 25,
	},
	options: [
		{ id: "fullMatch", patch: { rounds: 10 } },
		{ id: "stockOnly", patch: { takeFromDiscard: false } },
		{ id: "openAt40", patch: { openingPoints: 40 } },
	],
} as const satisfies CardGameDefinition;
