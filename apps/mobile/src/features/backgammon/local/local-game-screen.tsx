/**
 * Two players, one phone. The board is drawn from White's side; the turn
 * panel says whose turn it is.
 */
import {
	type BackgammonMovePlan,
	canEndBackgammonTurn,
	getBackgammonWinner,
	rollBackgammonDice,
} from "@arcadeclub/core/backgammon";
import { useEffect } from "react";
import { Alert } from "react-native";
import { haptics } from "../../../feedback/haptics";
import { fmt, useI18n } from "../../../i18n";
import { Button } from "../../../ui/button";
import { BackgammonBoard } from "../board/backgammon-board";
import { useBoardSelection } from "../board/use-board-selection";
import { BoardScreen } from "../components/board-screen";
import { colorLabel } from "../components/color-label";
import { OptionsPanel } from "../components/options-panel";
import { TURN_HINT_MESSAGE, turnHint } from "../components/turn-hint";
import { TurnPanel } from "../components/turn-panel";
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
	const { match, dispatch, restart } = useLocalMatch();
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

	const confirmRestart = () =>
		Alert.alert(copy.newGame.confirmNewTitle, copy.newGame.confirmNewBody, [
			{ text: t.common.actions.cancel, style: "cancel" },
			{
				text: t.common.endScreen.newGame,
				style: "destructive",
				onPress: restart,
			},
		]);

	const hint = turnHint(state, selection.selected);
	const heading = winner
		? fmt(copy.waitingRoom.winsTheMatch, { name: colorLabel(copy, winner) })
		: state.activeColor === "white"
			? copy.board.whiteToMove
			: copy.board.blackToMove;

	return (
		<BoardScreen
			title={t.catalog.backgammon.title}
			action={{
				label: t.common.endScreen.newGame,
				onPress: confirmRestart,
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
			<TurnPanel
				color={winner ?? state.activeColor}
				heading={heading}
				message={hint ? copy.board[TURN_HINT_MESSAGE[hint]] : null}
				dice={state.dice}
				used={state.used}
			>
				{winner ? (
					<Button label={t.common.endScreen.newGame} onPress={restart} />
				) : state.dice.length === 0 ? (
					<Button
						label={copy.board.rollButton}
						onPress={() => {
							haptics.valueEntered();
							dispatch({ type: "roll", dice: rollBackgammonDice() });
						}}
						testID="bg-roll"
					/>
				) : canEndBackgammonTurn(state) ? (
					<Button
						label={copy.board.endTurnButton}
						onPress={() =>
							dispatch({ type: "endTurn", dice: rollBackgammonDice() })
						}
						testID="bg-end-turn"
					/>
				) : null}
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
			</TurnPanel>
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
