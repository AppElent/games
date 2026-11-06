/**
 * The card-game engine: one contract over the rule families, so the backend
 * and the table UI never name a specific game. To add a game, write a
 * definition under `games/`, list it in `CARD_GAMES`, and add its text to
 * `games.cards.games` in both locales. A game that fits no family needs a new
 * family module and a table component, not a new backend.
 */
import { GameRuleError } from "../errors";
import type { Random } from "./deck";
import { jokeren } from "./games/jokeren";
import { pesten } from "./games/pesten";
import {
	applyRummy,
	botRummyMove,
	createRummy,
	type RummyAction,
	type RummyRules,
	type RummyState,
	type RummyView,
	viewRummy,
} from "./rummy";
import {
	applyShedding,
	type BotMove,
	botSheddingMove,
	createShedding,
	type SheddingAction,
	type SheddingRules,
	type SheddingState,
	type SheddingView,
	viewShedding,
} from "./shedding";

export type FeltColor = "oxblood" | "bottle" | "midnight";

type Definition<Family extends string, Rules> = {
	id: string;
	family: Family;
	felt: FeltColor;
	/** A few cards that show the game off on its menu tile. */
	showcase: readonly string[];
	players: { min: number; max: number };
	rules: Rules;
	/** House rules: each one is a patch over `rules`, off by default. */
	options: ReadonlyArray<{ id: string; patch: Partial<Rules> }>;
};

export type CardGameDefinition =
	| Definition<"shedding", SheddingRules>
	| Definition<"rummy", RummyRules>;

/** How long a player can go without a heartbeat before others may hand their seat to autopilot. */
export const SEAT_SILENT_AFTER_MS = 60_000;

export const CARD_GAMES = { pesten, jokeren } as const satisfies Record<
	string,
	CardGameDefinition
>;

export type CardGameId = keyof typeof CARD_GAMES;
export const CARD_GAME_IDS = Object.keys(CARD_GAMES) as CardGameId[];

export function isCardGameId(value: string): value is CardGameId {
	return (CARD_GAME_IDS as string[]).includes(value);
}

export type CardGameState = SheddingState | RummyState;
export type CardAction = SheddingAction | RummyAction;
export type CardView = SheddingView | RummyView;

export function getCardGame(id: string): CardGameDefinition {
	if (!isCardGameId(id)) {
		throw new GameRuleError("gameNotFound");
	}
	return CARD_GAMES[id];
}

/** Validates house-rule ids; unknown ones are a client error. */
export function normalizeOptions(game: CardGameDefinition, options: string[]) {
	const known = game.options.map((option) => option.id as string);
	for (const option of options) {
		if (!known.includes(option)) {
			throw new GameRuleError("cardsUnknownOption");
		}
	}
	return known.filter((id) => options.includes(id));
}

function rulesOf<R>(
	game: { rules: R; options: ReadonlyArray<{ id: string; patch: Partial<R> }> },
	options: readonly string[],
): R {
	let rules = game.rules;
	for (const option of game.options) {
		if (options.includes(option.id)) {
			rules = { ...rules, ...option.patch };
		}
	}
	return rules;
}

const SHEDDING_ACTIONS = ["play", "draw", "pass", "callLast", "catch"];
const RUMMY_ACTIONS = [
	"drawStock",
	"takeDiscard",
	"layDown",
	"discard",
	"nextRound",
];

/** One contract per family; the casts stay here because the game id picks the family. */
export function createCardGame(
	game: CardGameDefinition,
	options: readonly string[],
	seats: number,
	random: Random = Math.random,
	starter = 0,
): CardGameState {
	if (seats < game.players.min || seats > game.players.max) {
		throw new GameRuleError("notEnoughPlayers");
	}
	return game.family === "shedding"
		? createShedding(rulesOf(game, options), seats, random, starter)
		: createRummy(
				rulesOf(game, options),
				seats,
				random,
				(starter + seats - 1) % seats,
			);
}

/** Who leads the rematch: the next seat along, so the lead goes round the table. */
export function nextStarter(state: CardGameState) {
	const seats = state.hands.length;
	return state.family === "shedding"
		? (state.starter + 1) % seats
		: (state.dealer + 2) % seats;
}

export function applyCardAction(
	game: CardGameDefinition,
	options: readonly string[],
	state: CardGameState,
	seat: number,
	action: CardAction,
	random: Random = Math.random,
): CardGameState {
	if (game.family === "shedding") {
		if (!SHEDDING_ACTIONS.includes(action.type)) {
			throw new GameRuleError("cardsWrongAction");
		}
		return applyShedding(
			rulesOf(game, options),
			state as SheddingState,
			seat,
			action as SheddingAction,
			random,
		);
	}
	if (!RUMMY_ACTIONS.includes(action.type)) {
		throw new GameRuleError("cardsWrongAction");
	}
	return applyRummy(
		rulesOf(game, options),
		state as RummyState,
		seat,
		action as RummyAction,
		random,
	);
}

/** What one seat may see; `null` is a spectator. Never includes other hands. */
export function viewCardGame(
	game: CardGameDefinition,
	options: readonly string[],
	state: CardGameState,
	seat: number | null,
): CardView {
	return game.family === "shedding"
		? viewShedding(rulesOf(game, options), state as SheddingState, seat)
		: viewRummy(rulesOf(game, options), state as RummyState, seat);
}

export function botMove(
	game: CardGameDefinition,
	options: readonly string[],
	state: CardGameState,
	bots: readonly number[],
	random: Random = Math.random,
): BotMove<CardAction> | null {
	return game.family === "shedding"
		? botSheddingMove(
				rulesOf(game, options),
				state as SheddingState,
				bots,
				random,
			)
		: botRummyMove(rulesOf(game, options), state as RummyState, bots);
}

/** Rules a client needs to render hints, without shipping any game logic twice. */
export function resolvedRules(
	game: CardGameDefinition,
	options: readonly string[],
) {
	return game.family === "shedding"
		? { family: "shedding" as const, rules: rulesOf(game, options) }
		: { family: "rummy" as const, rules: rulesOf(game, options) };
}
