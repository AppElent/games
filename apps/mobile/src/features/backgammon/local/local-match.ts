/**
 * Pass-and-play backgammon on one phone, as pure transitions.
 *
 * Dice are rolled by the caller and handed in, so a transition is
 * deterministic (React may run an updater twice) and testable. Only moves
 * enter the undo history; rolling and ending a turn do not.
 */
import {
	applyBackgammonPlan,
	type BackgammonMovePlan,
	type BackgammonTurnState,
	createInitialBackgammonState,
	getBackgammonWinner,
	switchBackgammonColor,
} from "@games/core/backgammon";

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

export const HISTORY_LIMIT = 60;

export type LocalMatch = {
	state: BackgammonTurnState;
	history: BackgammonTurnState[];
	future: BackgammonTurnState[];
	options: BackgammonOptions;
	updatedAt: number;
};

export type LocalMatchAction =
	| { type: "roll" }
	| { type: "move"; plan: BackgammonMovePlan }
	| { type: "endTurn" }
	| { type: "undo" }
	| { type: "redo" }
	| { type: "setOption"; key: keyof BackgammonOptions; value: boolean };

export function newLocalMatch(
	options: BackgammonOptions = DEFAULT_BACKGAMMON_OPTIONS,
	now = Date.now(),
): LocalMatch {
	return {
		state: createInitialBackgammonState(),
		history: [],
		future: [],
		options,
		updatedAt: now,
	};
}

function withDice(state: BackgammonTurnState, dice: number[]) {
	return { ...state, dice, used: dice.map(() => false) };
}

/** Hands the turn over, rolling for the next player when asked to. */
function passTurn(
	state: BackgammonTurnState,
	options: BackgammonOptions,
	dice: number[],
): BackgammonTurnState {
	const next = {
		...state,
		activeColor: switchBackgammonColor(state.activeColor),
	};
	return options.autoRoll ? withDice(next, dice) : withDice(next, []);
}

export function reduceLocalMatch(
	match: LocalMatch,
	action: LocalMatchAction,
	dice: number[],
	now = Date.now(),
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
			return touch({ state: withDice(state, dice) });
		case "endTurn":
			if (finished || state.dice.length === 0) return match;
			return touch({ state: passTurn(state, options, dice) });
		case "move": {
			if (finished) return match;
			let next = applyBackgammonPlan(state, action.plan);
			if (
				options.autoSwitchTurn &&
				next.used.every(Boolean) &&
				getBackgammonWinner(next.off) === null
			) {
				next = passTurn(next, options, dice);
			}
			return touch({
				state: next,
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
			const nextOptions = { ...options, [action.key]: action.value };
			// Turning auto-roll on mid-turn rolls for the waiting player.
			const rollNow =
				action.key === "autoRoll" &&
				action.value &&
				!finished &&
				state.dice.length === 0;
			return touch({
				options: nextOptions,
				state: rollNow ? withDice(state, dice) : state,
			});
		}
	}
}
