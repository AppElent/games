// @vitest-environment jsdom
import {
	type BackgammonTurnState,
	createInitialBackgammonState,
	withBackgammonDice,
} from "@arcadeclub/core/backgammon";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "#/lib/i18n";
import { BackgammonBoard } from "../BackgammonBoard";

function board(state: BackgammonTurnState, onPlan: () => void) {
	return (
		<LocaleProvider initialLocale="en">
			<BackgammonBoard
				state={state}
				interactive
				canRoll={false}
				canEndTurn={false}
				options={{
					showNumbers: false,
					autoCombine: false,
					autoSwitchTurn: false,
				}}
				onPlan={onPlan}
			/>
		</LocaleProvider>
	);
}

function point(container: HTMLElement, n: number) {
	const el = container.querySelector(`[data-dest="${n}"]`);
	if (!el) throw new Error(`point ${n} not rendered`);
	return el;
}

describe("BackgammonBoard click after a cancelled drag", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		// jsdom has no layout: nothing sits under the dragged checker.
		document.elementFromPoint = () => null;
	});
	afterEach(() => {
		cleanup();
		vi.useRealTimers();
	});

	it("ignores the release click however long the button was held", () => {
		const onPlan = vi.fn();
		const start = withBackgammonDice(createInitialBackgammonState(), [3, 1]);
		const { container, rerender } = render(board(start, onPlan));

		// Lift a checker from point 24.
		fireEvent.pointerDown(point(container, 24), { clientX: 0, clientY: 0 });
		fireEvent.pointerMove(window, { clientX: 40, clientY: 0 });

		// A new board arrives while the button is down: the checker springs back.
		rerender(board(withBackgammonDice(start, [3, 2]), onPlan));

		// The player keeps the button down well past the old 300 ms window.
		act(() => {
			vi.advanceTimersByTime(1000);
		});

		// Releasing over the pressed point fires a click there: it must not pick a checker.
		fireEvent.pointerUp(window);
		fireEvent.click(point(container, 24));
		act(() => {
			vi.advanceTimersByTime(400);
		});

		// Had point 24 been picked, this tap would move a checker 24 → 21.
		fireEvent.click(point(container, 21));
		expect(onPlan).not.toHaveBeenCalled();

		// The guard ends: a fresh tap selects and moves as usual.
		fireEvent.click(point(container, 24));
		fireEvent.click(point(container, 21));
		expect(onPlan).toHaveBeenCalledTimes(1);
	});
});
