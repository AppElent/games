/**
 * Moving checkers, by tap or by drag.
 *
 * Tap-to-move: the first tap picks a checker, the second picks where it
 * goes. A checker on the bar is picked automatically, because it is the
 * only one allowed to move. Combined moves (both dice on one checker) come
 * back as a single plan when `autoCombine` is on.
 *
 * Drag: the board's gesture lifts a checker, reports the place under it and
 * drops it (`liftChecker`, `moveOver`, `dropChecker`). A drop commits the
 * same plan a tap would, and calls back when `onPlan` resolves false (the
 * server refused it). An illegal drop leaves a sentence in `notice` until
 * the next press. The hook decides every haptic, one per moment.
 */
import {
	type BackgammonColor,
	type BackgammonDropOutcome,
	type BackgammonDropTarget,
	type BackgammonMoveDestination,
	type BackgammonMovePlan,
	type BackgammonMoveSource,
	type BackgammonTurnState,
	canMoveNow,
	getMoveHighlights,
	planBackgammonMove,
	resolveBackgammonDrop,
} from "@arcadeclub/core/backgammon";
import { dropRejectionMessage } from "@arcadeclub/core/backgammon-messages";
import { useMemo, useRef, useState } from "react";
import { AccessibilityInfo } from "react-native";
import { haptics } from "../../../feedback/haptics";
import { useI18n } from "../../../i18n";
import { useResetOnChange } from "../../../ui/use-reset-on-change";
import { moveHaptic } from "./move-haptic";

const NO_HIGHLIGHTS = { points: new Set<number>(), off: false };

type Drag = { from: BackgammonMoveSource; over: BackgammonDropTarget };

/** Changes whenever anything on the board does: a drag in progress is then stale. */
export function boardKey(state: BackgammonTurnState) {
	const points = state.points
		.map((point) => (point.count ? `${point.color?.[0]}${point.count}` : ""))
		.join(",");
	return `${state.activeColor}|${points}|${state.bar.white},${state.bar.black}|${state.off.white},${state.off.black}|${state.dice.join("")}|${state.used.map(Number).join("")}`;
}

/** Whether `target` is lit for the current source. */
function isLit(
	highlights: { points: Set<number>; off: boolean },
	target: BackgammonDropTarget,
) {
	if (target === "off") return highlights.off;
	return typeof target === "number" && highlights.points.has(target);
}

export function useBoardSelection({
	state,
	interactive,
	autoCombine,
	onPlan,
}: {
	state: BackgammonTurnState;
	interactive: boolean;
	autoCombine: boolean;
	/** A promise it returns resolves false when the move was refused (online: the server said no). */
	onPlan: (plan: BackgammonMovePlan) => unknown;
}) {
	const { t } = useI18n();
	const [picked, setPicked] = useState<BackgammonMoveSource | null>(null);
	const [drag, setDragState] = useState<Drag | null>(null);
	const dragRef = useRef<Drag | null>(null);
	const [notice, setNotice] = useState<string | null>(null);
	const color: BackgammonColor = state.activeColor;
	const movable = interactive && canMoveNow(state);
	const onBar = state.bar[color] > 0;
	const ownsPoint = (point: number) => {
		const target = state.points[point - 1];
		return target?.color === color && target.count > 0;
	};
	const setDrag = (next: Drag | null) => {
		dragRef.current = next;
		setDragState(next);
	};
	// An undo can empty the picked point without changing the turn key.
	const stillPicked =
		picked === "bar" || (picked != null && ownsPoint(picked)) ? picked : null;
	const tapSelected: BackgammonMoveSource | null = movable
		? onBar
			? "bar"
			: stillPicked
		: null;
	// Like `stillPicked`: a newer board may have emptied the source before the reset runs.
	const lifted =
		movable && drag && (drag.from === "bar" ? onBar : ownsPoint(drag.from))
			? drag.from
			: null;
	const selected = lifted ?? tapSelected;

	// A new roll or a new player starts without a pick or a leftover sentence.
	useResetOnChange(`${color}:${state.dice.join(",")}`, () => {
		setPicked(null);
		setNotice(null);
	});
	// Any change to the board (an online move arriving, the turn ending)
	// cancels a drag in progress; the board springs the checker back.
	useResetOnChange(`${boardKey(state)}:${movable}`, () => setDrag(null));

	const highlights = useMemo(
		() =>
			selected == null
				? NO_HIGHLIGHTS
				: getMoveHighlights(state, selected, autoCombine),
		[state, selected, autoCombine],
	);

	const draggable = useMemo<BackgammonMoveSource[]>(() => {
		if (!movable) return [];
		if (onBar) return ["bar"];
		return state.points
			.filter((point) => point.color === color && point.count > 0)
			.map((point) => point.point);
	}, [movable, onBar, state.points, color]);

	const play = (plan: BackgammonMovePlan, onRefused?: () => void) => {
		setPicked(null);
		setDrag(null);
		haptics[moveHaptic(state, plan)]();
		const sent = onPlan(plan);
		if (onRefused && sent instanceof Promise)
			void sent.then((accepted) => {
				if (accepted === false) onRefused();
			});
	};

	const commit = (to: BackgammonMoveDestination) => {
		if (selected == null) return false;
		const plan = planBackgammonMove(state, selected, to, autoCombine);
		if (!plan) return false;
		play(plan);
		return true;
	};

	const tapPoint = (point: number) => {
		setNotice(null);
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
		setNotice(null);
		if (movable && !commit("off") && selected != null) haptics.moveRejected();
	};

	/** A drag starts; false when `from` may not move, so the board puts it back. */
	const liftChecker = (from: BackgammonMoveSource) => {
		setNotice(null);
		if (!draggable.includes(from)) return false;
		setPicked(null);
		setDrag({ from, over: null });
		haptics.checkerLifted();
		return true;
	};

	const moveOver = (over: BackgammonDropTarget) => {
		const current = dragRef.current;
		if (!current || current.over === over) return;
		setDrag({ ...current, over });
		const lit = getMoveHighlights(state, current.from, autoCombine);
		if (isLit(lit, over)) haptics.targetEntered();
	};

	/**
	 * Lets go over `over`; the board animates by the outcome it returns, and
	 * `onRefused` runs if the committed move is refused after all.
	 */
	const dropChecker = (
		over: BackgammonDropTarget,
		onRefused?: () => void,
	): BackgammonDropOutcome => {
		const current = dragRef.current;
		setDrag(null);
		if (!current || !movable) return { kind: "cancel" };
		const outcome = resolveBackgammonDrop(
			state,
			current.from,
			over,
			autoCombine,
		);
		if (outcome.kind === "move") {
			play(outcome.plan, onRefused);
		} else if (outcome.kind === "reject") {
			haptics.moveRejected();
			const message = dropRejectionMessage(
				t.games.backgammon.board,
				outcome,
				state,
			);
			setNotice(message);
			AccessibilityInfo.announceForAccessibility(message);
		}
		return outcome;
	};

	/** The drag ended without a drop (the system took the touch): no haptic. */
	const cancelDrag = () => setDrag(null);

	const hovered =
		lifted != null && drag && isLit(highlights, drag.over) ? drag.over : null;

	return {
		selected,
		highlights,
		tapPoint,
		tapOff,
		/** The source a drag is carrying a checker from. */
		lifted,
		/** The lit point (or "off") under the lifted checker. */
		hovered,
		/** Where a drag may start right now. */
		draggable,
		/** The rejection sentence, in place of the hint until the next press. */
		notice,
		liftChecker,
		moveOver,
		dropChecker,
		cancelDrag,
	};
}

export type BoardControl = ReturnType<typeof useBoardSelection>;
