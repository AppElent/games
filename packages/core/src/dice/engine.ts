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
import {
	applyBidding,
	BIDDING_ACTIONS,
	type BiddingAction,
	type BiddingRules,
	type BiddingState,
	type BiddingView,
	botBiddingMove,
	createBidding,
	nextBiddingStarter,
	viewBidding,
} from "./bidding";
import { liarsDice } from "./games/liars-dice";
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
	/** House rules: each one is a patch over `rules`, off unless marked `on`. */
	options: ReadonlyArray<HouseRule<Rules>>;
};

export type DiceGameDefinition =
	| Definition<"scoresheet", ScoresheetRules>
	| Definition<"bidding", BiddingRules>;

export const DICE_GAMES = {
	yatzy,
	"liars-dice": liarsDice,
} as const satisfies Record<string, DiceGameDefinition>;

export type DiceGameId = keyof typeof DICE_GAMES;
export type DiceGame = (typeof DICE_GAMES)[DiceGameId];
/** The listed games that play one rule family. */
export type DiceGameOf<F extends DiceGame["family"]> = Extract<
	DiceGame,
	{ family: F }
>;
export const DICE_GAME_IDS = Object.keys(DICE_GAMES) as DiceGameId[];

export function isDiceGameId(value: string): value is DiceGameId {
	return (DICE_GAME_IDS as string[]).includes(value);
}

export type DiceGameState = ScoresheetState | BiddingState;
export type DiceAction = ScoresheetAction | BiddingAction;
export type DiceView = ScoresheetView | BiddingView;

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
	bidding: {
		rules: BiddingRules;
		state: BiddingState;
		action: BiddingAction;
		view: BiddingView;
	};
};

type Family = keyof FamilyTypes;

/** Everything the engine asks of a dice family. */
type FamilyModule<F extends Family> = {
	actions: Record<FamilyTypes[F]["action"]["type"], true>;
	/** A family that starts with dice on the table rolls them from `random`. */
	create: (
		rules: FamilyTypes[F]["rules"],
		seats: number,
		starter: number,
		random: Rng,
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
		random: Rng,
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
	bidding: {
		actions: BIDDING_ACTIONS,
		create: createBidding,
		nextStarter: nextBiddingStarter,
		apply: applyBidding,
		view: viewBidding,
		bot: botBiddingMove,
	},
};

/** The one cast: a game id picks the family, and its state and actions belong to that family. */
function familyOf(family: Family) {
	return FAMILIES[family] as unknown as FamilyModule<Family>;
}

type RulesOf<G> = G extends { rules: infer R } ? R : never;

/** The game's rules with its chosen house rules applied. */
export function diceRules<G extends DiceGameDefinition>(
	game: G,
	options: readonly string[],
): RulesOf<G> {
	return applyHouseRules(
		game as unknown as {
			rules: RulesOf<G>;
			options: ReadonlyArray<HouseRule<RulesOf<G>>>;
		},
		options,
	);
}

export function createDiceGame(
	game: DiceGameDefinition,
	options: readonly string[],
	seats: number,
	starter = 0,
	random: Rng = Math.random,
): DiceGameState {
	if (seats < game.players.min || seats > game.players.max) {
		throw new GameRuleError("notEnoughPlayers");
	}
	return familyOf(game.family).create(
		diceRules(game, options),
		seats,
		starter,
		random,
	);
}

export function applyDiceAction(
	game: DiceGameDefinition,
	options: readonly string[],
	state: DiceGameState,
	seat: number,
	action: DiceAction,
	random: Rng,
): DiceGameState {
	const family = familyOf(game.family);
	if (!Object.keys(family.actions).includes(action.type)) {
		throw new GameRuleError("cardsWrongAction");
	}
	return family.apply(diceRules(game, options), state, seat, action, random);
}

/** What one seat may see; `null` is a spectator. */
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
	random: Rng = Math.random,
): BotMove<DiceAction> | null {
	return familyOf(game.family).bot(
		diceRules(game, options),
		state,
		bots,
		random,
	);
}

/** The dice games as the Convex table module plays them. */
export const DICE_ENGINE: TableEngine<DiceGameState, DiceAction, DiceView> = {
	players: (gameId) => getDiceGame(gameId).players,
	normalizeOptions: (gameId, options) =>
		normalizeHouseRules(getDiceGame(gameId).options, options),
	create: (gameId, options, seats, random, starter) =>
		createDiceGame(getDiceGame(gameId), options, seats, starter, random),
	apply: (gameId, options, state, seat, action, random) =>
		applyDiceAction(getDiceGame(gameId), options, state, seat, action, random),
	bot: (gameId, options, state, bots, random) =>
		diceBotMove(getDiceGame(gameId), options, state, bots, random),
	view: (gameId, options, state, seat) =>
		viewDiceGame(getDiceGame(gameId), options, state, seat),
	nextStarter: (state) => familyOf(state.family).nextStarter(state),
	outcome: (state) => ({
		finished: state.phase === "finished",
		winners: state.winners,
	}),
};
