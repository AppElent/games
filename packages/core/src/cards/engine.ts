/**
 * The card-game engine: one contract over the rule families, so the backend
 * and the table UI never name a specific game. To add a game, write a
 * definition under `games/`, list it in `CARD_GAMES`, and add its text to
 * `games.cards.games` in both locales. A game that fits no family needs a new
 * family module and a table component, not a new backend.
 */
import { GameRuleError } from "../errors";
import type { Rng } from "../random";
import { jokeren } from "./games/jokeren";
import { pesten } from "./games/pesten";
import {
	applyRummy,
	botRummyMove,
	nextRummyStarter,
	RUMMY_ACTIONS,
	type RummyAction,
	type RummyRules,
	type RummyState,
	type RummyView,
	startRummy,
	viewRummy,
} from "./rummy";
import {
	applyShedding,
	botSheddingMove,
	createShedding,
	nextSheddingStarter,
	SHEDDING_ACTIONS,
	type SheddingAction,
	type SheddingRules,
	type SheddingState,
	type SheddingView,
	viewShedding,
} from "./shedding";
import type { BotMove } from "./table";

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
/** A listed game: a definition whose `id` is one of `CARD_GAME_IDS`. */
export type CardGame = (typeof CARD_GAMES)[CardGameId];
export const CARD_GAME_IDS = Object.keys(CARD_GAMES) as CardGameId[];

export function isCardGameId(value: string): value is CardGameId {
	return (CARD_GAME_IDS as string[]).includes(value);
}

export type CardGameState = SheddingState | RummyState;
export type CardAction = SheddingAction | RummyAction;
type CardView = SheddingView | RummyView;

export function getCardGame(id: string): CardGame {
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

function rulesFor(game: CardGameDefinition, options: readonly string[]) {
	return rulesOf<SheddingRules | RummyRules>(game, options);
}

type FamilyTypes = {
	shedding: {
		rules: SheddingRules;
		state: SheddingState;
		action: SheddingAction;
		view: SheddingView;
	};
	rummy: {
		rules: RummyRules;
		state: RummyState;
		action: RummyAction;
		view: RummyView;
	};
};

type Family = keyof FamilyTypes;

/** Everything the engine asks of a rule family. */
type FamilyModule<F extends Family> = {
	actions: Record<FamilyTypes[F]["action"]["type"], true>;
	create: (
		rules: FamilyTypes[F]["rules"],
		seats: number,
		random: Rng,
		starter: number,
	) => FamilyTypes[F]["state"];
	nextStarter: (state: FamilyTypes[F]["state"]) => number;
	apply: (
		rules: FamilyTypes[F]["rules"],
		state: FamilyTypes[F]["state"],
		seat: number,
		action: FamilyTypes[F]["action"],
		random: Rng,
	) => FamilyTypes[F]["state"];
	view: (
		rules: FamilyTypes[F]["rules"],
		state: FamilyTypes[F]["state"],
		seat: number | null,
	) => FamilyTypes[F]["view"];
	bot: (
		rules: FamilyTypes[F]["rules"],
		state: FamilyTypes[F]["state"],
		bots: readonly number[],
		random: Rng,
	) => BotMove<FamilyTypes[F]["action"]> | null;
};

const FAMILIES: { [F in Family]: FamilyModule<F> } = {
	shedding: {
		actions: SHEDDING_ACTIONS,
		create: createShedding,
		nextStarter: nextSheddingStarter,
		apply: applyShedding,
		view: viewShedding,
		bot: botSheddingMove,
	},
	rummy: {
		actions: RUMMY_ACTIONS,
		create: startRummy,
		nextStarter: nextRummyStarter,
		apply: applyRummy,
		view: viewRummy,
		bot: botRummyMove,
	},
};

/** The one cast: a game id picks the family, and its state and actions belong to that family. */
function familyOf(family: Family) {
	return FAMILIES[family] as unknown as FamilyModule<Family>;
}

export function createCardGame(
	game: CardGameDefinition,
	options: readonly string[],
	seats: number,
	random: Rng = Math.random,
	starter = 0,
): CardGameState {
	if (seats < game.players.min || seats > game.players.max) {
		throw new GameRuleError("notEnoughPlayers");
	}
	return familyOf(game.family).create(
		rulesFor(game, options),
		seats,
		random,
		starter,
	);
}

/** Who leads the rematch: the next seat along, so the lead goes round the table. */
export function nextStarter(state: CardGameState) {
	return familyOf(state.family).nextStarter(state);
}

export function applyCardAction(
	game: CardGameDefinition,
	options: readonly string[],
	state: CardGameState,
	seat: number,
	action: CardAction,
	random: Rng = Math.random,
): CardGameState {
	const family = familyOf(game.family);
	if (!Object.keys(family.actions).includes(action.type)) {
		throw new GameRuleError("cardsWrongAction");
	}
	return family.apply(rulesFor(game, options), state, seat, action, random);
}

/** What one seat may see; `null` is a spectator. Never includes other hands. */
export function viewCardGame(
	game: CardGameDefinition,
	options: readonly string[],
	state: CardGameState,
	seat: number | null,
): CardView {
	return familyOf(game.family).view(rulesFor(game, options), state, seat);
}

export function botMove(
	game: CardGameDefinition,
	options: readonly string[],
	state: CardGameState,
	bots: readonly number[],
	random: Rng = Math.random,
): BotMove<CardAction> | null {
	return familyOf(game.family).bot(
		rulesFor(game, options),
		state,
		bots,
		random,
	);
}

type ResolvedRules = {
	[F in Family]: { family: F; rules: FamilyTypes[F]["rules"] };
}[Family];

/** Rules a client needs to render hints, without shipping any game logic twice. */
export function resolvedRules(
	game: CardGameDefinition,
	options: readonly string[],
) {
	return {
		family: game.family,
		rules: rulesFor(game, options),
	} as ResolvedRules;
}
