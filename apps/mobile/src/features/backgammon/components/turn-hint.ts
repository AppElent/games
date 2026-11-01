/**
 * What the player whose turn it is should do next. `TURN_HINT_MESSAGE` maps
 * each hint to its message key in `t.games.backgammon.board`.
 */
import {
	type BackgammonMoveSource,
	type BackgammonTurnState,
	canMoveNow,
	getBackgammonWinner,
	hasLegalBackgammonMove,
} from "@arcadeclub/core/backgammon";

export type TurnHint =
	| "rollPrompt"
	| "turnDone"
	| "noMoves"
	| "enterFromBar"
	| "pickTarget"
	| "pickChecker";

export const TURN_HINT_MESSAGE = {
	rollPrompt: "statusRollToBegin",
	turnDone: "statusNoMovesLeft",
	noMoves: "hintNoMoves",
	enterFromBar: "hintEnterFromBar",
	pickTarget: "hintPickTarget",
	pickChecker: "hintPickChecker",
} as const satisfies Record<TurnHint, string>;

export function turnHint(
	state: BackgammonTurnState,
	selected: BackgammonMoveSource | null,
): TurnHint | null {
	if (getBackgammonWinner(state.off)) return null;
	if (state.dice.length === 0) return "rollPrompt";
	if (!canMoveNow(state)) return "turnDone";
	if (!hasLegalBackgammonMove(state)) return "noMoves";
	if (state.bar[state.activeColor] > 0) return "enterFromBar";
	return selected == null ? "pickChecker" : "pickTarget";
}
