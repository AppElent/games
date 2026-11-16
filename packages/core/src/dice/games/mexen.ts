import type { DiceGameDefinition } from "../engine";

/**
 * Mexen as it is played in the Netherlands (Mexico in English), with six
 * lives and Mex doubling the round's loss as the table's own rules. Every rule
 * below is data; text lives under `games.dice.games.mexen`.
 */
export const mexen = {
	id: "mexen",
	family: "mexen",
	felt: "oxblood",
	showcase: [2, 1],
	players: { min: 2, max: 8 },
	rules: {
		maxThrows: 3,
		lives: 6,
		mexDoubles: true,
		littleMex: false,
		scoring: "lives",
	},
	options: [
		{ id: "lives3", group: "lives", patch: { lives: 3 } },
		{ id: "lives10", group: "lives", patch: { lives: 10 } },
		{ id: "mexSingle", patch: { mexDoubles: false } },
		{ id: "littleMex", patch: { littleMex: true } },
		{ id: "points", patch: { scoring: "points" } },
	],
} as const satisfies DiceGameDefinition;
