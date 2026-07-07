import { useEffect, useRef, useState } from "react";
import {
	availableDieIndexes,
	type BackgammonColor,
	type BackgammonMoveDestination,
	type BackgammonMovePlan,
	type BackgammonMoveSource,
	type BackgammonTurnState,
	canMoveNow,
	getMoveHighlights,
	planBackgammonMove,
} from "#/lib/games/backgammon";

/**
 * Backgammon board from the Claude Design handoff, converted to a controlled
 * component: all rules live in #/lib/games/backgammon and the game state is
 * owned by the caller (local hook or Convex bundle). Supports click and drag
 * (mouse + touch) and combined two-die moves.
 */

export type BackgammonBoardOptions = {
	showNumbers: boolean;
	autoRoll: boolean;
	autoSwitchTurn: boolean;
	autoCombine: boolean;
};

export type BackgammonOptionKey = keyof BackgammonBoardOptions;

const OPTION_LABELS: Record<BackgammonOptionKey, string> = {
	showNumbers: "Show point numbers",
	autoRoll: "Auto-roll",
	autoSwitchTurn: "Auto end turn",
	autoCombine: "Combine two dice",
};

type Props = {
	state: BackgammonTurnState;
	/** May the viewer move checkers right now (it is their turn)? */
	interactive: boolean;
	canRoll: boolean;
	canEndTurn: boolean;
	options: BackgammonBoardOptions;
	/** Which options appear in the gear menu; menu hidden when empty. */
	optionKeys?: BackgammonOptionKey[];
	onToggleOption?: (key: BackgammonOptionKey) => void;
	onPlan: (plan: BackgammonMovePlan) => void | Promise<void>;
	onRoll?: () => void | Promise<void>;
	onEndTurn?: () => void | Promise<void>;
	onUndo?: () => void;
	onRedo?: () => void;
	onReset?: () => void;
	canUndo?: boolean;
	canRedo?: boolean;
	statusOverride?: string;
	lightPoint?: string;
	darkPoint?: string;
};

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

type DragState = {
	from: BackgammonMoveSource;
	startX: number;
	startY: number;
	dragging: boolean;
	ghost: HTMLDivElement | null;
};

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

function makeGhost(color: BackgammonColor) {
	const el = document.createElement("div");
	Object.assign(el.style, {
		position: "fixed",
		zIndex: "9999",
		width: "44px",
		height: "44px",
		borderRadius: "50%",
		transform: "translate(-50%,-50%)",
		pointerEvents: "none",
		left: "-100px",
		top: "-100px",
		background:
			color === "white"
				? "radial-gradient(circle at 36% 28%, #fffdf6 0%, #f3e6c4 46%, #d7c092 100%)"
				: "radial-gradient(circle at 36% 28%, #5c554c 0%, #2a2620 46%, #100e0b 100%)",
		border: color === "white" ? "1px solid #b09863" : "1px solid #000",
		boxShadow: "0 6px 14px rgba(0,0,0,0.55)",
		opacity: "0.92",
	} as Partial<CSSStyleDeclaration>);
	document.body.appendChild(el);
	return el;
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
	lightPoint = "#e7d2a4",
	darkPoint = "#a54c38",
}: Props) {
	const [selectedSource, setSelectedSource] =
		useState<BackgammonMoveSource | null>(null);
	const [optionsOpen, setOptionsOpen] = useState(false);
	const dragRef = useRef<DragState | null>(null);
	const justDraggedRef = useRef(false);

	const active = state.activeColor;
	const movable = interactive && canMoveNow(state);

	// biome-ignore lint/correctness/useExhaustiveDependencies: clear stale selection when the turn changes hands
	useEffect(() => {
		setSelectedSource(null);
	}, [active]);

	const highlights = movable
		? getMoveHighlights(state, selectedSource, options.autoCombine)
		: { points: new Set<number>(), off: false };

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
		if (selectedSource == null && state.bar[active] > 0) {
			setSelectedSource("bar");
		}
	}

	function handleOff() {
		if (!movable || selectedSource == null) {
			return;
		}
		commitMove(selectedSource, "off");
	}

	function pointerDown(e: React.PointerEvent, from: BackgammonMoveSource) {
		if (!movable) {
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
		const drag: DragState = {
			from,
			startX: e.clientX,
			startY: e.clientY,
			dragging: false,
			ghost: null,
		};
		dragRef.current = drag;
		const move = (ev: PointerEvent) => {
			const pd = dragRef.current;
			if (!pd) {
				return;
			}
			if (!pd.dragging) {
				if (Math.hypot(ev.clientX - pd.startX, ev.clientY - pd.startY) < 6) {
					return;
				}
				pd.dragging = true;
				pd.ghost = makeGhost(active);
				setSelectedSource(pd.from);
			}
			if (ev.cancelable) {
				ev.preventDefault();
			}
			if (pd.ghost) {
				pd.ghost.style.left = `${ev.clientX}px`;
				pd.ghost.style.top = `${ev.clientY}px`;
			}
		};
		const up = (ev: PointerEvent) => {
			window.removeEventListener("pointermove", move);
			window.removeEventListener("pointerup", up);
			window.removeEventListener("pointercancel", up);
			const pd = dragRef.current;
			dragRef.current = null;
			if (!pd) {
				return;
			}
			pd.ghost?.remove();
			if (!pd.dragging) {
				return;
			}
			justDraggedRef.current = true;
			setTimeout(() => {
				justDraggedRef.current = false;
			}, 300);
			const el = document.elementFromPoint(ev.clientX, ev.clientY);
			const target = el?.closest?.("[data-dest]");
			if (!target) {
				return;
			}
			const raw = target.getAttribute("data-dest");
			if (raw === null || raw === "bar") {
				return;
			}
			const dest: BackgammonMoveDestination =
				raw === "off" ? "off" : Number.parseInt(raw, 10);
			commitMove(pd.from, dest);
		};
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
		const triColor = isDark ? darkPoint : lightPoint;
		const selected = selectedSource === n;
		const highlighted = highlights.points.has(n);
		const selectable =
			movable &&
			selectedSource == null &&
			state.bar[active] === 0 &&
			point.color === active &&
			point.count > 0;
		const down = orientation === "down";
		const W = 30;
		const H = 214;

		let ring = "none";
		if (selected) {
			ring = "inset 0 0 0 3px #f4e2b0, 0 0 16px rgba(244,226,176,0.55)";
		} else if (highlighted) {
			ring =
				"inset 0 0 0 3px rgba(120,220,170,0.85), 0 0 14px rgba(120,220,170,0.4)";
		} else if (selectable) {
			ring = "inset 0 0 0 2px rgba(244,226,176,0.30)";
		}

		const count = point.count;
		const region = 196;
		let step = SIZE + 2;
		if (count > 5) {
			step = Math.max(15, Math.floor((region - SIZE) / (count - 1)));
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
				aria-label={`Point ${n}${
					point.count > 0
						? `, ${point.count} ${point.color} checker${point.count === 1 ? "" : "s"}`
						: ", empty"
				}`}
				onPointerDown={(e) => pointerDown(e, n)}
				style={{
					position: "relative",
					width: 60,
					height: 232,
					cursor: movable ? "pointer" : "default",
					borderRadius: 6,
					boxShadow: ring,
					transition: "box-shadow 0.12s, filter 0.12s",
					touchAction: "none",
					zIndex: selected || highlighted ? 2 : 1,
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
							style={checkerStyle(point.color, SIZE, i === 0 ? 0 : step - SIZE)}
						/>
					))}
				</div>
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

	const barActive = selectedSource === "bar";
	const barSelectable =
		movable && selectedSource == null && state.bar[active] > 0;

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
	if (statusOverride) {
		statusText = statusOverride;
	} else if (state.dice.length === 0) {
		statusText = interactive
			? "Roll the dice to begin"
			: "Waiting for the dice";
	} else if (selectedSource != null) {
		statusText = `Pick a destination — ${remaining} move(s) left`;
	} else if (remaining > 0) {
		statusText = interactive
			? `${remaining} move(s) available`
			: `${remaining} move(s) left this turn`;
	} else {
		statusText = "No moves left — end the turn";
	}

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
				maxWidth: 1060,
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
						border: `1px solid ${active === "white" ? "rgba(233,217,189,0.4)" : "rgba(233,217,189,0.22)"}`,
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
						{active === "white" ? "White to move" : "Black to move"}
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
								— roll the dice —
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
					{onRoll ? (
						<button
							type="button"
							onClick={() => void onRoll()}
							disabled={!canRoll}
							style={{
								...btnBase,
								color: "#1a1610",
								background: "linear-gradient(180deg,#e7cf9d,#cbab72)",
								border: "1px solid #7c5f34",
								padding: "9px 16px",
								opacity: canRoll ? 1 : 0.4,
								cursor: canRoll ? "pointer" : "not-allowed",
								boxShadow:
									"0 2px 5px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.4)",
							}}
						>
							Roll
						</button>
					) : null}
					{onEndTurn ? (
						<button
							type="button"
							onClick={() => void onEndTurn()}
							disabled={!canEndTurn}
							style={{
								...btnBase,
								color: "#d9cbb2",
								background: "rgba(255,255,255,0.05)",
								border: "1px solid rgba(233,217,189,0.22)",
								padding: "9px 16px",
								opacity: canEndTurn ? 1 : 0.4,
								cursor: canEndTurn ? "pointer" : "not-allowed",
							}}
						>
							End turn
						</button>
					) : null}
					{onUndo ? (
						<button
							type="button"
							onClick={onUndo}
							disabled={!canUndo}
							style={{
								...btnBase,
								color: "#e4d2ac",
								background: "rgba(233,217,189,0.1)",
								border: "1px solid rgba(233,217,189,0.28)",
								opacity: canUndo ? 1 : 0.4,
								cursor: canUndo ? "pointer" : "not-allowed",
							}}
						>
							↶ Undo
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
								border: "1px solid rgba(233,217,189,0.28)",
								opacity: canRedo ? 1 : 0.4,
								cursor: canRedo ? "pointer" : "not-allowed",
							}}
						>
							↷ Redo
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
								border: "1px solid rgba(233,217,189,0.14)",
							}}
						>
							Reset
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
									border: "1px solid rgba(233,217,189,0.22)",
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
										Options
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
													{OPTION_LABELS[key]}
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
														border: `1px solid ${on ? "#3c8560" : "rgba(233,217,189,0.2)"}`,
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
					{/* left half */}
					<div style={halfStyle}>
						<div style={rowStyle}>
							{topLeft.map((n, i) => renderCell(n, "down", i, 0))}
						</div>
						<div style={rowStyle}>
							{botLeft.map((n, i) => renderCell(n, "up", i, 1))}
						</div>
					</div>

					{/* bar */}
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
							{Array.from({ length: Math.min(state.bar.black, 5) }).map(
								(_, i) => (
									<div
										// biome-ignore lint/suspicious/noArrayIndexKey: identical stacked checkers
										key={i}
										style={checkerStyle("black", 34, i === 0 ? 0 : -8)}
									/>
								),
							)}
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
							Bar
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
							{Array.from({ length: Math.min(state.bar.white, 5) }).map(
								(_, i) => (
									<div
										// biome-ignore lint/suspicious/noArrayIndexKey: identical stacked checkers
										key={i}
										style={checkerStyle("white", 34, i === 0 ? 0 : -8)}
									/>
								),
							)}
						</div>
					</div>

					{/* right half */}
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
								(highlights.off
									? ", inset 0 0 0 2px rgba(120,220,170,0.8)"
									: ""),
							cursor: movable && selectedSource != null ? "pointer" : "default",
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
								Off
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
				<div
					style={{
						fontFamily: MONO,
						fontSize: 11,
						letterSpacing: "0.06em",
						color: "#6f6552",
					}}
				>
					Click or drag a checker — two dice can combine into one move
				</div>
			</div>
		</div>
	);
}
