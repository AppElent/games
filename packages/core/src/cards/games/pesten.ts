import type { CardGameDefinition } from "../engine";

/**
 * Pesten as most Dutch families play it. Every rule below is data; the shedding
 * family has no Pesten-specific code. Text lives in the message catalog under
 * `games.cards.games.pesten`.
 */
export const pesten = {
	id: "pesten",
	family: "shedding",
	felt: "oxblood",
	showcase: ["S2#0", "D7#0", "JK#1", "HJ#0"],
	players: { min: 2, max: 8 },
	rules: {
		decks: [
			{ from: 6, decks: 2 },
			{ from: 2, decks: 1 },
		],
		jokersPerDeck: 2,
		handSize: 7,
		powers: {
			"2": { kind: "draw", amount: 2 },
			joker: { kind: "draw", amount: 5, wild: true },
			"7": { kind: "again" },
			"8": { kind: "skip" },
			J: { kind: "chooseSuit" },
			A: { kind: "reverse" },
		},
		stackDraws: true,
		playDrawnCard: true,
		voluntaryDraw: true,
		lastCardPenalty: 2,
		finishOnPowerPenalty: null,
		twoPlayerReverseAgain: true,
	},
	options: [
		{ id: "noFinishOnPower", patch: { finishOnPowerPenalty: 5 } },
		{ id: "noStacking", patch: { stackDraws: false } },
		{ id: "noLastCard", patch: { lastCardPenalty: null } },
	],
} as const satisfies CardGameDefinition;
