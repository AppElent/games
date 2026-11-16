import type { CardGameDefinition } from "../engine";

/**
 * Toepen: four cards each, and only the last trick counts. Knocking raises the
 * stake; whoever folds pays what it was. Every rule below is data; the tricks
 * family has no Toepen-specific code. Text lives in the message catalog under
 * `games.cards.games.toepen`.
 */
export const toepen = {
	id: "toepen",
	family: "tricks",
	felt: "bottle",
	showcase: ["SJ#0", "HA#0", "D9#0", "C10#0"],
	players: { min: 2, max: 8 },
	rules: {
		// The jack is lowest and the ten highest; seven to ace makes 32 cards.
		ranks: ["J", "Q", "K", "A", "7", "8", "9", "10"],
		stripped: {},
		passing: null,
		firstLead: null,
		breaking: null,
		schedule: "fourEach",
		trumpChoice: "none",
		seating: "alone",
		scoring: "lastTrick",
		suitPoints: {},
		cardPoints: {},
		shootTheMoon: false,
		target: 10,
		matchEnd: "lastStanding",
		knocking: { lastLife: false },
		swapHands: [],
	},
	options: [
		{ id: "outAt15", patch: { target: 15 } },
		{ id: "vuileWas", append: { swapHands: [["J", "Q", "K", "A"]] } },
		{ id: "armoede", append: { swapHands: [["7", "8", "9", "10"]] } },
		{ id: "lastLife", patch: { knocking: { lastLife: true } } },
	],
} as const satisfies CardGameDefinition;
