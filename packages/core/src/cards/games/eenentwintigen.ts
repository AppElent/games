import type { CardGameDefinition } from "../engine";

/**
 * Eenentwintigen: every player against the bank, for points only. Every rule
 * below is data; the bank family has no game-specific code. Text lives in the
 * message catalog under `games.cards.games.eenentwintigen`.
 */
export const eenentwintigen = {
	id: "eenentwintigen",
	family: "bank",
	felt: "midnight",
	showcase: ["SA#0", "HK#0", "D7#0", "C4#0"],
	players: { min: 1, max: 6 },
	rules: {
		decks: 2,
		stakes: [1, 2, 5],
		rounds: 10,
		bankStandsOn: 17,
		bankHitsSoft: false,
		doubleDown: false,
		naturalPays: 1.5,
	},
	options: [
		{ id: "doubleDown", patch: { doubleDown: true } },
		{ id: "bankHitsSoft17", patch: { bankHitsSoft: true } },
		{ id: "shortMatch", patch: { rounds: 5 }, group: "rounds" },
		{ id: "longMatch", patch: { rounds: 20 }, group: "rounds" },
	],
} as const satisfies CardGameDefinition;
