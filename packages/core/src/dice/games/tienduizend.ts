import type { DiceGameDefinition } from "../engine";
import type { PushluckRules } from "../pushluck";

/**
 * 10.000, the Dutch name for the game also known as Farkle: six dice, 1s and
 * 5s and three alike score, first past 10,000 wins after a final round. Every
 * rule below is data; the push-your-luck family has no game-specific code.
 * Text lives in the message catalog under `games.dice.games.tienduizend`.
 */
export const tienduizend = {
	id: "tienduizend",
	family: "pushluck",
	felt: "oxblood",
	showcase: [1, 1, 1, 5, 5],
	players: { min: 2, max: 6 },
	rules: {
		dice: 6,
		target: 10_000,
		singles: { 1: 100, 5: 50 },
		threeOfAKind: { perFace: 100, ones: 1000 },
		manyOfAKind: { kind: "double" },
		threePairs: 750,
		straight: 1500,
		openingScore: 0,
		finalRound: true,
	},
	options: [
		{ id: "opening350", group: "opening", patch: { openingScore: 350 } },
		{ id: "opening500", group: "opening", patch: { openingScore: 500 } },
		{
			id: "fixedKinds",
			patch: {
				manyOfAKind: { kind: "fixed", points: { 4: 1000, 5: 2000, 6: 3000 } },
			},
		},
		{ id: "noThreePairs", patch: { threePairs: null } },
		{ id: "noStraight", patch: { straight: null } },
		{ id: "noFinalRound", patch: { finalRound: false } },
	],
} as const satisfies DiceGameDefinition & { rules: PushluckRules };
