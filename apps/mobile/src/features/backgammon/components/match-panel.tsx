/**
 * The turn panel both match screens show under the board: the heading (or
 * who won), the dice, the next hint, and Roll or End turn when this phone may
 * act. Each screen adds its own finished action and extra buttons.
 */
import {
	type BackgammonColor,
	type BackgammonTurnState,
	canEndBackgammonTurn,
} from "@arcadeclub/core/backgammon";
import type { ReactNode } from "react";
import { haptics } from "../../../feedback/haptics";
import { fmt, useI18n } from "../../../i18n";
import { Button } from "../../../ui/button";
import { TurnPanel } from "./turn-panel";

export function MatchPanel({
	turn,
	winner,
	heading,
	message,
	canAct,
	busy,
	onRoll,
	onEndTurn,
	finishedAction,
	children,
}: {
	turn: BackgammonTurnState;
	/** Set once the match is over: who won and how to say it. */
	winner: { color: BackgammonColor; name: string; isYou?: boolean } | null;
	/** The heading while the match is still on. */
	heading: string;
	message: string | null;
	/** Whether this phone plays the current turn. */
	canAct: boolean;
	busy?: boolean;
	onRoll: () => void;
	onEndTurn: () => void;
	/** What to offer once someone has won (a new match, a rematch). */
	finishedAction: ReactNode;
	children?: ReactNode;
}) {
	const { t } = useI18n();
	const copy = t.games.backgammon;
	return (
		<TurnPanel
			color={winner?.color ?? turn.activeColor}
			heading={
				winner
					? winner.isYou
						? copy.waitingRoom.youWon
						: fmt(copy.waitingRoom.winsTheMatch, { name: winner.name })
					: heading
			}
			message={message}
			dice={turn.dice}
			used={turn.used}
		>
			{winner ? (
				finishedAction
			) : !canAct ? null : turn.dice.length === 0 ? (
				<Button
					label={copy.board.rollButton}
					onPress={() => {
						haptics.valueEntered();
						onRoll();
					}}
					busy={busy}
					testID="bg-roll"
				/>
			) : canEndBackgammonTurn(turn) ? (
				<Button
					label={copy.board.endTurnButton}
					onPress={onEndTurn}
					busy={busy}
					testID="bg-end-turn"
				/>
			) : null}
			{children}
		</TurnPanel>
	);
}
