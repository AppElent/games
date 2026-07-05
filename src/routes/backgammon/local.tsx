import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
	BackgammonBoard,
	type BackgammonBoardOptions,
	type BackgammonOptionKey,
} from "#/components/backgammon/BackgammonBoard";
import { FitScale, RotateHint } from "#/components/games/FitScale";
import { FullscreenGameShell } from "#/components/games/FullscreenGameShell";
import {
	applyBackgammonPlan,
	type BackgammonMovePlan,
	type BackgammonTurnState,
	createInitialBackgammonState,
	getBackgammonWinner,
	rollBackgammonDice,
	switchBackgammonColor,
} from "#/lib/games/backgammon";
import {
	clearLocalBackgammonGame,
	DEFAULT_LOCAL_BACKGAMMON_OPTIONS,
	LOCAL_BACKGAMMON_HISTORY_LIMIT,
	loadLocalBackgammonGame,
	saveLocalBackgammonGame,
} from "#/lib/games/backgammon-local";

export const Route = createFileRoute("/backgammon/local")({
	component: BackgammonLocalPage,
	staticData: { fullscreen: true },
});

/**
 * Hotseat match on one device. State lives in localStorage only — no Convex
 * session, no server traffic.
 */
function BackgammonLocalPage() {
	const [state, setState] = useState<BackgammonTurnState | null>(null);
	const [history, setHistory] = useState<BackgammonTurnState[]>([]);
	const [future, setFuture] = useState<BackgammonTurnState[]>([]);
	const [options, setOptions] = useState<BackgammonBoardOptions>(
		DEFAULT_LOCAL_BACKGAMMON_OPTIONS,
	);
	const loadedRef = useRef(false);

	useEffect(() => {
		const saved = loadLocalBackgammonGame();
		if (saved) {
			setState(saved.state);
			setHistory(saved.history);
			setFuture(saved.future);
			setOptions(saved.options);
		} else {
			setState(createInitialBackgammonState());
		}
		loadedRef.current = true;
	}, []);

	useEffect(() => {
		if (!loadedRef.current || !state) {
			return;
		}
		saveLocalBackgammonGame({
			state,
			history,
			future,
			options,
			updatedAt: Date.now(),
		});
	}, [state, history, future, options]);

	if (!state) {
		return (
			<FullscreenGameShell title="Local Backgammon">
				<div className="flex h-full items-center justify-center text-slate-300">
					Setting up board...
				</div>
			</FullscreenGameShell>
		);
	}

	const winner = getBackgammonWinner(state.off);

	function pushHistory(previous: BackgammonTurnState) {
		setHistory((entries) =>
			[...entries, previous].slice(-LOCAL_BACKGAMMON_HISTORY_LIMIT),
		);
		setFuture([]);
	}

	function handleRoll() {
		if (!state || state.dice.length > 0) {
			return;
		}
		const dice = rollBackgammonDice();
		setState({ ...state, dice, used: dice.map(() => false) });
	}

	function handleEndTurn() {
		if (!state) {
			return;
		}
		const next = switchBackgammonColor(state.activeColor);
		if (options.autoRoll) {
			const dice = rollBackgammonDice();
			setState({
				...state,
				activeColor: next,
				dice,
				used: dice.map(() => false),
			});
		} else {
			setState({ ...state, activeColor: next, dice: [], used: [] });
		}
	}

	function handlePlan(plan: BackgammonMovePlan) {
		if (!state) {
			return;
		}
		pushHistory(state);
		let next = applyBackgammonPlan(state, plan);
		if (
			options.autoSwitchTurn &&
			next.dice.length > 0 &&
			next.used.every(Boolean) &&
			!getBackgammonWinner(next.off)
		) {
			const color = switchBackgammonColor(next.activeColor);
			if (options.autoRoll) {
				const dice = rollBackgammonDice();
				next = {
					...next,
					activeColor: color,
					dice,
					used: dice.map(() => false),
				};
			} else {
				next = { ...next, activeColor: color, dice: [], used: [] };
			}
		}
		setState(next);
	}

	function handleUndo() {
		if (!state || history.length === 0) {
			return;
		}
		const previous = history[history.length - 1];
		setHistory(history.slice(0, -1));
		setFuture([...future, state]);
		setState(previous);
	}

	function handleRedo() {
		if (!state || future.length === 0) {
			return;
		}
		const next = future[future.length - 1];
		setFuture(future.slice(0, -1));
		setHistory([...history, state]);
		setState(next);
	}

	function handleReset() {
		clearLocalBackgammonGame();
		setState(createInitialBackgammonState());
		setHistory([]);
		setFuture([]);
	}

	function handleToggleOption(key: BackgammonOptionKey) {
		setOptions((current) => {
			const next = { ...current, [key]: !current[key] };
			if (
				key === "autoRoll" &&
				next.autoRoll &&
				state &&
				state.dice.length === 0
			) {
				const dice = rollBackgammonDice();
				setState({ ...state, dice, used: dice.map(() => false) });
			}
			return next;
		});
	}

	return (
		<FullscreenGameShell title="Local Backgammon" onRestart={handleReset}>
			<div className="flex h-full flex-col">
				<div className="min-h-0 flex-1 px-2 pt-14 pb-1 landscape:pt-1 landscape:pl-14">
					<FitScale designWidth={1060}>
						<BackgammonBoard
							state={state}
							interactive={!winner}
							canRoll={!winner && state.dice.length === 0 && !options.autoRoll}
							canEndTurn={!winner && state.dice.length > 0}
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
									? `${winner === "white" ? "White" : "Black"} has borne off all 15 checkers`
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
