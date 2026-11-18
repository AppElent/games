import { SUITS } from "@arcadeclub/core/cards/deck";
import { CARD_ENGINE, type CardAction } from "@arcadeclub/core/cards/engine";
import { type Infer, v } from "convex/values";
import { tableGameFunctions } from "./lib/tableGames";
import { literals } from "./lib/validators";

/**
 * One backend for every card game: the game id selects a definition from
 * `@arcadeclub/core/cards/engine`, and nothing here names a specific game.
 * Seats, bots and the table's life cycle live in `lib/tableGames`.
 */

const cardActionValidator = v.union(
	v.object({
		type: v.literal("play"),
		card: v.string(),
		suit: v.optional(literals(SUITS)),
		callLast: v.optional(v.boolean()),
	}),
	v.object({ type: v.literal("draw") }),
	v.object({ type: v.literal("pass") }),
	v.object({ type: v.literal("callLast") }),
	v.object({ type: v.literal("catch"), target: v.number() }),
	v.object({ type: v.literal("drawStock") }),
	v.object({ type: v.literal("takeDiscard") }),
	v.object({
		type: v.literal("layDown"),
		melds: v.optional(v.array(v.array(v.string()))),
		additions: v.optional(
			v.array(v.object({ meldId: v.number(), cards: v.array(v.string()) })),
		),
		swaps: v.optional(
			v.array(v.object({ meldId: v.number(), card: v.string() })),
		),
	}),
	v.object({ type: v.literal("discard"), card: v.string() }),
	v.object({ type: v.literal("nextRound") }),
	v.object({ type: v.literal("stake"), amount: v.number() }),
	v.object({ type: v.literal("hit") }),
	v.object({ type: v.literal("stand") }),
	v.object({ type: v.literal("double") }),
	v.object({ type: v.literal("passCards"), cards: v.array(v.string()) }),
	v.object({ type: v.literal("knock") }),
	v.object({ type: v.literal("stay") }),
	v.object({ type: v.literal("fold") }),
	v.object({ type: v.literal("swapHand") }),
	v.object({ type: v.literal("passTrump") }),
	v.object({ type: v.literal("chooseTrump"), suit: literals(SUITS) }),
	v.object({ type: v.literal("bid"), count: v.number() }),
	v.object({ type: v.literal("knock"), card: v.string() }),
	v.object({
		type: v.literal("layOff"),
		meldId: v.number(),
		cards: v.array(v.string()),
	}),
	v.object({ type: v.literal("finishLayoff") }),
);

// Arguments are a validator and core is dependency-free, so this cannot be
// derived. It fails typecheck as soon as the two disagree, either way round.
true satisfies [Infer<typeof cardActionValidator>] extends [CardAction]
	? [CardAction] extends [Infer<typeof cardActionValidator>]
		? true
		: false
	: false;

export const {
	createTable,
	takeSeat,
	reclaimSeat,
	addBot,
	removeSeat,
	start,
	act,
	botStep,
	setAutopilot,
	rematch,
	getTable,
} = tableGameFunctions({
	gameType: "card-games",
	module: "cardGames",
	engine: CARD_ENGINE,
	actionValidator: cardActionValidator,
});
