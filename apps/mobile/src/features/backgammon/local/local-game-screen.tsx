/**
 * Two players, one phone. The board is drawn from White's side; the turn
 * panel says whose turn it is.
 */
import {
	type BackgammonMovePlan,
	getBackgammonWinner,
	rollBackgammonDice,
} from "@arcadeclub/core/backgammon";
import { useEffect } from "react";
import { haptics } from "../../../feedback/haptics";
import { useI18n } from "../../../i18n";
import { Button } from "../../../ui/button";
import { BackgammonBoard } from "../board/backgammon-board";
import { useBoardSelection } from "../board/use-board-selection";
import { BoardScreen } from "../components/board-screen";
import { colorLabel } from "../components/color-label";
import { confirmNewMatch } from "../components/confirm-new-match";
import { MatchPanel } from "../components/match-panel";
import { OptionsPanel } from "../components/options-panel";
import { TURN_HINT_MESSAGE, turnHint } from "../components/turn-hint";
import { useLocalMatch } from "./use-local-match";

const OPTION_KEYS = [
	"showNumbers",
	"autoRoll",
	"autoSwitchTurn",
	"autoCombine",
] as const;

export function LocalGameScreen() {
	const { t } = useI18n();
	const copy = t.games.backgammon;
	const { match, dispatch, restartKeepingOptions } = useLocalMatch();
	const { state, options } = match;
	const winner = getBackgammonWinner(state.off);

	const onPlan = (plan: BackgammonMovePlan) => {
		haptics.moveMade();
		dispatch({ type: "move", plan, dice: rollBackgammonDice() });
	};
	const selection = useBoardSelection({
		state,
		interactive: !winner,
		autoCombine: options.autoCombine,
		onPlan,
	});

	useEffect(() => {
		if (winner) haptics.gameWon();
	}, [winner]);

	const hint = turnHint(state, selection.selected);

	return (
		<BoardScreen
			title={t.catalog.backgammon.title}
			action={{
				label: t.common.endScreen.newGame,
				onPress: () => confirmNewMatch(t, restartKeepingOptions),
				testID: "bg-new-game",
			}}
			board={(width) => (
				<BackgammonBoard
					state={state}
					viewer="white"
					width={width}
					showNumbers={options.showNumbers}
					selected={selection.selected}
					highlights={selection.highlights}
					onPointPress={selection.tapPoint}
					onOffPress={selection.tapOff}
					testID="bg-board"
				/>
			)}
		>
			<MatchPanel
				turn={state}
				winner={winner && { color: winner, name: colorLabel(copy, winner) }}
				heading={
					state.activeColor === "white"
						? copy.board.whiteToMove
						: copy.board.blackToMove
				}
				message={hint ? copy.board[TURN_HINT_MESSAGE[hint]] : null}
				canAct
				onRoll={() => dispatch({ type: "roll", dice: rollBackgammonDice() })}
				onEndTurn={() =>
					dispatch({ type: "endTurn", dice: rollBackgammonDice() })
				}
				finishedAction={
					<Button
						label={t.common.endScreen.newGame}
						onPress={restartKeepingOptions}
					/>
				}
			>
				<Button
					variant="secondary"
					compact
					label={t.common.actions.undo}
					disabled={match.history.length === 0}
					onPress={() => dispatch({ type: "undo" })}
					testID="bg-undo"
				/>
				<Button
					variant="secondary"
					compact
					label={t.common.actions.redo}
					disabled={match.future.length === 0}
					onPress={() => dispatch({ type: "redo" })}
					testID="bg-redo"
				/>
			</MatchPanel>
			<OptionsPanel
				options={options}
				keys={OPTION_KEYS}
				onChange={(key, value) =>
					dispatch({
						type: "setOption",
						key,
						value,
						dice: rollBackgammonDice(),
					})
				}
			/>
		</BoardScreen>
	);
}
