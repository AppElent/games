import {
	availableDieIndexes,
	type BackgammonColor,
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
import type {
	BackgammonOptions,
	OnlineOptions,
} from "@arcadeclub/core/backgammon-local";
import { dropRejectionMessage } from "@arcadeclub/core/backgammon-messages";
import { useEffect, useRef, useState } from "react";
import { fmt, plural, useI18n } from "#/lib/i18n";

/**
 * The backgammon board as a controlled component: all rules live in
 * @arcadeclub/core/backgammon and the game state is
 * owned by the caller (local hook or Convex bundle). Supports click and drag
 * (mouse + touch) and combined two-die moves.
 */

/** Auto-roll is local play only; online games never offer it. */
export type BackgammonBoardOptions = OnlineOptions & Partial<BackgammonOptions>;

export type BackgammonOptionKey = keyof BackgammonOptions;

/** The board's natural width: screens scale it down from here to fit. */
export const BACKGAMMON_DESIGN_WIDTH = 1060;

type Props = {
	state: BackgammonTurnState;
	/** May the viewer move checkers right now (it is their turn)? */
	interactive: boolean;
	canRoll: boolean;
	canEndTurn: boolean;
	options: BackgammonBoardOptions;
	/** Which options appear in the gear menu; menu hidden when empty. */
	optionKeys?: readonly BackgammonOptionKey[];
	onToggleOption?: (key: BackgammonOptionKey) => void;
	/** A promise it returns resolves false when the move was refused (online: the server said no). */
	onPlan: (plan: BackgammonMovePlan) => unknown;
	/** Unset for a viewer without a seat: the button still shows, disabled. */
	onRoll?: () => unknown;
	/** Unset for a viewer without a seat: the button still shows, disabled. */
	onEndTurn?: () => unknown;
	onUndo?: () => void;
	onRedo?: () => void;
	onReset?: () => void;
	canUndo?: boolean;
	canRedo?: boolean;
	statusOverride?: string;
};

const LIGHT_POINT = "#e7d2a4";
const DARK_POINT = "#a54c38";

const PIPS: Record<number, number[]> = {
	1: [4],
	2: [0, 8],
	3: [0, 4, 8],
	4: [0, 2, 6, 8],
	5: [0, 2, 4, 6, 8],
	6: [0, 2, 3, 5, 6, 8],
};

const SIZE = 40;
const MONO = "'Spline Sans Mono', ui-monospace, monospace";
const SERIF = "'Cormorant Garamond', Georgia, serif";
/** Button, switch and turn-badge borders: 3:1 against the dark stage and the options panel. */
const CONTROL_LINE = "rgba(233, 217, 189, 0.45)";

/** Drag feel, the same numbers as the phone (designs/backgammon/drag-haptics_final.md). */
const DRAG_THRESHOLD = 6;
const LIFT_SCALE = 1.3;
/** Touch only: the lifted checker rides this many checker heights above the finger. */
const LIFT_OFFSET = 1.7;
const LIFT_MS = 120;
const SETTLE_MS = 180;
const RETURN_MS = 220;
const RETURN_CURVE = "cubic-bezier(.2,.8,.2,1)";
const SETTLE_CURVE = "cubic-bezier(.33,1,.68,1)";
/** An online move waits on the server; give up holding the settled checker after this. */
const PENDING_MS = 4000;

const SELECTED_RING = "#f4e2b0";
const HOVER_FILL = "rgba(120,220,170,0.45)";
const HOVER_RING = "#8ff0c0";
const GHOST_FILL = "rgba(255,253,246,0.35)";
const GHOST_EDGE = "#fffdf6";

type DragPhase = "pending" | "lifted" | "settling" | "returning";

type DragState = {
	from: BackgammonMoveSource;
	startX: number;
	startY: number;
	phase: DragPhase;
	/** The lifted checker, a fixed element on top of the page. */
	el: HTMLDivElement | null;
	/** Where the checker came from, in viewport pixels: the spring-back goal. */
	origin: { x: number; y: number };
	/** The source checker's on-screen size, so the lifted one matches a scaled board. */
	size: number;
	offsetY: number;
	over: BackgammonDropTarget;
	/** Settling: the checker reached its landing slot. */
	landed: boolean;
	/** Settling: the new board arrived; remove the checker once it lands. */
	boardChanged: boolean;
	timer: ReturnType<typeof setTimeout> | null;
	stop: () => void;
};

/** What the board draws while a checker is lifted; `key` ties it to the state it was lifted in. */
type DragView = {
	from: BackgammonMoveSource;
	over: BackgammonDropTarget;
	key: string;
};

function stateKey(state: BackgammonTurnState, movable: boolean) {
	return JSON.stringify([
		state.points,
		state.bar,
		state.off,
		state.dice,
		state.used,
		state.activeColor,
		movable,
	]);
}

function prefersReducedMotion() {
	return (
		window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
	);
}

/** The board place under a viewport point: a point's whole half-column, the bar, the tray, or nothing. */
function dropTargetAt(x: number, y: number): BackgammonDropTarget {
	const raw = document
		.elementFromPoint(x, y)
		?.closest?.("[data-dest]")
		?.getAttribute("data-dest");
	if (raw == null) return null;
	if (raw === "bar" || raw === "off") return raw;
	return Number.parseInt(raw, 10);
}

function checkerStyle(
	color: BackgammonColor | undefined,
	size: number,
	marginTop?: number,
): React.CSSProperties {
	const white = color === "white";
	const style: React.CSSProperties = {
		width: size,
		height: size,
		borderRadius: "50%",
		flex: "0 0 auto",
		background: white
			? "radial-gradient(circle at 36% 28%, #fffdf6 0%, #f3e6c4 46%, #d7c092 100%)"
			: "radial-gradient(circle at 36% 28%, #5c554c 0%, #2a2620 46%, #100e0b 100%)",
		border: white ? "1px solid #b09863" : "1px solid #000",
		boxShadow: white
			? "inset 0 0 0 4px rgba(197,167,108,0.28), inset 0 -3px 6px rgba(150,118,58,0.4), inset 0 2px 3px rgba(255,255,255,0.9), 0 3px 5px rgba(0,0,0,0.35)"
			: "inset 0 0 0 4px rgba(255,255,255,0.06), inset 0 -3px 6px rgba(0,0,0,0.6), inset 0 2px 3px rgba(255,255,255,0.14), 0 3px 5px rgba(0,0,0,0.45)",
	};
	if (marginTop !== undefined) {
		style.marginTop = marginTop;
	}
	return style;
}

/** The real checker, lifted: 1.3×, a drop shadow and the selected ring. */
function liftedChecker(
	color: BackgammonColor,
	size: number,
	at: { x: number; y: number },
	reduced: boolean,
) {
	const el = document.createElement("div");
	const look = checkerStyle(color, size);
	Object.assign(el.style, {
		position: "fixed",
		zIndex: "9999",
		width: `${size}px`,
		height: `${size}px`,
		borderRadius: "50%",
		left: `${at.x}px`,
		top: `${at.y}px`,
		pointerEvents: "none",
		background: String(look.background),
		border: String(look.border),
		boxShadow: `0 0 0 3px ${SELECTED_RING}, 0 12px 22px rgba(0,0,0,0.55)`,
		transform: "translate(-50%,-50%) scale(1)",
		transition: reduced ? "none" : `transform ${LIFT_MS}ms ease-out`,
	} as Partial<CSSStyleDeclaration>);
	document.body.appendChild(el);
	// Grow on the next frame so the transition runs.
	requestAnimationFrame(() => {
		el.style.transform = `translate(-50%,-50%) scale(${LIFT_SCALE})`;
	});
	return el;
}

/** Glide the lifted checker to a spot at its board size; at once under reduced motion. */
function flyTo(
	el: HTMLDivElement | null,
	to: { x: number; y: number },
	ms: number,
	curve: string,
	then: () => void,
) {
	if (!el) {
		then();
		return;
	}
	const reduced = prefersReducedMotion();
	el.style.transition = reduced
		? "none"
		: `left ${ms}ms ${curve}, top ${ms}ms ${curve}, transform ${ms}ms ${curve}`;
	el.style.left = `${to.x}px`;
	el.style.top = `${to.y}px`;
	el.style.transform = "translate(-50%,-50%) scale(1)";
	if (reduced) then();
	else setTimeout(then, ms);
}

function center(rect: DOMRect) {
	return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/** Where the checker will land: dashed outline, 35% fill. */
function ghostStyle(size: number): React.CSSProperties {
	return {
		width: size,
		height: size,
		borderRadius: "50%",
		flex: "0 0 auto",
		boxSizing: "border-box",
		background: GHOST_FILL,
		border: `2px dashed ${GHOST_EDGE}`,
	};
}

function Die({ value, used }: { value: number; used: boolean }) {
	const on = new Set(PIPS[value] ?? []);
	return (
		<div
			style={{
				width: 34,
				height: 34,
				borderRadius: 7,
				display: "grid",
				gridTemplateColumns: "repeat(3,1fr)",
				gridTemplateRows: "repeat(3,1fr)",
				padding: 4,
				background: used
					? "linear-gradient(155deg,#d8ccb4,#b3a586)"
					: "linear-gradient(155deg,#fdf6e6,#e6d3ab)",
				border: "1px solid #b7a179",
				opacity: used ? 0.5 : 1,
				boxShadow:
					"0 3px 6px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.7)",
			}}
		>
			{Array.from({ length: 9 }).map((_, i) => (
				<span
					// biome-ignore lint/suspicious/noArrayIndexKey: fixed 3x3 pip grid
					key={i}
					style={{
						width: 5,
						height: 5,
						borderRadius: "50%",
						margin: "auto",
						background: on.has(i)
							? "radial-gradient(circle at 35% 30%, #4a3418, #1c1207)"
							: "transparent",
						boxShadow: on.has(i) ? "inset 0 1px 1px rgba(0,0,0,0.5)" : "none",
					}}
				/>
			))}
		</div>
	);
}

export function BackgammonBoard({
	state,
	interactive,
	canRoll,
	canEndTurn,
	options,
	optionKeys = [],
	onToggleOption,
	onPlan,
	onRoll,
	onEndTurn,
	onUndo,
	onRedo,
	onReset,
	canUndo = false,
	canRedo = false,
	statusOverride,
}: Props) {
	const { locale, messages } = useI18n();
	const backgammon = messages.games.backgammon;
	const optionLabels: Record<BackgammonOptionKey, string> = {
		showNumbers: backgammon.board.optionShowNumbers,
		autoRoll: backgammon.board.optionAutoRoll,
		autoSwitchTurn: backgammon.board.optionAutoSwitchTurn,
		autoCombine: backgammon.board.optionAutoCombine,
	};
	const [selectedSource, setSelectedSource] =
		useState<BackgammonMoveSource | null>(null);
	const [optionsOpen, setOptionsOpen] = useState(false);
	const dragRef = useRef<DragState | null>(null);
	const justDraggedRef = useRef(false);
	/** Ends the current click guard: its timer, or its wait for the release. */
	const clickGuardRef = useRef<(() => void) | null>(null);
	const [dragViewState, setDragView] = useState<DragView | null>(null);
	/** The rejection sentence: replaces the status line until the next press. */
	const [notice, setNotice] = useState<string | null>(null);

	const active = state.activeColor;
	const movable = interactive && canMoveNow(state);
	const rollEnabled = canRoll && Boolean(onRoll);
	const endTurnEnabled = canEndTurn && Boolean(onEndTurn);
	const boardKey = stateKey(state, movable);
	// A lifted checker belongs to the board it was lifted from; a newer board drops it.
	const dragView = dragViewState?.key === boardKey ? dragViewState : null;

	const diceKey = state.dice.join();
	// biome-ignore lint/correctness/useExhaustiveDependencies: clear stale selection when the turn changes hands or new dice land
	useEffect(() => {
		setSelectedSource(null);
		setNotice(null);
	}, [active, diceKey]);

	/** The press just ended: ignore the click the browser fires after it. */
	function swallowClick() {
		clickGuardRef.current?.();
		justDraggedRef.current = true;
		const timer = setTimeout(() => {
			justDraggedRef.current = false;
			clickGuardRef.current = null;
		}, 300);
		clickGuardRef.current = () => clearTimeout(timer);
	}

	/** The press is still down: ignore its click, however long it is held. */
	function swallowClickAfterRelease() {
		clickGuardRef.current?.();
		justDraggedRef.current = true;
		const release = () => swallowClick();
		window.addEventListener("pointerup", release);
		window.addEventListener("pointercancel", release);
		clickGuardRef.current = () => {
			window.removeEventListener("pointerup", release);
			window.removeEventListener("pointercancel", release);
		};
	}

	function finishDrag(pd: DragState) {
		pd.stop();
		pd.el?.remove();
		if (pd.timer) clearTimeout(pd.timer);
		document.body.style.cursor = "";
		if (dragRef.current === pd) {
			dragRef.current = null;
			setDragView(null);
		}
	}

	function springBack(pd: DragState) {
		pd.phase = "returning";
		pd.stop();
		document.body.style.cursor = "";
		flyTo(pd.el, pd.origin, RETURN_MS, RETURN_CURVE, () => finishDrag(pd));
	}

	// A new board (a move landed, the opponent moved, the turn passed) ends any drag.
	// biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the board itself
	useEffect(() => {
		const pd = dragRef.current;
		if (!pd) return;
		if (pd.phase === "lifted") {
			// The button is still down: swallow the click that ends this press, as a normal drop does.
			swallowClickAfterRelease();
			springBack(pd);
		} else if (pd.phase === "settling" && !pd.landed) pd.boardChanged = true;
		else if (pd.phase !== "returning") finishDrag(pd);
	}, [boardKey]);

	useEffect(
		() => () => {
			clickGuardRef.current?.();
			const pd = dragRef.current;
			if (!pd) return;
			pd.stop();
			pd.el?.remove();
			if (pd.timer) clearTimeout(pd.timer);
			document.body.style.cursor = "";
		},
		[],
	);

	/** The drag source wins over a tap selection: the two never mix. */
	const source = dragView?.from ?? selectedSource;
	const highlights = movable
		? getMoveHighlights(state, source, options.autoCombine)
		: { points: new Set<number>(), off: false };
	/** The lit place under the lifted checker. */
	const over = dragView?.over ?? null;
	const hovered =
		typeof over === "number"
			? highlights.points.has(over)
				? over
				: null
			: over === "off" && highlights.off
				? "off"
				: null;
	const barHidden = dragView?.from === "bar" ? 1 : 0;

	function commitMove(
		from: BackgammonMoveSource,
		to: BackgammonMoveDestination,
	) {
		const plan = planBackgammonMove(state, from, to, options.autoCombine);
		if (!plan) {
			return false;
		}
		setSelectedSource(null);
		void onPlan(plan);
		return true;
	}

	function handleCell(n: number) {
		if (justDraggedRef.current || !movable) {
			return;
		}
		setNotice(null);
		if (selectedSource == null) {
			if (state.bar[active] > 0) {
				return;
			}
			const point = state.points[n - 1];
			if (point.color === active && point.count > 0) {
				setSelectedSource(n);
			}
			return;
		}
		if (selectedSource === n) {
			setSelectedSource(null);
			return;
		}
		if (!commitMove(selectedSource, n)) {
			if (state.bar[active] > 0) {
				return;
			}
			const point = state.points[n - 1];
			if (point.color === active && point.count > 0) {
				setSelectedSource(n);
			}
		}
	}

	function handleBar() {
		if (justDraggedRef.current || !movable) {
			return;
		}
		setNotice(null);
		if (selectedSource == null && state.bar[active] > 0) {
			setSelectedSource("bar");
		}
	}

	function handleOff() {
		if (justDraggedRef.current || !movable || selectedSource == null) {
			return;
		}
		setNotice(null);
		commitMove(selectedSource, "off");
	}

	function pointerDown(e: React.PointerEvent, from: BackgammonMoveSource) {
		setNotice(null);
		if (!movable || dragRef.current) {
			return;
		}
		if (from === "bar") {
			if (state.bar[active] <= 0) {
				return;
			}
		} else {
			if (state.bar[active] > 0) {
				return;
			}
			const point = state.points[from - 1];
			if (!point || point.color !== active || point.count <= 0) {
				return;
			}
		}
		e.preventDefault();
		const top = e.currentTarget.querySelector(
			from === "bar" ? `[data-top-checker="${active}"]` : "[data-top-checker]",
		);
		const rect = top?.getBoundingClientRect();
		const size = rect?.width || SIZE;
		const touch = e.pointerType === "touch";
		const key = boardKey;
		const pd: DragState = {
			from,
			startX: e.clientX,
			startY: e.clientY,
			phase: "pending",
			el: null,
			origin: rect ? center(rect) : { x: e.clientX, y: e.clientY },
			size,
			offsetY: touch ? LIFT_OFFSET * size : 0,
			over: null,
			landed: false,
			boardChanged: false,
			timer: null,
			stop: () => {},
		};
		const move = (ev: PointerEvent) => {
			if (pd.phase === "pending") {
				if (
					Math.hypot(ev.clientX - pd.startX, ev.clientY - pd.startY) <
					DRAG_THRESHOLD
				) {
					return;
				}
				pd.phase = "lifted";
				pd.el = liftedChecker(
					active,
					size,
					{ x: ev.clientX, y: ev.clientY - pd.offsetY },
					prefersReducedMotion(),
				);
				if (!touch) document.body.style.cursor = "grabbing";
				setSelectedSource(null);
				setDragView({ from, over: null, key });
			}
			if (pd.phase !== "lifted" || !pd.el) {
				return;
			}
			if (ev.cancelable) {
				ev.preventDefault();
			}
			// The target is what sits under the checker's centre, not under the finger.
			const x = ev.clientX;
			const y = ev.clientY - pd.offsetY;
			pd.el.style.left = `${x}px`;
			pd.el.style.top = `${y}px`;
			const next = dropTargetAt(x, y);
			if (next !== pd.over) {
				pd.over = next;
				setDragView({ from, over: next, key });
			}
		};
		const up = (ev: PointerEvent) => {
			pd.stop();
			if (pd.phase !== "lifted") {
				if (dragRef.current === pd) dragRef.current = null;
				return;
			}
			swallowClick();
			document.body.style.cursor = "";
			if (ev.type === "pointercancel") {
				springBack(pd);
				return;
			}
			const outcome = resolveBackgammonDrop(
				state,
				from,
				pd.over,
				options.autoCombine,
			);
			if (outcome.kind === "move") {
				// Settle on the landing ghost; the new board removes the checker.
				pd.phase = "settling";
				const landing = document
					.querySelector("[data-landing]")
					?.getBoundingClientRect();
				flyTo(
					pd.el,
					landing ? center(landing) : pd.origin,
					SETTLE_MS,
					SETTLE_CURVE,
					() => {
						pd.landed = true;
						if (pd.boardChanged) finishDrag(pd);
					},
				);
				pd.timer = setTimeout(() => finishDrag(pd), PENDING_MS);
				const sent = onPlan(outcome.plan);
				if (sent instanceof Promise)
					void sent.then((accepted) => {
						// Refused: no new board is coming, so give the checker back now.
						if (
							accepted === false &&
							dragRef.current === pd &&
							pd.phase === "settling" &&
							!pd.boardChanged
						)
							springBack(pd);
					});
				return;
			}
			if (outcome.kind === "reject") {
				setNotice(dropRejectionMessage(backgammon.board, outcome, state));
			}
			springBack(pd);
		};
		pd.stop = () => {
			window.removeEventListener("pointermove", move);
			window.removeEventListener("pointerup", up);
			window.removeEventListener("pointercancel", up);
		};
		dragRef.current = pd;
		window.addEventListener("pointermove", move, { passive: false });
		window.addEventListener("pointerup", up);
		window.addEventListener("pointercancel", up);
	}

	function renderCell(
		n: number,
		orientation: "down" | "up",
		colIndex: number,
		rowParity: number,
	) {
		const point = state.points[n - 1];
		const isDark = (colIndex + rowParity) % 2 === 0;
		const triColor = isDark ? DARK_POINT : LIGHT_POINT;
		const selected = source === n;
		const highlighted = highlights.points.has(n);
		const isHovered = hovered === n;
		const selectable =
			movable &&
			source == null &&
			state.bar[active] === 0 &&
			point.color === active &&
			point.count > 0;
		const down = orientation === "down";
		const W = 30;
		const H = 214;

		let ring = "none";
		if (selected) {
			ring = `inset 0 0 0 3px ${SELECTED_RING}, 0 0 16px rgba(244,226,176,0.55)`;
		} else if (isHovered) {
			ring = `inset 0 0 0 3px ${HOVER_RING}, 0 0 20px rgba(143,240,192,0.6)`;
		} else if (highlighted) {
			ring =
				"inset 0 0 0 3px rgba(120,220,170,0.85), 0 0 14px rgba(120,220,170,0.4)";
		} else if (selectable) {
			ring = "inset 0 0 0 2px rgba(244,226,176,0.30)";
		}

		// The lifted checker leaves its stack; a hovered point shows where it lands.
		const count = point.count - (dragView?.from === n ? 1 : 0);
		const hitsBlot = isHovered && point.color !== active && point.count === 1;
		const ghostOnTop = isHovered && !hitsBlot;
		const drawn = count + (ghostOnTop ? 1 : 0);
		const region = 196;
		let step = SIZE + 2;
		if (drawn > 5) {
			step = Math.max(15, Math.floor((region - SIZE) / (drawn - 1)));
		}

		return (
			// biome-ignore lint/a11y/useSemanticElements: point keeps its custom triangle styling; keyboard + aria added below
			<div
				key={n}
				data-dest={String(n)}
				onClick={() => handleCell(n)}
				onKeyDown={(e) => {
					if (e.key === "Enter" || e.key === " ") {
						e.preventDefault();
						handleCell(n);
					}
				}}
				role="button"
				tabIndex={movable ? 0 : -1}
				aria-label={
					point.count > 0
						? fmt(backgammon.board.pointOccupied, {
								number: n,
								count: point.count,
								color:
									point.color === "white"
										? backgammon.board.colorWhite
										: backgammon.board.colorBlack,
								checkerWord: plural(
									locale,
									point.count,
									backgammon.board.checkerWord,
								),
							})
						: fmt(backgammon.board.pointEmpty, { number: n })
				}
				onPointerDown={(e) => pointerDown(e, n)}
				style={{
					position: "relative",
					width: 60,
					height: 232,
					cursor: movable ? "pointer" : "default",
					borderRadius: 6,
					background: isHovered ? HOVER_FILL : undefined,
					boxShadow: ring,
					transition: "box-shadow 0.12s, filter 0.12s",
					touchAction: "none",
					zIndex: selected || highlighted || isHovered ? 2 : 1,
				}}
			>
				<div
					style={
						{
							position: "absolute",
							left: "50%",
							transform: "translateX(-50%)",
							[down ? "top" : "bottom"]: 0,
							width: 0,
							height: 0,
							borderLeft: `${W}px solid transparent`,
							borderRight: `${W}px solid transparent`,
							[down ? "borderTop" : "borderBottom"]: `${H}px solid ${triColor}`,
							filter: "drop-shadow(0 2px 2px rgba(0,0,0,0.22))",
							zIndex: 0,
						} as React.CSSProperties
					}
				/>
				{options.showNumbers ? (
					<div
						style={
							{
								position: "absolute",
								left: 0,
								right: 0,
								[down ? "bottom" : "top"]: 2,
								textAlign: "center",
								fontFamily: MONO,
								fontSize: 10,
								fontWeight: 600,
								color: isDark ? "rgba(255,244,224,0.55)" : "rgba(90,58,30,0.5)",
								zIndex: 1,
							} as React.CSSProperties
						}
					>
						{n}
					</div>
				) : null}
				<div
					style={
						{
							position: "absolute",
							left: 0,
							right: 0,
							[down ? "top" : "bottom"]: 8,
							display: "flex",
							flexDirection: down ? "column" : "column-reverse",
							alignItems: "center",
							zIndex: 1,
						} as React.CSSProperties
					}
				>
					{Array.from({ length: count }).map((_, i) => (
						<div
							// biome-ignore lint/suspicious/noArrayIndexKey: identical stacked checkers
							key={i}
							data-top-checker={i === count - 1 ? "" : undefined}
							style={checkerStyle(point.color, SIZE, i === 0 ? 0 : step - SIZE)}
						/>
					))}
					{ghostOnTop ? (
						<div
							data-landing=""
							style={{
								...ghostStyle(SIZE),
								marginTop: count === 0 ? 0 : step - SIZE,
							}}
						/>
					) : null}
				</div>
				{hitsBlot ? (
					// Lands on the blot's slot: the blot goes to the bar.
					<div
						data-landing=""
						style={
							{
								...ghostStyle(SIZE),
								position: "absolute",
								left: "50%",
								transform: "translateX(-50%)",
								[down ? "top" : "bottom"]: 8,
								zIndex: 2,
							} as React.CSSProperties
						}
					/>
				) : null}
				{count > 9 ? (
					<div
						style={
							{
								position: "absolute",
								left: "50%",
								transform: "translateX(-50%)",
								[down ? "top" : "bottom"]: 92,
								fontFamily: MONO,
								fontSize: 12,
								fontWeight: 700,
								color: point.color === "white" ? "#3a2a12" : "#f2e6cc",
								background:
									point.color === "white"
										? "rgba(255,250,235,0.9)"
										: "rgba(20,16,12,0.85)",
								borderRadius: 999,
								padding: "1px 7px",
								zIndex: 3,
								boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
							} as React.CSSProperties
						}
					>
						{count}
					</div>
				) : null}
			</div>
		);
	}

	const remaining = availableDieIndexes(state).length;
	const topLeft = [24, 23, 22, 21, 20, 19];
	const topRight = [18, 17, 16, 15, 14, 13];
	const botLeft = [1, 2, 3, 4, 5, 6];
	const botRight = [7, 8, 9, 10, 11, 12];

	const barActive = source === "bar";
	const barSelectable = movable && source == null && state.bar[active] > 0;
	const barCount = (color: BackgammonColor) =>
		Math.min(state.bar[color] - (color === active ? barHidden : 0), 5);

	const btnBase: React.CSSProperties = {
		fontFamily: MONO,
		fontSize: 11,
		fontWeight: 600,
		letterSpacing: "0.1em",
		textTransform: "uppercase",
		borderRadius: 8,
		padding: "9px 14px",
		cursor: "pointer",
	};

	let statusText: string;
	if (notice) {
		statusText = notice;
	} else if (statusOverride) {
		statusText = statusOverride;
	} else if (state.dice.length === 0) {
		statusText = interactive
			? backgammon.board.statusRollToBegin
			: backgammon.board.statusWaitingForDice;
	} else if (source != null) {
		statusText = plural(
			locale,
			remaining,
			backgammon.board.statusPickDestination,
		);
	} else if (remaining > 0) {
		statusText = interactive
			? plural(locale, remaining, backgammon.board.statusMovesAvailable)
			: plural(locale, remaining, backgammon.board.statusMovesLeftThisTurn);
	} else {
		statusText = backgammon.board.statusNoMovesLeft;
	}

	const ghostSlab: React.CSSProperties = {
		width: 58,
		height: 8,
		borderRadius: 3,
		boxSizing: "border-box",
		background: GHOST_FILL,
		border: `1px dashed ${GHOST_EDGE}`,
	};
	const halfStyle: React.CSSProperties = {
		position: "relative",
		display: "flex",
		flexDirection: "column",
		justifyContent: "space-between",
		minHeight: 520,
		padding: "12px 8px",
	};
	const rowStyle: React.CSSProperties = {
		display: "flex",
		gap: 2,
		justifyContent: "center",
	};

	return (
		<div
			style={{
				width: "100%",
				maxWidth: BACKGAMMON_DESIGN_WIDTH,
				display: "flex",
				flexDirection: "column",
				gap: 18,
				fontFamily: SERIF,
				userSelect: "none",
				WebkitUserSelect: "none",
			}}
		>
			{/* header: turn badge, dice, controls */}
			<div
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					gap: 16,
					flexWrap: "wrap",
				}}
			>
				<div
					style={{
						display: "inline-flex",
						alignItems: "center",
						gap: 8,
						padding: "5px 12px",
						borderRadius: 999,
						background:
							active === "white"
								? "rgba(247,238,214,0.14)"
								: "rgba(20,16,12,0.5)",
						border: `1px solid ${CONTROL_LINE}`,
						color: "#e9d9bd",
					}}
				>
					<span
						style={{
							width: 12,
							height: 12,
							borderRadius: "50%",
							background:
								active === "white"
									? "radial-gradient(circle at 36% 30%, #fffdf6, #d7c092)"
									: "radial-gradient(circle at 36% 30%, #5c554c, #100e0b)",
							border: `1px solid ${active === "white" ? "#b09863" : "#000"}`,
							boxShadow: "0 1px 2px rgba(0,0,0,0.4)",
						}}
					/>
					<span
						style={{
							fontFamily: MONO,
							fontSize: 11,
							fontWeight: 600,
							letterSpacing: "0.14em",
							textTransform: "uppercase",
						}}
					>
						{active === "white"
							? backgammon.board.whiteToMove
							: backgammon.board.blackToMove}
					</span>
				</div>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: 12,
						flexWrap: "wrap",
					}}
				>
					<div style={{ display: "flex", gap: 10 }}>
						{state.dice.length === 0 ? (
							<div
								style={{
									fontFamily: MONO,
									fontSize: 11,
									color: "#8a7f6c",
									alignSelf: "center",
									letterSpacing: "0.08em",
								}}
							>
								{backgammon.board.rollHint}
							</div>
						) : (
							state.dice.map((die, i) => (
								<Die
									// biome-ignore lint/suspicious/noArrayIndexKey: dice are positional
									key={i}
									value={die}
									used={state.used[i] ?? false}
								/>
							))
						)}
					</div>
					<button
						type="button"
						onClick={() => void onRoll?.()}
						disabled={!rollEnabled}
						style={{
							...btnBase,
							color: "#1a1610",
							background: "linear-gradient(180deg,#e7cf9d,#cbab72)",
							border: "1px solid #7c5f34",
							padding: "9px 16px",
							opacity: rollEnabled ? 1 : 0.4,
							cursor: rollEnabled ? "pointer" : "not-allowed",
							boxShadow:
								"0 2px 5px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.4)",
						}}
					>
						{backgammon.board.rollButton}
					</button>
					<button
						type="button"
						onClick={() => void onEndTurn?.()}
						disabled={!endTurnEnabled}
						style={{
							...btnBase,
							color: "#d9cbb2",
							background: "rgba(255,255,255,0.05)",
							border: `1px solid ${CONTROL_LINE}`,
							padding: "9px 16px",
							opacity: endTurnEnabled ? 1 : 0.4,
							cursor: endTurnEnabled ? "pointer" : "not-allowed",
						}}
					>
						{backgammon.board.endTurnButton}
					</button>
					{onUndo ? (
						<button
							type="button"
							onClick={onUndo}
							disabled={!canUndo}
							style={{
								...btnBase,
								color: "#e4d2ac",
								background: "rgba(233,217,189,0.1)",
								border: `1px solid ${CONTROL_LINE}`,
								opacity: canUndo ? 1 : 0.4,
								cursor: canUndo ? "pointer" : "not-allowed",
							}}
						>
							{backgammon.board.undoButton}
						</button>
					) : null}
					{onRedo ? (
						<button
							type="button"
							onClick={onRedo}
							disabled={!canRedo}
							style={{
								...btnBase,
								color: "#e4d2ac",
								background: "rgba(233,217,189,0.1)",
								border: `1px solid ${CONTROL_LINE}`,
								opacity: canRedo ? 1 : 0.4,
								cursor: canRedo ? "pointer" : "not-allowed",
							}}
						>
							{backgammon.board.redoButton}
						</button>
					) : null}
					{onReset ? (
						<button
							type="button"
							onClick={onReset}
							style={{
								...btnBase,
								color: "#9a8f7a",
								background: "transparent",
								border: `1px solid ${CONTROL_LINE}`,
							}}
						>
							{backgammon.board.resetButton}
						</button>
					) : null}
					{onToggleOption && optionKeys.length > 0 ? (
						<div style={{ position: "relative" }}>
							<button
								type="button"
								onClick={() => setOptionsOpen((open) => !open)}
								style={{
									fontFamily: MONO,
									fontSize: 15,
									color: "#d9cbb2",
									background: "rgba(255,255,255,0.05)",
									border: `1px solid ${CONTROL_LINE}`,
									borderRadius: 8,
									padding: "7px 12px",
									cursor: "pointer",
									lineHeight: 1,
								}}
							>
								⚙
							</button>
							{optionsOpen ? (
								<div
									style={{
										position: "absolute",
										right: 0,
										top: 44,
										zIndex: 20,
										width: 248,
										padding: 14,
										borderRadius: 12,
										background: "linear-gradient(160deg,#2c2018,#1c130c)",
										border: "1px solid rgba(233,217,189,0.18)",
										boxShadow: "0 20px 44px -12px rgba(0,0,0,0.8)",
										display: "flex",
										flexDirection: "column",
										gap: 4,
									}}
								>
									<div
										style={{
											fontFamily: MONO,
											fontSize: 10,
											letterSpacing: "0.18em",
											textTransform: "uppercase",
											color: "#8a7f6c",
											marginBottom: 6,
										}}
									>
										{backgammon.board.optionsHeading}
									</div>
									{optionKeys.map((key) => {
										const on = options[key];
										return (
											// biome-ignore lint/a11y/noStaticElementInteractions: prototype-styled toggle row
											// biome-ignore lint/a11y/useKeyWithClickEvents: prototype-styled toggle row
											<div
												key={key}
												onClick={() => onToggleOption(key)}
												style={{
													display: "flex",
													alignItems: "center",
													justifyContent: "space-between",
													gap: 10,
													padding: "8px 6px",
													borderRadius: 8,
													cursor: "pointer",
												}}
											>
												<span style={{ fontSize: 16, color: "#e4d5ba" }}>
													{optionLabels[key]}
												</span>
												<span
													style={{
														width: 38,
														height: 22,
														borderRadius: 999,
														position: "relative",
														flex: "0 0 auto",
														background: on
															? "linear-gradient(180deg,#7ecfa4,#4fa87c)"
															: "rgba(255,255,255,0.12)",
														border: `1px solid ${on ? "#3c8560" : CONTROL_LINE}`,
													}}
												>
													<span
														style={{
															position: "absolute",
															top: 2,
															left: on ? 18 : 2,
															width: 16,
															height: 16,
															borderRadius: "50%",
															background: "#f7efdd",
															boxShadow: "0 1px 2px rgba(0,0,0,0.4)",
															transition: "left 0.15s",
														}}
													/>
												</span>
											</div>
										);
									})}
								</div>
							) : null}
						</div>
					) : null}
				</div>
			</div>

			{/* board frame */}
			<div
				style={{
					position: "relative",
					borderRadius: 16,
					padding: 22,
					background:
						"linear-gradient(155deg,#4d2f1a 0%,#3a2313 48%,#2b190e 100%)",
					boxShadow:
						"0 30px 70px -20px rgba(0,0,0,0.85), inset 0 2px 0 rgba(255,255,255,0.06), inset 0 -3px 14px rgba(0,0,0,0.5)",
				}}
			>
				<div
					style={{
						position: "absolute",
						inset: 10,
						borderRadius: 9,
						pointerEvents: "none",
						boxShadow:
							"0 0 0 1px rgba(20,10,4,0.55), 0 0 0 2px rgba(220,190,140,0.10)",
					}}
				/>
				<div
					style={{
						position: "relative",
						display: "grid",
						gridTemplateColumns: "1fr 54px 1fr 86px",
						borderRadius: 8,
						overflow: "hidden",
						background:
							"radial-gradient(140% 120% at 50% 50%, #cda471 0%, #b98d55 65%, #a2743f 100%)",
						boxShadow: "inset 0 10px 24px rgba(0,0,0,0.4)",
					}}
				>
					<div style={halfStyle}>
						<div style={rowStyle}>
							{topLeft.map((n, i) => renderCell(n, "down", i, 0))}
						</div>
						<div style={rowStyle}>
							{botLeft.map((n, i) => renderCell(n, "up", i, 1))}
						</div>
					</div>

					{/* biome-ignore lint/a11y/noStaticElementInteractions: board surface */}
					{/* biome-ignore lint/a11y/useKeyWithClickEvents: board surface */}
					<div
						data-dest="bar"
						onClick={handleBar}
						onPointerDown={(e) => pointerDown(e, "bar")}
						style={{
							position: "relative",
							display: "flex",
							flexDirection: "column",
							alignItems: "center",
							justifyContent: "space-between",
							background:
								"linear-gradient(90deg, rgba(0,0,0,0.42), rgba(60,36,18,0.35) 50%, rgba(0,0,0,0.42))",
							boxShadow:
								"inset 6px 0 12px rgba(0,0,0,0.5), inset -6px 0 12px rgba(0,0,0,0.5)" +
								(barActive
									? ", inset 0 0 0 2px #f4e2b0"
									: barSelectable
										? ", inset 0 0 0 2px rgba(244,226,176,0.4)"
										: ""),
							cursor: barSelectable ? "pointer" : "default",
							touchAction: "none",
							zIndex: 3,
						}}
					>
						<div
							style={{
								display: "flex",
								flexDirection: "column",
								alignItems: "center",
								gap: 5,
								paddingTop: 10,
							}}
						>
							{Array.from({ length: barCount("black") }).map((_, i, all) => (
								<div
									// biome-ignore lint/suspicious/noArrayIndexKey: identical stacked checkers
									key={i}
									data-top-checker={i === all.length - 1 ? "black" : undefined}
									style={checkerStyle("black", 34, i === 0 ? 0 : -8)}
								/>
							))}
						</div>
						<div
							style={{
								writingMode: "vertical-rl",
								fontFamily: MONO,
								fontSize: 10,
								letterSpacing: "0.32em",
								textTransform: "uppercase",
								color: "rgba(233,217,189,0.5)",
							}}
						>
							{backgammon.board.barLabel}
						</div>
						<div
							style={{
								display: "flex",
								flexDirection: "column-reverse",
								alignItems: "center",
								gap: 5,
								paddingBottom: 10,
							}}
						>
							{Array.from({ length: barCount("white") }).map((_, i, all) => (
								<div
									// biome-ignore lint/suspicious/noArrayIndexKey: identical stacked checkers
									key={i}
									data-top-checker={i === all.length - 1 ? "white" : undefined}
									style={checkerStyle("white", 34, i === 0 ? 0 : -8)}
								/>
							))}
						</div>
					</div>

					<div style={halfStyle}>
						<div style={rowStyle}>
							{topRight.map((n, i) => renderCell(n, "down", i, 0))}
						</div>
						<div style={rowStyle}>
							{botRight.map((n, i) => renderCell(n, "up", i, 1))}
						</div>
					</div>

					{/* bear-off tray */}
					{/* biome-ignore lint/a11y/noStaticElementInteractions: board surface */}
					{/* biome-ignore lint/a11y/useKeyWithClickEvents: board surface */}
					<div
						data-dest="off"
						onClick={handleOff}
						style={{
							position: "relative",
							display: "flex",
							flexDirection: "column",
							justifyContent: "space-between",
							background: "linear-gradient(180deg,#3a2313,#28170c)",
							boxShadow:
								"inset 4px 0 10px rgba(0,0,0,0.55), inset 0 2px 5px rgba(0,0,0,0.5)" +
								(hovered === "off"
									? `, inset 0 0 0 3px ${HOVER_RING}, 0 0 20px rgba(143,240,192,0.6)`
									: highlights.off
										? ", inset 0 0 0 2px rgba(120,220,170,0.8)"
										: ""),
							backgroundColor: hovered === "off" ? HOVER_FILL : undefined,
							cursor: movable && source != null ? "pointer" : "default",
							zIndex: 3,
						}}
					>
						<div
							style={{
								display: "flex",
								flexDirection: "column",
								alignItems: "center",
								gap: 3,
								padding: "8px 0",
							}}
						>
							<div
								style={{
									fontFamily: MONO,
									fontSize: 9,
									letterSpacing: "0.18em",
									color: "rgba(233,217,189,0.42)",
									textTransform: "uppercase",
								}}
							>
								{backgammon.board.offLabel}
							</div>
							{Array.from({ length: Math.min(state.off.black, 12) }).map(
								(_, i) => (
									<div
										// biome-ignore lint/suspicious/noArrayIndexKey: identical stacked chips
										key={i}
										style={{
											width: 58,
											height: 8,
											borderRadius: 3,
											background: "linear-gradient(180deg,#4a443c,#161311)",
											boxShadow:
												"0 1px 2px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.25)",
											border: "1px solid #000",
										}}
									/>
								),
							)}
							<div
								style={{
									fontFamily: MONO,
									fontSize: 13,
									fontWeight: 700,
									color: "#e9d9bd",
								}}
							>
								{state.off.black}
							</div>
							{hovered === "off" && active === "black" ? (
								<div data-landing="" style={ghostSlab} />
							) : null}
						</div>
						<div
							style={{
								display: "flex",
								flexDirection: "column",
								alignItems: "center",
								gap: 3,
								padding: "8px 0",
							}}
						>
							<div
								style={{
									fontFamily: MONO,
									fontSize: 13,
									fontWeight: 700,
									color: "#f2e6cc",
								}}
							>
								{state.off.white}
							</div>
							{hovered === "off" && active === "white" ? (
								<div data-landing="" style={ghostSlab} />
							) : null}
							{Array.from({ length: Math.min(state.off.white, 12) }).map(
								(_, i) => (
									<div
										// biome-ignore lint/suspicious/noArrayIndexKey: identical stacked chips
										key={i}
										style={{
											width: 58,
											height: 8,
											borderRadius: 3,
											background: "linear-gradient(180deg,#f6ead0,#d5bd8f)",
											boxShadow:
												"0 1px 2px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.25)",
											border: "1px solid #b39d6f",
										}}
									/>
								),
							)}
						</div>
					</div>
				</div>
			</div>

			<div
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					gap: 12,
					padding: "0 4px",
					flexWrap: "wrap",
				}}
			>
				<div
					style={{
						fontFamily: MONO,
						fontSize: 11,
						letterSpacing: "0.04em",
						color: "#a89a80",
					}}
				>
					{statusText}
				</div>
				{/* Read out the rejection sentence only, so the moves count stays quiet. */}
				<div
					role="status"
					aria-live="polite"
					style={{
						position: "absolute",
						width: 1,
						height: 1,
						overflow: "hidden",
						clipPath: "inset(50%)",
						whiteSpace: "nowrap",
					}}
				>
					{notice ?? ""}
				</div>
				<div
					style={{
						fontFamily: MONO,
						fontSize: 11,
						letterSpacing: "0.06em",
						color: "#6f6552",
					}}
				>
					{backgammon.board.dragHint}
				</div>
			</div>
		</div>
	);
}
