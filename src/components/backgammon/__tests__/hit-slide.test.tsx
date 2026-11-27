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

/** A board whose `onPlan` applies the move, like local play. */
function playBoard() {
	let state = blotOn21();
	const view = (s: BackgammonTurnState) => (
		<LocaleProvider initialLocale="en">
			<BackgammonBoard
				state={s}
				interactive
				canRoll={false}
				canEndTurn={false}
				options={{
					showNumbers: false,
					autoCombine: false,
					autoSwitchTurn: false,
				}}
				onPlan={(plan: BackgammonMovePlan) => {
					state = applyBackgammonPlan(state, plan);
					utils.rerender(view(state));
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

	it("puts the blot on the bar at once under reduced motion", () => {
		setReducedMotion(true);
		const container = playBoard();
		fireEvent.click(point(container, 24));
		fireEvent.click(point(container, 21));

		expect(slides()).toHaveLength(0);
		expect(barCheckers(container)).toBe(1);
	});
});
