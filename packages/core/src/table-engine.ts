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
	/** Rules in the same group exclude each other, such as match lengths. */
	group?: string;
};

type HouseRuleId = { id: string; group?: string };

export type BotMove<Action> = {
	seat: number;
	action: Action;
	/** A new turn, the rest of a turn already under way, or a reply to someone else. */
	pace: "turn" | "followUp" | "reaction";
};

/**
 * Validates house-rule ids against a game's options; unknown ones, or two from
 * one group, are a client error. Returns them in the game's own order, each once.
 */
export function normalizeHouseRules(
	options: ReadonlyArray<HouseRuleId>,
	chosen: readonly string[],
) {
	for (const id of chosen) {
		if (!options.some((option) => option.id === id)) {
			throw new GameRuleError("cardsUnknownOption");
		}
	}
	const picked = options.filter((option) => chosen.includes(option.id));
	const groups = picked.flatMap((option) =>
		option.group ? [option.group] : [],
	);
	if (new Set(groups).size < groups.length) {
		throw new GameRuleError("cardsOptionsClash");
	}
	return picked.map((option) => option.id);
}

/** Turns one house rule on or off; turning one on turns off the rest of its group. */
export function setHouseRule(
	options: ReadonlyArray<HouseRuleId>,
	chosen: readonly string[],
	id: string,
	on: boolean,
): string[] {
	const rest = chosen.filter((option) => option !== id);
	if (!on) {
		return rest;
	}
	const group = options.find((option) => option.id === id)?.group;
	const rivals = options
		.filter((option) => group !== undefined && option.group === group)
		.map((option) => option.id);
	return [...rest.filter((option) => !rivals.includes(option)), id];
}

/** Flips one house rule, as a switch tap does. */
export function toggleHouseRule(
	options: ReadonlyArray<HouseRuleId>,
	chosen: readonly string[],
	id: string,
) {
	return setHouseRule(options, chosen, id, !chosen.includes(id));
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
