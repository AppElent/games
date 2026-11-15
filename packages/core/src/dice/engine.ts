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
import { yatzy } from "./games/yatzy";
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

export type DiceGameDefinition = Definition<"scoresheet", ScoresheetRules>;

export const DICE_GAMES = { yatzy } as const satisfies Record<
	string,
	DiceGameDefinition
>;

export type DiceGameId = keyof typeof DICE_GAMES;
export type DiceGame = (typeof DICE_GAMES)[DiceGameId];
export const DICE_GAME_IDS = Object.keys(DICE_GAMES) as DiceGameId[];

export function isDiceGameId(value: string): value is DiceGameId {
	return (DICE_GAME_IDS as string[]).includes(value);
}

export type DiceGameState = ScoresheetState;
export type DiceAction = ScoresheetAction;
export type DiceView = ScoresheetView;

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
};

type Family = keyof FamilyTypes;

/** Everything the engine asks of a dice family. */
type FamilyModule<F extends Family> = {
	actions: Record<FamilyTypes[F]["action"]["type"], true>;
	create: (
		rules: FamilyTypes[F]["rules"],
		seats: number,
		random: Rng,
		starter: number,
	) => FamilyTypes[F]["state"];
	nextStarter: (state: FamilyTypes[F]["state"]) => number;
	/** Rolls come from the state's own seed, so no `random` reaches a move. */
	apply: (
		rules: FamilyTypes[F]["rules"],
		state: FamilyTypes[F]["state"],
		seat: number,
		action: FamilyTypes[F]["action"],
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
};

function familyOf(family: Family) {
	return FAMILIES[family];
}

/** The game's rules with its chosen house rules applied. */
export function diceRules(
	game: DiceGameDefinition,
	options: readonly string[],
): ScoresheetRules {
	return applyHouseRules<ScoresheetRules>(game, options);
}

export function createDiceGame(
	game: DiceGameDefinition,
	options: readonly string[],
	seats: number,
	random: Rng = Math.random,
	starter = 0,
): DiceGameState {
	if (seats < game.players.min || seats > game.players.max) {
		throw new GameRuleError("notEnoughPlayers");
	}
	return familyOf(game.family).create(
		diceRules(game, options),
		seats,
		random,
		starter,
	);
}

export function applyDiceAction(
	game: DiceGameDefinition,
	options: readonly string[],
	state: DiceGameState,
	seat: number,
	action: DiceAction,
): DiceGameState {
	const family = familyOf(game.family);
	if (!Object.keys(family.actions).includes(action.type)) {
		throw new GameRuleError("cardsWrongAction");
	}
	return family.apply(diceRules(game, options), state, seat, action);
}

/** What one seat may see; `null` is a spectator. Never includes the dice seed. */
export function viewDiceGame(
	game: DiceGameDefinition,
	options: readonly string[],
	state: DiceGameState,
	seat: number | null,
): DiceView {
	return familyOf(game.family).view(diceRules(game, options), state, seat);
}

export function diceBotMove(
	game: DiceGameDefinition,
	options: readonly string[],
	state: DiceGameState,
	bots: readonly number[],
): BotMove<DiceAction> | null {
	return familyOf(game.family).bot(diceRules(game, options), state, bots);
}

/** The dice games as the Convex table module plays them. */
export const DICE_ENGINE: TableEngine<DiceGameState, DiceAction, DiceView> = {
	players: (gameId) => getDiceGame(gameId).players,
	normalizeOptions: (gameId, options) =>
		normalizeHouseRules(getDiceGame(gameId).options, options),
	create: (gameId, options, seats, random, starter) =>
		createDiceGame(getDiceGame(gameId), options, seats, random, starter),
	apply: (gameId, options, state, seat, action) =>
		applyDiceAction(getDiceGame(gameId), options, state, seat, action),
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
