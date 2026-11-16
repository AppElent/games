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
import { mexen } from "./games/mexen";
import { tienduizend } from "./games/tienduizend";
import { yatzy } from "./games/yatzy";
import {
	applyMexen,
	botMexenMove,
	createMexen,
	MEXEN_ACTIONS,
	type MexenAction,
	type MexenRules,
	type MexenState,
	type MexenView,
	nextMexenStarter,
	viewMexen,
} from "./mexen";
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

type FamilyTypes = {
	scoresheet: {
		rules: ScoresheetRules;
		state: ScoresheetState;
		action: ScoresheetAction;
		view: ScoresheetView;
	};
	mexen: {
		rules: MexenRules;
		state: MexenState;
		action: MexenAction;
		view: MexenView;
	};
	pushluck: {
		rules: PushluckRules;
		state: PushluckState;
		action: PushluckAction;
		view: PushluckView;
	};
};

type Family = keyof FamilyTypes;

/** A game of one family; `GameOf<Family>` takes a game of any family. */
type GameOf<F extends Family> = Definition<F, FamilyTypes[F]["rules"]>;

export type DiceGameDefinition = { [F in Family]: GameOf<F> }[Family];

export const DICE_GAMES = {
	yatzy,
	tienduizend,
	mexen,
} as const satisfies Record<string, DiceGameDefinition>;

export type DiceGameId = keyof typeof DICE_GAMES;
export type DiceGame = (typeof DICE_GAMES)[DiceGameId];
/** The games of one family, for screens that draw only that family. */
export type DiceGameOf<F extends Family> = Extract<DiceGame, { family: F }>;
export type ScoresheetGame = DiceGameOf<"scoresheet">;
export type MexenGame = DiceGameOf<"mexen">;
export type PushluckGame = DiceGameOf<"pushluck">;
export const DICE_GAME_IDS = Object.keys(DICE_GAMES) as DiceGameId[];

export function isDiceGameId(value: string): value is DiceGameId {
	return (DICE_GAME_IDS as string[]).includes(value);
}

export type DiceGameState = FamilyTypes[Family]["state"];
export type DiceAction = FamilyTypes[Family]["action"];
export type DiceView = FamilyTypes[Family]["view"];

export function getDiceGame(id: string): DiceGame {
	if (!isDiceGameId(id)) {
		throw new GameRuleError("gameNotFound");
	}
	return DICE_GAMES[id];
}

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
	mexen: {
		actions: MEXEN_ACTIONS,
		create: createMexen,
		nextStarter: nextMexenStarter,
		apply: applyMexen,
		view: viewMexen,
		bot: botMexenMove,
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

function familyOf<F extends Family>(family: F): FamilyModule<F> {
	return FAMILIES[family];
}

/** The game's rules with its chosen house rules applied. */
export function diceRules<F extends Family>(
	game: GameOf<F>,
	options: readonly string[],
): FamilyTypes[F]["rules"] {
	return applyHouseRules<FamilyTypes[F]["rules"]>(game, options);
}

export function createDiceGame<F extends Family>(
	game: GameOf<F>,
	options: readonly string[],
	seats: number,
	starter = 0,
): FamilyTypes[F]["state"] {
	if (seats < game.players.min || seats > game.players.max) {
		throw new GameRuleError("notEnoughPlayers");
	}
	return familyOf<F>(game.family).create(
		diceRules(game, options),
		seats,
		starter,
	);
}

export function applyDiceAction<F extends Family>(
	game: GameOf<F>,
	options: readonly string[],
	state: FamilyTypes[F]["state"],
	seat: number,
	action: DiceAction,
	random: Rng,
): FamilyTypes[F]["state"] {
	const family = familyOf<F>(game.family);
	if (!isFamilyAction(family, action)) {
		throw new GameRuleError("cardsWrongAction");
	}
	return family.apply(diceRules(game, options), state, seat, action, random);
}

function isFamilyAction<F extends Family>(
	family: FamilyModule<F>,
	action: DiceAction,
): action is FamilyTypes[F]["action"] {
	return Object.keys(family.actions).includes(action.type);
}

/** What one seat may see; `null` is a spectator. */
export function viewDiceGame<F extends Family>(
	game: GameOf<F>,
	options: readonly string[],
	state: FamilyTypes[F]["state"],
	seat: number | null,
): FamilyTypes[F]["view"] {
	return familyOf<F>(game.family).view(diceRules(game, options), state, seat);
}

export function diceBotMove<F extends Family>(
	game: GameOf<F>,
	options: readonly string[],
	state: FamilyTypes[F]["state"],
	bots: readonly number[],
): BotMove<FamilyTypes[F]["action"]> | null {
	return familyOf<F>(game.family).bot(diceRules(game, options), state, bots);
}

/**
 * The dice games as the Convex table module plays them. Here `F` widens to
 * every family, so the compiler no longer ties the state to the game: that
 * holds because a session's state is only ever made by `create` for that
 * session's own game id, which never changes.
 */
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
