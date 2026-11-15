/**
 * The card-game engine: one contract over the rule families, so the backend
 * and the table UI never name a specific game. To add a game, write a
 * definition under `games/`, list it in `CARD_GAMES`, and add its text to
 * `games.cards.games` in both locales. A game that fits no family needs a new
 * family module and a table component, not a new backend.
 */
import { GameRuleError } from "../errors";
import type { Rng } from "../random";
import { boerenbridge } from "./games/boerenbridge";
import { hartenjagen } from "./games/hartenjagen";
import { jokeren } from "./games/jokeren";
import { maumau } from "./games/maumau";
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
import {
	applyTricks,
	botTricksMove,
	createTricks,
	nextTricksStarter,
	TRICKS_ACTIONS,
	type TricksAction,
	type TricksRules,
	type TricksState,
	type TricksView,
	viewTricks,
} from "./tricks";

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
	options: ReadonlyArray<HouseRule<Rules>>;
};

export type HouseRule<Rules> = {
	id: string;
	patch?: Partial<Rules>;
	/**
	 * Special cards this rule turns into plain cards (keys of `rules.powers`).
	 * Several such rules combine, which a `patch` on `powers` could not.
	 */
	withoutPowers?: readonly string[];
};

export type CardGameDefinition =
	| Definition<"shedding", SheddingRules>
	| Definition<"rummy", RummyRules>
	| Definition<"tricks", TricksRules>;

/** How long a player can go without a heartbeat before others may hand their seat to autopilot. */
export const SEAT_SILENT_AFTER_MS = 60_000;

export const CARD_GAMES = {
	pesten,
	maumau,
	jokeren,
	hartenjagen,
	boerenbridge,
} as const satisfies Record<string, CardGameDefinition>;

export type CardGameId = keyof typeof CARD_GAMES;
/** A listed game: a definition whose `id` is one of `CARD_GAME_IDS`. */
export type CardGame = (typeof CARD_GAMES)[CardGameId];
export const CARD_GAME_IDS = Object.keys(CARD_GAMES) as CardGameId[];

export function isCardGameId(value: string): value is CardGameId {
	return (CARD_GAME_IDS as string[]).includes(value);
}

export type CardGameState = SheddingState | RummyState | TricksState;
export type CardAction = SheddingAction | RummyAction | TricksAction;
type CardView = SheddingView | RummyView | TricksView;

export function getCardGame(id: string): CardGame {
	if (!isCardGameId(id)) {
		throw new GameRuleError("gameNotFound");
	}
	return CARD_GAMES[id];
}

function houseRules(game: CardGameDefinition) {
	return game.options as ReadonlyArray<HouseRule<unknown>>;
}

/** Two house rules that patch the same rule field can't both apply. */
function clash(a: HouseRule<unknown>, b: HouseRule<unknown>) {
	const fields = Object.keys(a.patch ?? {});
	return (
		a.id !== b.id &&
		Object.keys(b.patch ?? {}).some((field) => fields.includes(field))
	);
}

/** Validates house-rule ids; unknown or clashing ones are a client error. */
export function normalizeOptions(game: CardGameDefinition, options: string[]) {
	const known = game.options.map((option) => option.id as string);
	for (const option of options) {
		if (!known.includes(option)) {
			throw new GameRuleError("cardsUnknownOption");
		}
	}
	const chosen = houseRules(game).filter((option) =>
		options.includes(option.id),
	);
	if (chosen.some((a) => chosen.some((b) => clash(a, b)))) {
		throw new GameRuleError("cardsOptionsClash");
	}
	return known.filter((id) => options.includes(id));
}

/**
 * The options after switching one on or off. Switching one on switches off
 * any that change the same rule (only going up, only going down).
 */
export function switchOption(
	game: CardGameDefinition,
	options: readonly string[],
	id: string,
	on: boolean,
) {
	const rest = options.filter((option) => option !== id);
	const option = houseRules(game).find((rule) => rule.id === id);
	if (!on || !option) {
		return rest;
	}
	const clashing = houseRules(game)
		.filter((other) => clash(option, other))
		.map((other) => other.id);
	return [...rest.filter((other) => !clashing.includes(other)), id];
}

function rulesOf<R>(
	game: { rules: R; options: ReadonlyArray<HouseRule<R>> },
	options: readonly string[],
): R {
	let rules = game.rules;
	for (const option of game.options) {
		if (!options.includes(option.id)) {
			continue;
		}
		rules = { ...rules, ...option.patch };
		const powers = (rules as { powers?: Record<string, unknown> }).powers;
		if (option.withoutPowers && powers) {
			const kept = { ...powers };
			for (const key of option.withoutPowers) {
				delete kept[key];
			}
			rules = { ...rules, powers: kept };
		}
	}
	return rules;
}

/** The house rule that turns this special card into a plain one, if the game has it. */
export function plainCardOption(game: CardGameDefinition, power: string) {
	return (game.options as ReadonlyArray<HouseRule<unknown>>).find((option) =>
		option.withoutPowers?.includes(power),
	);
}

/** House rules that are not about a single special card. */
export function generalOptions(game: CardGameDefinition) {
	return (game.options as ReadonlyArray<HouseRule<unknown>>).filter(
		(option) => !option.withoutPowers,
	);
}

function rulesFor(game: CardGameDefinition, options: readonly string[]) {
	return rulesOf<SheddingRules | RummyRules | TricksRules>(game, options);
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
	tricks: {
		rules: TricksRules;
		state: TricksState;
		action: TricksAction;
		view: TricksView;
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
	tricks: {
		actions: TRICKS_ACTIONS,
		create: createTricks,
		nextStarter: nextTricksStarter,
		apply: applyTricks,
		view: viewTricks,
		bot: botTricksMove,
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

type RulesOf = { [R in ResolvedRules as R["family"]]: R["rules"] };

/** The game's rules with its house options applied, or null when it plays another family. */
export function familyRules<F extends Family>(
	game: CardGameDefinition,
	options: readonly string[],
	family: F,
): RulesOf[F] | null {
	const resolved = resolvedRules(game, options);
	return resolved.family === family ? (resolved.rules as RulesOf[F]) : null;
}
