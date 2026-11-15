import { DICE_ENGINE, type DiceAction } from "@arcadeclub/core/dice/engine";
import { SCORE_CATEGORIES } from "@arcadeclub/core/dice/scoresheet";
import { type Infer, v } from "convex/values";
import { tableGameFunctions } from "./lib/tableGames";
import { literals } from "./lib/validators";

/**
 * One backend for every dice game: the game id selects a definition from
 * `@arcadeclub/core/dice/engine`, and nothing here names a specific game.
 * Dice tables share the card tables' storage, seats and bots
 * (`lib/tableGames`); every roll draws on the server's randomness for that
 * move, never on anything a client sends.
 */

const diceActionValidator = v.union(
	v.object({ type: v.literal("roll"), keep: v.array(v.number()) }),
	v.object({ type: v.literal("score"), category: literals(SCORE_CATEGORIES) }),
	v.object({ type: v.literal("stand") }),
);

// Fails typecheck as soon as the validator and core's actions disagree.
true satisfies [Infer<typeof diceActionValidator>] extends [DiceAction]
	? [DiceAction] extends [Infer<typeof diceActionValidator>]
		? true
		: false
	: false;

export const {
	createTable,
	takeSeat,
	addBot,
	removeSeat,
	start,
	act,
	botStep,
	setAutopilot,
	rematch,
	getTable,
} = tableGameFunctions({
	gameType: "dice-games",
	module: "diceGames",
	engine: DICE_ENGINE,
	actionValidator: diceActionValidator,
});
