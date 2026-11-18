import type { CardGameDefinition } from "../engine";

/**
 * Mau-Mau, the German-Dutch cousin of Pesten: a 32-card deck, five cards each,
 * and only three special cards. The last-card call is Mau in the original. Text lives in the message catalog under
 * `games.cards.games.maumau`.
 */
export const maumau = {
	id: "maumau",
	family: "shedding",
	felt: "midnight",
	showcase: ["H7#0", "S8#0", "CJ#0", "DA#0"],
	players: { min: 2, max: 5 },
	rules: {
		// Five players would leave seven cards in the stock: give them a second deck.
		decks: [
			{ from: 5, decks: 2 },
			{ from: 2, decks: 1 },
		],
		jokersPerDeck: 0,
		ranks: ["7", "8", "9", "10", "J", "Q", "K", "A"],
		handSize: 5,
		powers: {
			"7": { kind: "draw", amount: 2 },
			"8": { kind: "skip" },
			J: { kind: "chooseSuit" },
		},
		stackDraws: true,
		playDrawnCard: true,
		voluntaryDraw: true,
		lastCardPenalty: 2,
		finishOnPowerPenalty: null,
		twoPlayerReverseAgain: false,
	},
	options: [
		{ id: "noStacking", patch: { stackDraws: false } },
		{ id: "noLastCard", patch: { lastCardPenalty: null } },
		{ id: "mustPlay", patch: { voluntaryDraw: false } },
		{ id: "noPlayDrawn", patch: { playDrawnCard: false } },
		{ id: "plain7", withoutPowers: ["7"] },
		{ id: "plain8", withoutPowers: ["8"] },
		{ id: "plainJ", withoutPowers: ["J"] },
		// With two players a reverse changes nothing, so the nine only counts from three.
		{
			id: "nineReverses",
			withPowers: { "9": { kind: "reverse" } },
			minPlayers: 3,
		},
	],
} as const satisfies CardGameDefinition;
