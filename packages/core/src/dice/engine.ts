/**
 * The dice-game engine: one contract over the dice rule families, so the
 * backend and the table UI never name a specific game. To add a game, write a
 * definition under `games/`, list it in `DICE_GAMES`, and add its text to
 * `games.dice.games` in both locales. A game that fits no family needs a new
 * family module and a table component, not a new backend.
 */
import type { FeltColor } from "../cards/engine";
import { GameRuleError } from "../errors";
import type { Rng } from "../random";
import {
	applyHouseRules,
	type BotMove,
	type HouseRule,
	normalizeHouseRules,
	type TableEngine,
} from "../table-engine";
import { tienduizend } from "./games/tienduizend";
import { yatzy } from "./games/yatzy";
import {
	applyPushluck,
	botPushluckMove,
	createPushluck,
	nextPushluckStarter,
	PUSHLUCK_ACTIONS,
	type PushluckAction,
	type PushluckRules,
	type PushluckState,
	type PushluckView,
	viewPushluck,
} from "./pushluck";
import {
	applyScoresheet,
	botScoresheetMove,
	createScoresheet,
	nextScoresheetStarter,
	SCORESHEET_ACTIONS,
	type ScoresheetAction,
	type ScoresheetRules,
	type ScoresheetState,
	type ScoresheetView,
	viewScoresheet,
} from "./scoresheet";

type Definition<Family extends string, Rules> = {
	id: string;
	family: Family;
	felt: FeltColor;
	/** The dice that show the game off on its menu tile. */
	showcase: readonly number[];
	players: { min: number; max: number };
	rules: Rules;
	/** House rules: each one is a patch over `rules`, off by default. */
	options: ReadonlyArray<HouseRule<Rules>>;
};

export type DiceGameDefinition =
	| Definition<"scoresheet", ScoresheetRules>
	| Definition<"pushluck", PushluckRules>;

export const DICE_GAMES = { yatzy, tienduizend } as const satisfies Record<
	string,
	DiceGameDefinition
>;

export type DiceGameId = keyof typeof DICE_GAMES;
export type DiceGame = (typeof DICE_GAMES)[DiceGameId];
export const DICE_GAME_IDS = Object.keys(DICE_GAMES) as DiceGameId[];

export function isDiceGameId(value: string): value is DiceGameId {
	return (DICE_GAME_IDS as string[]).includes(value);
}

export type DiceGameState = ScoresheetState | PushluckState;
export type DiceAction = ScoresheetAction | PushluckAction;
export type DiceView = ScoresheetView | PushluckView;

export function getDiceGame(id: string): DiceGame {
	if (!isDiceGameId(id)) {
		throw new GameRuleError("gameNotFound");
	}
	return DICE_GAMES[id];
}

type FamilyTypes = {
	scoresheet: {
		rules: ScoresheetRules;
		state: ScoresheetState;
		action: ScoresheetAction;
		view: ScoresheetView;
	};
	pushluck: {
		rules: PushluckRules;
		state: PushluckState;
		action: PushluckAction;
		view: PushluckView;
	};
};

type Family = keyof FamilyTypes;

/** Everything the engine asks of a dice family. */
type FamilyModule<F extends Family> = {
	actions: Record<FamilyTypes[F]["action"]["type"], true>;
	create: (
		rules: FamilyTypes[F]["rules"],
		seats: number,
		starter: number,
	) => FamilyTypes[F]["state"];
	nextStarter: (state: FamilyTypes[F]["state"]) => number;
	/** Every roll draws from `random`, which the server passes fresh on each move. */
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
	) => BotMove<FamilyTypes[F]["action"]> | null;
};

const FAMILIES: { [F in Family]: FamilyModule<F> } = {
	scoresheet: {
		actions: SCORESHEET_ACTIONS,
		create: createScoresheet,
		nextStarter: nextScoresheetStarter,
		apply: applyScoresheet,
		view: viewScoresheet,
		bot: botScoresheetMove,
	},
	pushluck: {
		actions: PUSHLUCK_ACTIONS,
		create: createPushluck,
		nextStarter: nextPushluckStarter,
		apply: applyPushluck,
		view: viewPushluck,
		bot: botPushluckMove,
	},
};

/** The one cast: a game id picks the family, and its state and actions belong to that family. */
function familyOf(family: Family) {
	return FAMILIES[family] as unknown as FamilyModule<Family>;
}

type Of<G extends DiceGameDefinition> = FamilyTypes[G["family"]];
type RulesOf<G extends DiceGameDefinition> = Of<G>["rules"];

/**
 * The game's rules with its chosen house rules applied. Narrow a game by its
 * `family` first to get that family's rules.
 */
export function diceRules<G extends DiceGameDefinition>(
	game: G,
	options: readonly string[],
): RulesOf<G> {
	return applyHouseRules<RulesOf<G>>(
		game as { rules: RulesOf<G>; options: G["options"] },
		options,
	);
}

/** The game's rules with its house rules applied, or null when it plays another family. */
export function familyRules<F extends Family>(
	game: DiceGameDefinition,
	options: readonly string[],
	family: F,
): FamilyTypes[F]["rules"] | null {
	return game.family === family
		? (diceRules(game, options) as FamilyTypes[F]["rules"])
		: null;
}

export function createDiceGame<G extends DiceGameDefinition>(
	game: G,
	options: readonly string[],
	seats: number,
	starter = 0,
): Of<G>["state"] {
	if (seats < game.players.min || seats > game.players.max) {
		throw new GameRuleError("notEnoughPlayers");
	}
	return familyOf(game.family).create(diceRules(game, options), seats, starter);
}

export function applyDiceAction<G extends DiceGameDefinition>(
	game: G,
	options: readonly string[],
	state: Of<G>["state"],
	seat: number,
	action: Of<G>["action"],
	random: Rng,
): Of<G>["state"] {
	const family = familyOf(game.family);
	if (!Object.keys(family.actions).includes(action.type)) {
		throw new GameRuleError("cardsWrongAction");
	}
	return family.apply(diceRules(game, options), state, seat, action, random);
}

/** What one seat may see; `null` is a spectator. */
export function viewDiceGame<G extends DiceGameDefinition>(
	game: G,
	options: readonly string[],
	state: Of<G>["state"],
	seat: number | null,
): Of<G>["view"] {
	return familyOf(game.family).view(diceRules(game, options), state, seat);
}

export function diceBotMove<G extends DiceGameDefinition>(
	game: G,
	options: readonly string[],
	state: Of<G>["state"],
	bots: readonly number[],
): BotMove<Of<G>["action"]> | null {
	return familyOf(game.family).bot(diceRules(game, options), state, bots);
}

/** The dice games as the Convex table module plays them. */
export const DICE_ENGINE: TableEngine<DiceGameState, DiceAction, DiceView> = {
	players: (gameId) => getDiceGame(gameId).players,
	normalizeOptions: (gameId, options) =>
		normalizeHouseRules(getDiceGame(gameId).options, options),
	create: (gameId, options, seats, _random, starter) =>
		createDiceGame(getDiceGame(gameId), options, seats, starter),
	apply: (gameId, options, state, seat, action, random) =>
		applyDiceAction(getDiceGame(gameId), options, state, seat, action, random),
	bot: (gameId, options, state, bots) =>
		diceBotMove(getDiceGame(gameId), options, state, bots),
	view: (gameId, options, state, seat) =>
		viewDiceGame(getDiceGame(gameId), options, state, seat),
	nextStarter: (state) => familyOf(state.family).nextStarter(state),
	outcome: (state) => ({
		finished: state.phase === "finished",
		winners: state.winners,
	}),
};
