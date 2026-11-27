// @vitest-environment jsdom
import {
	applyBackgammonPlan,
	type BackgammonMovePlan,
	type BackgammonTurnState,
	createInitialBackgammonState,
	withBackgammonDice,
} from "@arcadeclub/core/backgammon";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "#/lib/i18n";
import { BackgammonBoard } from "../BackgammonBoard";

/** White to move with 3-1, a lone black checker on 21: 24 → 21 hits it. */
function blotOn21(): BackgammonTurnState {
	const state = withBackgammonDice(createInitialBackgammonState(), [3, 1]);
	const points = state.points.map((p) => ({ ...p }));
	points[16] = { point: 17, color: "black", count: 2 };
	points[20] = { point: 21, color: "black", count: 1 };
	return { ...state, points };
}

function point(container: HTMLElement, n: number) {
	const el = container.querySelector(`[data-dest="${n}"]`);
	if (!el) throw new Error(`point ${n} not rendered`);
	return el;
}

function barCheckers(container: HTMLElement) {
	return container.querySelectorAll('[data-bar-stack="black"] > *').length;
}

function slides() {
	return document.body.querySelectorAll("[data-hit-slide]");
}

/** White to move with 2-1, lone black checkers on 23, 22 and 21: 24 → 21 hits two on the way. */
function blotsOnTheWay(): BackgammonTurnState {
	const state = withBackgammonDice(createInitialBackgammonState(), [2, 1]);
	const points = state.points.map((p) => ({ ...p }));
	points[20] = { point: 21, color: "black", count: 1 };
	points[21] = { point: 22, color: "black", count: 1 };
	points[22] = { point: 23, color: "black", count: 1 };
	return { ...state, points };
}

type Mode = "local" | "local-pass" | "online" | "refused";

/**
 * A board whose `onPlan` answers like the caller: local applies the plan at
 * once, online applies one step per server call, refused changes nothing.
 */
function playBoard(start = blotOn21(), mode: Mode = "local") {
	let state = start;
	const show = (next: BackgammonTurnState) => {
		state = next;
		utils.rerender(view(state));
	};
	const view = (s: BackgammonTurnState) => (
		<LocaleProvider initialLocale="en">
			<BackgammonBoard
				state={s}
				interactive
				canRoll={false}
				canEndTurn={false}
				options={{
					showNumbers: false,
					autoCombine: mode === "online",
					autoSwitchTurn: false,
				}}
				onPlan={async (plan: BackgammonMovePlan) => {
					if (mode === "refused") return false;
					if (mode === "local") {
						show(applyBackgammonPlan(state, plan));
						return true;
					}
					if (mode === "local-pass") {
						// Auto switch turn: the move and the pass land as one board.
						const moved = applyBackgammonPlan(state, plan);
						show({ ...moved, activeColor: "black", dice: [], used: [] });
						return true;
					}
					for (const step of plan.steps) {
						await Promise.resolve();
						show(applyBackgammonPlan(state, { steps: [step] }));
					}
					return true;
				}}
			/>
		</LocaleProvider>
	);
	const utils = render(view(state));
	return utils.container;
}

function setReducedMotion(reduce: boolean) {
	window.matchMedia = ((query: string) => ({
		matches: reduce && query.includes("reduce"),
		media: query,
		addEventListener() {},
		removeEventListener() {},
	})) as unknown as typeof window.matchMedia;
}

describe("BackgammonBoard hit slide", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		setReducedMotion(false);
	});
	afterEach(() => {
		cleanup();
		vi.useRealTimers();
	});

	it("slides a blot hit by a tap move to the bar in 220 ms", () => {
		const container = playBoard();
		fireEvent.click(point(container, 24));
		fireEvent.click(point(container, 21));

		// The blot is in the air: its bar slot stays empty until it arrives.
		expect(slides()).toHaveLength(1);
		expect(barCheckers(container)).toBe(0);
		act(() => {
			vi.advanceTimersByTime(20);
		});
		const slide = slides()[0] as HTMLElement;
		expect(slide.style.transition).toContain("220ms cubic-bezier(.2,.8,.2,1)");

		act(() => {
			vi.advanceTimersByTime(220);
		});
		expect(slides()).toHaveLength(0);
		expect(barCheckers(container)).toBe(1);
	});

	it("slides a blot hit by a drag move to the bar", () => {
		const container = playBoard();
		document.elementFromPoint = () => point(container, 21);
		fireEvent.pointerDown(point(container, 24), { clientX: 0, clientY: 0 });
		fireEvent.pointerMove(window, { clientX: 40, clientY: 0 });
		fireEvent.pointerUp(window);

		expect(slides()).toHaveLength(1);
		expect(barCheckers(container)).toBe(0);
		act(() => {
			vi.advanceTimersByTime(300);
		});
		expect(slides()).toHaveLength(0);
		expect(barCheckers(container)).toBe(1);
	});

	it("slides each blot as its step lands online, one server call per step", async () => {
		const container = playBoard(blotsOnTheWay(), "online");
		fireEvent.click(point(container, 24));
		await act(async () => {
			fireEvent.click(point(container, 21));
			await Promise.resolve();
			await Promise.resolve();
			await Promise.resolve();
		});

		// Two steps, two hits: both blots in the air, both bar slots still empty.
		expect(slides()).toHaveLength(2);
		expect(barCheckers(container)).toBe(0);
		act(() => {
			vi.advanceTimersByTime(300);
		});
		expect(slides()).toHaveLength(0);
		expect(barCheckers(container)).toBe(2);
	});

	it("slides the blot when the hitting move also passes the turn", () => {
		const container = playBoard(blotOn21(), "local-pass");
		fireEvent.click(point(container, 24));
		fireEvent.click(point(container, 21));

		expect(slides()).toHaveLength(1);
		expect(barCheckers(container)).toBe(0);
		act(() => {
			vi.advanceTimersByTime(300);
		});
		expect(barCheckers(container)).toBe(1);
	});

	it("slides nothing when the move is refused", async () => {
		const container = playBoard(blotOn21(), "refused");
		await act(async () => {
			fireEvent.click(point(container, 24));
			fireEvent.click(point(container, 21));
			await Promise.resolve();
		});
		expect(slides()).toHaveLength(0);
		expect(barCheckers(container)).toBe(0);
	});

	it("puts the blot on the bar at once under reduced motion", () => {
		setReducedMotion(true);
		const container = playBoard();
		fireEvent.click(point(container, 24));
		fireEvent.click(point(container, 21));

		expect(slides()).toHaveLength(0);
		expect(barCheckers(container)).toBe(1);
	});
});
