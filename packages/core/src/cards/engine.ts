/**
 * The card-game engine: one contract over the rule families, so the backend
 * and the table UI never name a specific game. To add a game, write a
 * definition under `games/`, list it in `CARD_GAMES`, and add its text to
 * `games.cards.games` in both locales. A game that fits no family needs a new
 * family module and a table component, not a new backend.
 */
import { GameRuleError } from "../errors";
import type { Rng } from "../random";
import {
	type HouseRule as BaseHouseRule,
	type BotMove,
	normalizeHouseRules,
	type TableEngine,
} from "../table-engine";
import {
	applyBank,
	BANK_ACTIONS,
	type BankAction,
	type BankRules,
	type BankState,
	type BankView,
	botBankMove,
	createBank,
	nextBankStarter,
	viewBank,
} from "./bank";
import { boerenbridge } from "./games/boerenbridge";
import { eenentwintigen } from "./games/eenentwintigen";
import { ginRummy } from "./games/gin-rummy";
import { hartenjagen } from "./games/hartenjagen";
import { jokeren } from "./games/jokeren";
import { klaverjassen } from "./games/klaverjassen";
import { maumau } from "./games/maumau";
import { pesten } from "./games/pesten";
import { toepen } from "./games/toepen";
import {
	applyGin,
	botGinMove,
	GIN_ACTIONS,
	type GinAction,
	type GinRules,
	type GinState,
	type GinView,
	nextGinStarter,
	startGin,
	viewGin,
} from "./gin";
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

export type HouseRule<Rules> = BaseHouseRule<Rules> & {
	/**
	 * Special cards this rule turns into plain cards (keys of `rules.powers`).
	 * Several such rules combine, which a `patch` on `powers` could not.
	 */
	withoutPowers?: readonly string[];
	/**
	 * Items added to list fields of `rules`. Several such rules combine (two
	 * kinds of hand that may be swapped), which a `patch` would overwrite.
	 */
	append?: { readonly [K in keyof Rules]?: ListField<Rules[K]> };
};

type ListField<Field> =
	NonNullable<Field> extends readonly unknown[] ? NonNullable<Field> : never;

export type CardGameDefinition =
	| Definition<"shedding", SheddingRules>
	| Definition<"rummy", RummyRules>
	| Definition<"bank", BankRules>
	| Definition<"tricks", TricksRules>
	| Definition<"gin", GinRules>;

export const CARD_GAMES = {
	pesten,
	maumau,
	jokeren,
	eenentwintigen,
	hartenjagen,
	toepen,
	klaverjassen,
	boerenbridge,
	"gin-rummy": ginRummy,
} as const satisfies Record<string, CardGameDefinition>;

export type CardGameId = keyof typeof CARD_GAMES;
/** A listed game: a definition whose `id` is one of `CARD_GAME_IDS`. */
export type CardGame = (typeof CARD_GAMES)[CardGameId];
export const CARD_GAME_IDS = Object.keys(CARD_GAMES) as CardGameId[];

export function isCardGameId(value: string): value is CardGameId {
	return (CARD_GAME_IDS as string[]).includes(value);
}

export type CardGameState =
	| SheddingState
	| RummyState
	| BankState
	| TricksState
	| GinState;
export type CardAction =
	| SheddingAction
	| RummyAction
	| BankAction
	| TricksAction
	| GinAction;
type CardView = SheddingView | RummyView | BankView | TricksView | GinView;

export function getCardGame(id: string): CardGame {
	if (!isCardGameId(id)) {
		throw new GameRuleError("gameNotFound");
	}
	return CARD_GAMES[id];
}

/** Validates house-rule ids; unknown ones are a client error. */
export function normalizeOptions(
	game: CardGameDefinition,
	options: readonly string[],
) {
	return normalizeHouseRules(game.options, options);
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
		for (const [key, items] of Object.entries(option.append ?? {})) {
			const field = (rules as Record<string, unknown>)[key];
			rules = {
				...rules,
				[key]: [...((field as readonly unknown[]) ?? []), ...(items as [])],
			};
		}
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

function houseRules(game: CardGameDefinition) {
	return game.options as ReadonlyArray<HouseRule<unknown>>;
}

/** The house rule that turns this special card into a plain one, if the game has it. */
export function plainCardOption(game: CardGameDefinition, power: string) {
	return houseRules(game).find((option) =>
		option.withoutPowers?.includes(power),
	);
}

/** House rules that are not about a single special card. */
export function generalOptions(game: CardGameDefinition) {
	return houseRules(game).filter((option) => !option.withoutPowers);
}

function rulesFor(game: CardGameDefinition, options: readonly string[]) {
	return rulesOf<
		SheddingRules | RummyRules | BankRules | TricksRules | GinRules
	>(game, options);
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
	bank: {
		rules: BankRules;
		state: BankState;
		action: BankAction;
		view: BankView;
	};
	tricks: {
		rules: TricksRules;
		state: TricksState;
		action: TricksAction;
		view: TricksView;
	};
	gin: {
		rules: GinRules;
		state: GinState;
		action: GinAction;
		view: GinView;
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
	bank: {
		actions: BANK_ACTIONS,
		create: createBank,
		nextStarter: nextBankStarter,
		apply: applyBank,
		view: viewBank,
		bot: botBankMove,
	},
	tricks: {
		actions: TRICKS_ACTIONS,
		create: createTricks,
		nextStarter: nextTricksStarter,
		apply: applyTricks,
		view: viewTricks,
		bot: botTricksMove,
	},
	gin: {
		actions: GIN_ACTIONS,
		create: startGin,
		nextStarter: nextGinStarter,
		apply: applyGin,
		view: viewGin,
		bot: botGinMove,
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

/** What one seat may see; `null` is a spectator. Never includes a hand the rules keep hidden. */
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

/** The card games as the Convex table module plays them. */
export const CARD_ENGINE: TableEngine<CardGameState, CardAction, CardView> = {
	players: (gameId) => getCardGame(gameId).players,
	normalizeOptions: (gameId, options) =>
		normalizeOptions(getCardGame(gameId), options),
	create: (gameId, options, seats, random, starter) =>
		createCardGame(getCardGame(gameId), options, seats, random, starter),
	apply: (gameId, options, state, seat, action, random) =>
		applyCardAction(getCardGame(gameId), options, state, seat, action, random),
	bot: (gameId, options, state, bots, random) =>
		botMove(getCardGame(gameId), options, state, bots, random),
	view: (gameId, options, state, seat) =>
		viewCardGame(getCardGame(gameId), options, state, seat),
	nextStarter,
	outcome: (state) => ({
		finished: state.phase === "finished",
		winners: state.winners,
	}),
};
