/**
 * Tap-to-move: the first tap picks a checker, the second picks where it
 * goes. A checker on the bar is picked automatically, because it is the
 * only one allowed to move. Combined moves (both dice on one checker) come
 * back as a single plan when `autoCombine` is on.
 */
import {
	type BackgammonMoveDestination,
	type BackgammonMovePlan,
	type BackgammonMoveSource,
	type BackgammonTurnState,
	canMoveNow,
	getMoveHighlights,
	planBackgammonMove,
} from "@arcadeclub/core/backgammon";
import { useEffect, useMemo, useState } from "react";
import { haptics } from "../../../feedback/haptics";

const NO_HIGHLIGHTS = { points: new Set<number>(), off: false };

export function useBoardSelection({
	state,
	interactive,
	autoCombine,
	onPlan,
}: {
	state: BackgammonTurnState;
	interactive: boolean;
	autoCombine: boolean;
	onPlan: (plan: BackgammonMovePlan) => void;
}) {
	const [picked, setPicked] = useState<BackgammonMoveSource | null>(null);
	const color = state.activeColor;
	const movable = interactive && canMoveNow(state);
	const onBar = state.bar[color] > 0;
	const selected: BackgammonMoveSource | null = movable
		? onBar
			? "bar"
			: picked
		: null;

	// A new roll or a new player starts without a pick.
	const turnKey = `${color}:${state.dice.join(",")}`;
	useEffect(() => {
		void turnKey;
		setPicked(null);
	}, [turnKey]);

	const highlights = useMemo(
		() =>
			selected == null
				? NO_HIGHLIGHTS
				: getMoveHighlights(state, selected, autoCombine),
		[state, selected, autoCombine],
	);

	const commit = (to: BackgammonMoveDestination) => {
		if (selected == null) return false;
		const plan = planBackgammonMove(state, selected, to, autoCombine);
		if (!plan) return false;
		setPicked(null);
		onPlan(plan);
		return true;
	};

	const ownsPoint = (point: number) => {
		const target = state.points[point - 1];
		return target?.color === color && target.count > 0;
	};

	const tapPoint = (point: number) => {
		if (!movable) return;
		if (selected === point) {
			setPicked(null);
			haptics.selectionChanged();
			return;
		}
		if (commit(point)) return;
		if (!onBar && ownsPoint(point)) {
			setPicked(point);
			haptics.selectionChanged();
			return;
		}
		if (selected != null) haptics.moveRejected();
	};

	const tapOff = () => {
		if (movable && !commit("off") && selected != null) haptics.moveRejected();
	};

	return { selected, highlights, movable, tapPoint, tapOff };
}
