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
	BackgammonBoard,
	type BackgammonOptionKey,
} from "#/components/backgammon/BackgammonBoard";
import { FitScale, RotateHint } from "#/components/games/FitScale";
import { FullscreenGameShell } from "#/components/games/FullscreenGameShell";
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
			<FullscreenGameShell title={backgammon.localPlay.title}>
				<div className="flex h-full items-center justify-center text-slate-300">
					{backgammon.localPlay.settingUp}
				</div>
			</FullscreenGameShell>
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
			<div className="flex h-full flex-col">
				<div className="min-h-0 flex-1 px-2 pt-14 pb-1 landscape:pt-1 landscape:pl-14">
					<FitScale designWidth={1060} align="top">
						<BackgammonBoard
							state={state}
							interactive={!winner}
							canRoll={!winner && state.dice.length === 0 && !options.autoRoll}
							canEndTurn={!winner && canEndBackgammonTurn(state)}
							options={options}
							optionKeys={[
								"showNumbers",
								"autoRoll",
								"autoSwitchTurn",
								"autoCombine",
							]}
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
											color:
												winner === "white"
													? backgammon.localPlay.colorWhite
													: backgammon.localPlay.colorBlack,
										})
									: undefined
							}
						/>
					</FitScale>
				</div>
				<RotateHint />
			</div>
		</FullscreenGameShell>
	);
}
