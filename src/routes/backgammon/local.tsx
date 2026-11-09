import {
	type BackgammonMovePlan,
	canEndBackgammonTurn,
	getBackgammonWinner,
	rollBackgammonDice,
} from "@arcadeclub/core/backgammon";
import {
	type LocalMatch,
	type LocalMatchAction,
	newLocalMatch,
	reduceLocalMatch,
} from "@arcadeclub/core/backgammon-local";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
	BACKGAMMON_DESIGN_WIDTH,
	BackgammonBoard,
	type BackgammonOptionKey,
	LOCAL_OPTION_KEYS,
} from "#/components/backgammon/BackgammonBoard";
import { colorLabel } from "#/components/backgammon/color-label";
import { RotateHint } from "#/components/games/FitScale";
import { FullscreenGameShell } from "#/components/games/FullscreenGameShell";
import { MatchLoading, MatchStage } from "#/components/games/match/MatchStage";
import {
	loadLocalBackgammonGame,
	saveLocalBackgammonGame,
} from "#/lib/games/backgammon-local";
import { fmt, useMessages } from "#/lib/i18n";

export const Route = createFileRoute("/backgammon/local")({
	component: BackgammonLocalPage,
	staticData: { fullscreen: true },
});

/**
 * Hotseat match on one device. State lives in localStorage only — no Convex
 * session, no server traffic.
 */
function BackgammonLocalPage() {
	const messages = useMessages();
	const backgammon = messages.games.backgammon;
	const [match, setMatch] = useState<LocalMatch | null>(null);

	useEffect(() => {
		setMatch(loadLocalBackgammonGame() ?? newLocalMatch(Date.now()));
	}, []);

	useEffect(() => {
		if (match) {
			saveLocalBackgammonGame(match);
		}
	}, [match]);

	if (!match) {
		return (
			<MatchLoading
				title={backgammon.localPlay.title}
				text={backgammon.localPlay.settingUp}
			/>
		);
	}

	const { state, history, future, options } = match;
	const winner = getBackgammonWinner(state.off);

	function dispatch(action: LocalMatchAction) {
		setMatch(
			(current) => current && reduceLocalMatch(current, action, Date.now()),
		);
	}

	function handlePlan(plan: BackgammonMovePlan) {
		dispatch({ type: "move", plan, dice: rollBackgammonDice() });
	}

	function handleRoll() {
		dispatch({ type: "roll", dice: rollBackgammonDice() });
	}

	function handleEndTurn() {
		dispatch({ type: "endTurn", dice: rollBackgammonDice() });
	}

	function handleUndo() {
		dispatch({ type: "undo" });
	}

	function handleRedo() {
		dispatch({ type: "redo" });
	}

	function handleReset() {
		setMatch(
			(current) => current && newLocalMatch(Date.now(), current.options),
		);
	}

	function handleToggleOption(key: BackgammonOptionKey) {
		dispatch({
			type: "setOption",
			key,
			value: !options[key],
			dice: rollBackgammonDice(),
		});
	}

	return (
		<FullscreenGameShell
			title={backgammon.localPlay.title}
			onRestart={handleReset}
		>
			<MatchStage
				designWidth={BACKGAMMON_DESIGN_WIDTH}
				align="top"
				insetClassName="landscape:pt-1 landscape:pl-14"
				board={
					<BackgammonBoard
						state={state}
						interactive={!winner}
						canRoll={!winner && state.dice.length === 0 && !options.autoRoll}
						canEndTurn={!winner && canEndBackgammonTurn(state)}
						options={options}
						optionKeys={LOCAL_OPTION_KEYS}
						onToggleOption={handleToggleOption}
						onPlan={handlePlan}
						onRoll={handleRoll}
						onEndTurn={handleEndTurn}
						onUndo={handleUndo}
						onRedo={handleRedo}
						onReset={handleReset}
						canUndo={history.length > 0}
						canRedo={future.length > 0}
						statusOverride={
							winner
								? fmt(backgammon.localPlay.bornOffAll, {
										color: colorLabel(backgammon.localPlay, winner),
									})
								: undefined
						}
					/>
				}
			>
				<RotateHint />
			</MatchStage>
		</FullscreenGameShell>
	);
}
