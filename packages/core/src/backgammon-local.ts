/**
 * Pass-and-play backgammon on one device, as pure transitions, plus the saved
 * form of a match. Each app only adds where the save is stored.
 *
 * Dice are rolled by the caller and handed in with the actions that may need
 * them, so a transition is deterministic (React may run an updater twice). Only
 * moves enter the undo history; rolling and ending a turn do not.
 */
import {
	applyBackgammonPlan,
	type BackgammonMovePlan,
	type BackgammonTurnState,
	canEndBackgammonTurn,
	createInitialBackgammonState,
	getBackgammonWinner,
	isTurnSpent,
	switchBackgammonColor,
	withBackgammonDice,
} from "./backgammon";

export type BackgammonOptions = {
	showNumbers: boolean;
	autoRoll: boolean;
	autoSwitchTurn: boolean;
	autoCombine: boolean;
};

export const DEFAULT_BACKGAMMON_OPTIONS: BackgammonOptions = {
	showNumbers: true,
	autoRoll: false,
	autoSwitchTurn: true,
	autoCombine: true,
};

/** The server rolls when the player asks, so online games never auto-roll. */
export type OnlineOptions = Omit<BackgammonOptions, "autoRoll">;

export const DEFAULT_ONLINE_OPTIONS: OnlineOptions = {
	showNumbers: true,
	autoSwitchTurn: true,
	autoCombine: true,
};

const HISTORY_LIMIT = 60;

export type LocalMatch = {
	state: BackgammonTurnState;
	history: BackgammonTurnState[];
	future: BackgammonTurnState[];
	options: BackgammonOptions;
	updatedAt: number;
};

export type LocalMatchAction =
	| { type: "roll"; dice: number[] }
	| { type: "move"; plan: BackgammonMovePlan; dice: number[] }
	| { type: "endTurn"; dice: number[] }
	| { type: "undo" }
	| { type: "redo" }
	| {
			type: "setOption";
			key: keyof BackgammonOptions;
			value: boolean;
			dice: number[];
	  };

export function newLocalMatch(
	now: number,
	options: BackgammonOptions = DEFAULT_BACKGAMMON_OPTIONS,
): LocalMatch {
	return {
		state: createInitialBackgammonState(),
		history: [],
		future: [],
		options,
		updatedAt: now,
	};
}

/** Hands the turn over, rolling for the next player when asked to. */
function passTurn(
	state: BackgammonTurnState,
	options: BackgammonOptions,
	dice: number[],
): BackgammonTurnState {
	return withBackgammonDice(
		{ ...state, activeColor: switchBackgammonColor(state.activeColor) },
		options.autoRoll ? dice : [],
	);
}

export function reduceLocalMatch(
	match: LocalMatch,
	action: LocalMatchAction,
	now: number,
): LocalMatch {
	const { state, options } = match;
	const finished = getBackgammonWinner(state.off) !== null;
	const touch = (next: Partial<LocalMatch>): LocalMatch => ({
		...match,
		...next,
		updatedAt: now,
	});
	switch (action.type) {
		case "roll":
			if (finished || state.dice.length > 0) return match;
			return touch({ state: withBackgammonDice(state, action.dice) });
		case "endTurn":
			if (finished || !canEndBackgammonTurn(state)) return match;
			return touch({ state: passTurn(state, options, action.dice) });
		case "move": {
			if (finished) return match;
			const moved = applyBackgammonPlan(state, action.plan);
			return touch({
				state:
					options.autoSwitchTurn && isTurnSpent(moved)
						? passTurn(moved, options, action.dice)
						: moved,
				history: [...match.history, state].slice(-HISTORY_LIMIT),
				future: [],
			});
		}
		case "undo": {
			const previous = match.history.at(-1);
			if (!previous) return match;
			return touch({
				state: previous,
				history: match.history.slice(0, -1),
				future: [...match.future, state],
			});
		}
		case "redo": {
			const next = match.future.at(-1);
			if (!next) return match;
			return touch({
				state: next,
				history: [...match.history, state],
				future: match.future.slice(0, -1),
			});
		}
		case "setOption": {
			// Turning auto-roll on mid-turn rolls for the waiting player.
			const rollNow =
				action.key === "autoRoll" &&
				action.value &&
				!finished &&
				state.dice.length === 0;
			return touch({
				options: { ...options, [action.key]: action.value },
				state: rollNow ? withBackgammonDice(state, action.dice) : state,
			});
		}
	}
}

function isLocalMatch(value: unknown): value is LocalMatch {
	const match = value as LocalMatch | null;
	return (
		typeof match === "object" &&
		match !== null &&
		Array.isArray(match.state?.points) &&
		match.state.points.length === 24 &&
		Array.isArray(match.history) &&
		Array.isArray(match.future)
	);
}

/** Reads a saved match, or `null` when the text is not one. */
export function parseLocalMatch(raw: string): LocalMatch | null {
	try {
		const parsed: unknown = JSON.parse(raw);
		if (!isLocalMatch(parsed)) return null;
		return {
			...parsed,
			options: { ...DEFAULT_BACKGAMMON_OPTIONS, ...parsed.options },
		};
	} catch {
		return null;
	}
}
