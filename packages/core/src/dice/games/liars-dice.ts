import type { DiceGameDefinition } from "../engine";

/**
 * Liar's dice: five hidden dice each, bids that climb until someone calls a
 * lie, and one die lost per wrong call. Every rule below is data; the bidding
 * family has no game-specific code. Text lives in the message catalog under
 * `games.dice.games["liars-dice"]`.
 */
export const liarsDice = {
	id: "liars-dice",
	family: "bidding",
	felt: "oxblood",
	showcase: [1, 4, 4, 1, 4],
	players: { min: 2, max: 6 },
	rules: { startingDice: 5, wildOnes: false, spotOn: false },
	options: [
		// The usual way to play, so the setup screens start with it switched on.
		{ id: "wildOnes", patch: { wildOnes: true }, on: true },
		{ id: "spotOn", patch: { spotOn: true } },
		{ id: "threeDice", patch: { startingDice: 3 } },
	],
} as const satisfies DiceGameDefinition;
