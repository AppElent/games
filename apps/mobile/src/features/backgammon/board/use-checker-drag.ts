/**
 * The board's drag gesture and the motion around it.
 *
 * The gesture runs on the UI thread: it starts only on a checker that may
 * move, carries the lifted checker 1.7 checker heights above the finger
 * (so the finger hides neither the checker nor the point under it), and
 * reports the place under the checker's centre to `BoardControl` only when
 * it changes. The control decides what a drop means; this hook animates it:
 * a settle onto the landing slot, a blot sliding to the bar, or a spring back
 * to the stack. Reduced motion places everything at once.
 *
 * Online, a committed move is only on the board once the server answers, so
 * the lifted checker waits on its landing slot (and its source stays one
 * short) until the board changes. A refused move springs back at once.
 */
import type {
	BackgammonColor,
	BackgammonDropTarget,
	BackgammonMoveSource,
	BackgammonTurnState,
} from "@arcadeclub/core/backgammon";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
	GestureStateManager,
	usePanGesture,
} from "react-native-gesture-handler";
import {
	Easing,
	useReducedMotion,
	useSharedValue,
	withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import {
	type BoardGeometry,
	hitGrid,
	hitTestBoard,
	MAX_STACK,
	type Side,
	type Slot,
	slotCenter,
} from "./board-layout";
import { type BoardControl, boardKey } from "./use-board-selection";

export const LIFT_SCALE = 1.3;
/** Variant A: the lifted checker rides this many checker heights above the finger. */
const LIFT_OFFSET = 1.7;
/** Moved this far, a press becomes a drag; the web board uses the same 6 px. */
const DRAG_THRESHOLD = 6;
const LIFT_MS = 120;
const SETTLE_MS = 180;
const RETURN_MS = 220;
const RETURN_CURVE = Easing.bezier(0.2, 0.8, 0.2, 1);
const SETTLE_CURVE = Easing.bezier(0.33, 1, 0.68, 1);
/** How long a committed move may wait for the server before the board stops holding it. */
const PENDING_MS = 4000;

const IDLE = 0;
const DRAGGING = 1;
const SETTLING = 2;

type Point = { x: number; y: number };

/** A checker in the air that is not the dragged one: a hit blot on its way to the bar. */
export type Flight = {
	id: number;
	color: BackgammonColor;
	from: Point;
	to: Point;
};

type Pending = {
	key: string;
	hits: number[];
	mover: BackgammonColor;
};

/** Which side of the bar and tray `color` uses on a board seen by `viewer`. */
function sideOf(color: BackgammonColor, viewer: BackgammonColor): Side {
	return color === viewer ? "viewer" : "opponent";
}

/** The slot a checker of the active colour would land in on `target`. */
export function landingSlot(
	state: BackgammonTurnState,
	viewer: BackgammonColor,
	target: number | "off",
): Slot {
	const color = state.activeColor;
	if (target === "off") {
		return {
			kind: "off",
			side: sideOf(color, viewer),
			index: state.off[color],
		};
	}
	const point = state.points[target - 1];
	const own = point?.color === color ? point.count : 0;
	return { kind: "point", point: target, index: Math.min(own, MAX_STACK - 1) };
}

function sourceSlot(
	state: BackgammonTurnState,
	viewer: BackgammonColor,
	source: BackgammonMoveSource,
): Slot {
	const color = state.activeColor;
	if (source === "bar") {
		return {
			kind: "bar",
			side: sideOf(color, viewer),
			index: Math.max(0, state.bar[color] - 1),
		};
	}
	const count = state.points[source - 1]?.count ?? 1;
	return { kind: "point", point: source, index: Math.max(0, count - 1) };
}

export function useCheckerDrag({
	geometry,
	viewer,
	state,
	control,
}: {
	geometry: BoardGeometry;
	viewer: BackgammonColor;
	state: BackgammonTurnState;
	control: BoardControl;
}) {
	const quiet = useReducedMotion();
	const grid = useMemo(() => hitGrid(geometry, viewer), [geometry, viewer]);
	const liftOffset = geometry.checker * LIFT_OFFSET;
	const key = boardKey(state);

	const x = useSharedValue(0);
	const y = useSharedValue(0);
	const scale = useSharedValue(1);
	const shown = useSharedValue(0);
	const phase = useSharedValue(IDLE);
	const from = useSharedValue<BackgammonMoveSource | null>(null);
	const over = useSharedValue<BackgammonDropTarget>(null);
	const draggable = useSharedValue<BackgammonMoveSource[]>([]);
	useEffect(() => {
		draggable.value = control.draggable;
	}, [control.draggable, draggable]);

	/** The checker in the air and the stack it left, which draws one short. */
	const [away, setAway] = useState<{
		/** Null once the new board has the move: nothing to draw short any more. */
		source: BackgammonMoveSource | null;
		color: BackgammonColor;
	} | null>(null);
	const [pending, setPending] = useState<Pending | null>(null);
	const [flights, setFlights] = useState<Flight[]>([]);
	const pendingRef = useRef<Pending | null>(null);
	const settledRef = useRef(true);
	const originRef = useRef<Point>({ x: 0, y: 0 });
	const nextFlight = useRef(0);

	const latest = useRef({ state, control, geometry, viewer, quiet, key });
	latest.current = { state, control, geometry, viewer, quiet, key };

	const handlers = useMemo(() => {
		const setPendingBoth = (next: Pending | null) => {
			pendingRef.current = next;
			setPending(next);
		};
		const hide = () => {
			shown.value = 0;
			scale.value = 1;
			phase.value = IDLE;
			setAway(null);
		};
		const flyTo = (
			target: Point,
			duration: number,
			done: () => void,
			easing = RETURN_CURVE,
		) => {
			if (latest.current.quiet) {
				x.value = target.x;
				y.value = target.y;
				scale.value = 1;
				done();
				return;
			}
			const timing = { duration, easing };
			scale.value = withTiming(1, timing);
			x.value = withTiming(target.x, timing);
			y.value = withTiming(target.y, timing, (finished) => {
				"worklet";
				if (finished) scheduleOnRN(done);
			});
		};
		const springBack = () => {
			phase.value = SETTLING;
			flyTo(originRef.current, RETURN_MS, hide);
		};
		const settled = () => {
			settledRef.current = true;
			if (!pendingRef.current) hide();
		};
		return {
			springBack,
			hide,
			setPendingBoth,
			lift(source: BackgammonMoveSource) {
				const { control, state, geometry, viewer } = latest.current;
				if (!control.liftChecker(source)) {
					hide();
					return;
				}
				originRef.current = slotCenter(
					geometry,
					viewer,
					sourceSlot(state, viewer, source),
				);
				setAway({ source, color: state.activeColor });
			},
			over(target: BackgammonDropTarget) {
				latest.current.control.moveOver(target);
			},
			drop(target: BackgammonDropTarget) {
				const { control, state, geometry, viewer, key } = latest.current;
				const landing =
					target != null && target !== "bar"
						? slotCenter(geometry, viewer, landingSlot(state, viewer, target))
						: null;
				let held: Pending | null = null;
				// Refused: no new board is coming, so give the checker back now.
				const refused = () => {
					if (!held || pendingRef.current !== held) return;
					setPendingBoth(null);
					springBack();
				};
				const outcome = control.dropChecker(target, refused);
				if (outcome.kind !== "move" || !landing) {
					springBack();
					return;
				}
				settledRef.current = false;
				held = { key, hits: outcome.hits, mover: state.activeColor };
				setPendingBoth(held);
				flyTo(landing, SETTLE_MS, settled, SETTLE_CURVE);
			},
			cancel() {
				latest.current.control.cancelDrag();
				springBack();
			},
		};
	}, [x, y, scale, shown, phase]);

	// A drag the control dropped on its own (the board changed under it) goes back.
	useEffect(() => {
		if (control.lifted == null && phase.value === DRAGGING)
			handlers.springBack();
	}, [control.lifted, phase, handlers]);

	// The committed move is on the board: stop holding it, slide any hit blots.
	useLayoutEffect(() => {
		const held = pendingRef.current;
		if (!held || held.key === key) return;
		handlers.setPendingBoth(null);
		if (settledRef.current) handlers.hide();
		// Still settling: keep the mover's colour (the turn may have passed already).
		else setAway((current) => current && { ...current, source: null });
		if (latest.current.quiet || held.hits.length === 0) return;
		const hitColor: BackgammonColor =
			held.mover === "white" ? "black" : "white";
		const side = sideOf(hitColor, viewer);
		setFlights((current) => [
			...current,
			...held.hits.map((point, i) => ({
				id: nextFlight.current++,
				color: hitColor,
				from: slotCenter(geometry, viewer, { kind: "point", point, index: 0 }),
				to: slotCenter(geometry, viewer, {
					kind: "bar",
					side,
					index: state.bar[hitColor] - held.hits.length + i,
				}),
			})),
		]);
	}, [key, handlers, geometry, viewer, state.bar]);

	// The server never answered (or refused): give the checker back.
	useEffect(() => {
		if (!pending) return;
		const timer = setTimeout(() => {
			handlers.setPendingBoth(null);
			handlers.hide();
		}, PENDING_MS);
		return () => clearTimeout(timer);
	}, [pending, handlers]);

	const gesture = usePanGesture({
		minDistance: DRAG_THRESHOLD,
		maxPointers: 1,
		onTouchesDown: (event) => {
			"worklet";
			const touch = event.allTouches[0];
			const hit = touch ? hitTestBoard(grid, touch.x, touch.y) : null;
			if (
				phase.value !== IDLE ||
				hit == null ||
				!draggable.value.includes(hit as BackgammonMoveSource)
			) {
				GestureStateManager.fail(event.handlerTag);
				return;
			}
			from.value = hit as BackgammonMoveSource;
		},
		onActivate: (event) => {
			"worklet";
			const source = from.value;
			if (source == null) return;
			x.value = event.x;
			y.value = event.y - liftOffset;
			over.value = hitTestBoard(grid, x.value, y.value);
			scale.value = quiet
				? LIFT_SCALE
				: withTiming(LIFT_SCALE, { duration: LIFT_MS });
			shown.value = 1;
			phase.value = DRAGGING;
			scheduleOnRN(handlers.lift, source);
			scheduleOnRN(handlers.over, over.value);
		},
		onUpdate: (event) => {
			"worklet";
			if (phase.value !== DRAGGING) return;
			x.value = event.x;
			y.value = event.y - liftOffset;
			const target = hitTestBoard(grid, x.value, y.value);
			if (target !== over.value) {
				over.value = target;
				scheduleOnRN(handlers.over, target);
			}
		},
		onDeactivate: (event) => {
			"worklet";
			if (phase.value !== DRAGGING) return;
			phase.value = SETTLING;
			if (event.canceled) scheduleOnRN(handlers.cancel);
			else scheduleOnRN(handlers.drop, over.value);
		},
	});

	const holding = !pending || pending.key === key;
	return {
		gesture,
		lifted: { x, y, scale, shown, color: away?.color ?? state.activeColor },
		/** The stack a checker is in the air from, drawn one short. */
		hiddenSource: away && holding ? away.source : null,
		flights,
		endFlight: (id: number) =>
			setFlights((current) => current.filter((flight) => flight.id !== id)),
	};
}
