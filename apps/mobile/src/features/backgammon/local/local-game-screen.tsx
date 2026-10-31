/**
 * Two players, one phone. The board is drawn from White's side; the turn
 * panel says whose turn it is.
 */
import {
	type BackgammonMovePlan,
	getBackgammonWinner,
} from "@games/core/backgammon";
import { Stack } from "expo-router";
import { useEffect } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { haptics } from "../../../feedback/haptics";
import { fmt, useI18n } from "../../../i18n";
import { metrics, spacing, type Tokens, useThemedStyles } from "../../../theme";
import { Button } from "../../../ui/button";
import { BackgammonBoard } from "../board/backgammon-board";
import { useBoardSelection } from "../board/use-board-selection";
import { colorLabel } from "../components/color-label";
import { OptionsPanel } from "../components/options-panel";
import { TURN_HINT_MESSAGE, turnHint } from "../components/turn-hint";
import { TurnPanel } from "../components/turn-panel";
import { useBoardWidth } from "../components/use-board-width";
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
	const styles = useThemedStyles(createStyles);
	const insets = useSafeAreaInsets();
	const { match, dispatch, restart } = useLocalMatch();
	const { state, options } = match;
	const winner = getBackgammonWinner(state.off);
	const { width, wide } = useBoardWidth(320);

	const onPlan = (plan: BackgammonMovePlan) => {
		haptics.moveMade();
		dispatch({ type: "move", plan });
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
		<>
			<Stack.Screen
				options={{
					title: t.catalog.backgammon.title,
					headerRight: () => (
						<Button
							variant="plain"
							compact
							label={t.common.endScreen.newGame}
							onPress={confirmRestart}
							testID="bg-new-game"
						/>
					),
				}}
			/>
			<ScrollView
				style={styles.root}
				contentInsetAdjustmentBehavior="automatic"
				contentContainerStyle={[
					styles.content,
					wide && styles.wideContent,
					{ paddingBottom: insets.bottom + spacing.lg },
				]}
			>
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
				<View style={[styles.side, { width: wide ? 340 : width }]}>
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
									dispatch({ type: "roll" });
								}}
								testID="bg-roll"
							/>
						) : (
							<Button
								label={copy.board.endTurnButton}
								variant={
									hint === "turnDone" || hint === "noMoves"
										? "primary"
										: "secondary"
								}
								onPress={() => dispatch({ type: "endTurn" })}
								testID="bg-end-turn"
							/>
						)}
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
							dispatch({ type: "setOption", key, value })
						}
					/>
				</View>
			</ScrollView>
		</>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		root: { flex: 1, backgroundColor: colors.bg },
		content: {
			alignItems: "center",
			gap: spacing.lg,
			paddingHorizontal: spacing.sm,
			paddingTop: spacing.sm,
		},
		wideContent: {
			flexDirection: "row",
			alignItems: "flex-start",
			justifyContent: "center",
			paddingHorizontal: metrics.screenGutter,
		},
		side: { gap: spacing.lg },
	});
