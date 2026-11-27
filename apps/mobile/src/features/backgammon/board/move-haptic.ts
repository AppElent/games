/**
 * The one haptic a committed move gets, by tap or by drop: the last checker
 * off wins, a hit beats a plain move.
 */
import {
	applyBackgammonPlan,
	type BackgammonMovePlan,
	type BackgammonTurnState,
	blotsHitBy,
	getBackgammonWinner,
} from "@arcadeclub/core/backgammon";
import type { haptics } from "../../../feedback/haptics";

export function moveHaptic(
	state: BackgammonTurnState,
	plan: BackgammonMovePlan,
): keyof typeof haptics {
	if (getBackgammonWinner(applyBackgammonPlan(state, plan).off)) {
		return "gameWon";
	}
	return blotsHitBy(state, plan).length > 0 ? "checkerHit" : "moveMade";
}
