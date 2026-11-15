/**
 * What every table game shares, cards and dice alike: house rules over a
 * game's config, the bot's next move, and the one contract the Convex table
 * module plays through (`convex/lib/tableGames.ts`). Nothing here names a
 * family or a game.
 */
import { GameRuleError } from "./errors";
import type { Rng } from "./random";

/** How long a player can go without a heartbeat before others may hand their seat to autopilot. */
export const SEAT_SILENT_AFTER_MS = 60_000;

/** Only a person can go quiet, and an autopilot seat keeps playing regardless. */
export function seatIsSilent(
	seat: {
		botIndex: number | null;
		autopilot: boolean;
		lastSeen: number | null;
	},
	now: number,
) {
	return (
		seat.botIndex === null &&
		!seat.autopilot &&
		seat.lastSeen !== null &&
		now - seat.lastSeen > SEAT_SILENT_AFTER_MS
	);
}

/** Where a stored table is: seating players, playing, or done. */
export const TABLE_STATUSES = ["lobby", "playing", "finished"] as const;

/** A house rule: a patch over a game's `rules`, off by default. */
export type HouseRule<Rules> = {
	id: string;
	patch?: Partial<Rules>;
};

export type BotMove<Action> = {
	seat: number;
	action: Action;
	/** A new turn, the rest of a turn already under way, or a reply to someone else. */
	pace: "turn" | "followUp" | "reaction";
};

/**
 * Validates house-rule ids against a game's options; unknown ones are a client
 * error. Returns them in the game's own order, each once.
 */
export function normalizeHouseRules(
	options: ReadonlyArray<{ id: string }>,
	chosen: readonly string[],
) {
	const known = options.map((option) => option.id);
	for (const option of chosen) {
		if (!known.includes(option)) {
			throw new GameRuleError("cardsUnknownOption");
		}
	}
	return known.filter((id) => chosen.includes(id));
}

/** A game's rules with the chosen house rules patched over them, in the game's order. */
export function applyHouseRules<Rules>(
	game: { rules: Rules; options: ReadonlyArray<HouseRule<Rules>> },
	chosen: readonly string[],
): Rules {
	let rules = game.rules;
	for (const option of game.options) {
		if (chosen.includes(option.id)) {
			rules = { ...rules, ...option.patch };
		}
	}
	return rules;
}

/** The end of a game as the table module records it. */
export type TableOutcome = { finished: boolean; winners: readonly number[] };

/**
 * Everything the Convex table module asks of a set of games. Each method
 * takes the game id and its house rules as stored on the table; the engine
 * owns validation, so a bad id or option is a `GameRuleError`.
 */
export type TableEngine<State, Action, View> = {
	players: (gameId: string) => { min: number; max: number };
	normalizeOptions: (gameId: string, options: readonly string[]) => string[];
	create: (
		gameId: string,
		options: readonly string[],
		seats: number,
		random: Rng,
		starter?: number,
	) => State;
	apply: (
		gameId: string,
		options: readonly string[],
		state: State,
		seat: number,
		action: Action,
		random: Rng,
	) => State;
	bot: (
		gameId: string,
		options: readonly string[],
		state: State,
		bots: readonly number[],
		random: Rng,
	) => BotMove<Action> | null;
	/** What one seat may see; `null` is a spectator. */
	view: (
		gameId: string,
		options: readonly string[],
		state: State,
		seat: number | null,
	) => View;
	/** Who starts the rematch. */
	nextStarter: (state: State) => number;
	outcome: (state: State) => TableOutcome;
};
