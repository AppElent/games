/**
 * What the player whose turn it is should do next, as a message key in
 * `t.backgammon.game`.
 */
import {
	type BackgammonMoveSource,
	type BackgammonTurnState,
	canMoveNow,
	getBackgammonWinner,
	hasLegalBackgammonMove,
} from "@games/core/backgammon";

export type TurnHint =
	| "rollPrompt"
	| "turnDone"
	| "noMoves"
	| "enterFromBar"
	| "pickTarget"
	| "pickChecker";

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
