/**
 * Backgammon sentences built from game state, shared by the web board and
 * the phone so both say the same thing.
 */
import {
	type BackgammonDropOutcome,
	type BackgammonTurnState,
	remainingBackgammonDice,
} from "./backgammon";
import type { Messages } from "./i18n/en";
import { fmt } from "./i18n/format";

type BoardCopy = Pick<
	Messages["games"]["backgammon"]["board"],
	"moveRejectedReach" | "moveRejectedBlocked" | "diceAnd"
>;

/** "5", "5 and 3", "4, 4 and 4". */
export function joinDice(dice: number[], and: string) {
	if (dice.length < 2) return dice.join("");
	return `${dice.slice(0, -1).join(", ")} ${and} ${dice[dice.length - 1]}`;
}

/** Why a dropped checker went back: the status line's rejection sentence. */
export function dropRejectionMessage(
	board: BoardCopy,
	outcome: Extract<BackgammonDropOutcome, { kind: "reject" }>,
	state: Pick<BackgammonTurnState, "dice" | "used">,
) {
	if (outcome.reason === "blocked") {
		return fmt(board.moveRejectedBlocked, { number: outcome.point });
	}
	return fmt(board.moveRejectedReach, {
		dice: joinDice(remainingBackgammonDice(state), board.diceAnd),
	});
}
