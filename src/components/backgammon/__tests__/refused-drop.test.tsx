// @vitest-environment jsdom
import {
	type BackgammonMovePlan,
	createInitialBackgammonState,
	withBackgammonDice,
} from "@arcadeclub/core/backgammon";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "#/lib/i18n";
import { BackgammonBoard } from "../BackgammonBoard";

function point(container: HTMLElement, n: number) {
	const el = container.querySelector(`[data-dest="${n}"]`);
	if (!el) throw new Error(`point ${n} not rendered`);
	return el;
}

/** The checkers drawn on point `n`, not counting a landing ghost. */
function stack(container: HTMLElement, n: number) {
	const top = point(container, n).querySelector("[data-top-checker]");
	return top?.parentElement?.querySelectorAll(":scope > :not([data-landing])")
		.length;
}

/** The checker following the pointer, appended to the page body. */
function liftedChecker() {
	return document.body.querySelector('[style*="z-index: 9999"]');
}

/** Drags a checker from 24 onto 21 and lets go; `onPlan` answers with `answer`. */
function dropOn21(answer: Promise<boolean>) {
	const onPlan = vi.fn((_plan: BackgammonMovePlan) => answer);
	const state = withBackgammonDice(createInitialBackgammonState(), [3, 1]);
	const { container } = render(
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
		</LocaleProvider>,
	);
	// Whatever sits under the dragged checker is point 21.
	document.elementFromPoint = () => point(container, 21);
	const before = stack(container, 24);
	fireEvent.pointerDown(point(container, 24), { clientX: 0, clientY: 0 });
	fireEvent.pointerMove(window, { clientX: 40, clientY: 0 });
	fireEvent.pointerUp(window);
	return { container, onPlan, before };
}

describe("BackgammonBoard drop the server refuses", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		cleanup();
		vi.useRealTimers();
	});

	it("gives the checker back to its stack as soon as the move is refused", async () => {
		const { container, onPlan, before } = dropOn21(Promise.resolve(false));
		expect(onPlan).toHaveBeenCalledTimes(1);

		// The refusal arrives; the checker springs back in well under the 4 s hold.
		await act(async () => {
			await Promise.resolve();
		});
		act(() => {
			vi.advanceTimersByTime(300);
		});
		expect(liftedChecker()).toBeNull();
		expect(stack(container, 24)).toBe(before);
	});

	it("keeps holding the checker on its landing spot while the move is accepted", async () => {
		const { container, before } = dropOn21(Promise.resolve(true));
		await act(async () => {
			await Promise.resolve();
		});
		act(() => {
			vi.advanceTimersByTime(300);
		});
		// No new board yet: the source stays one short and the checker waits.
		expect(liftedChecker()).not.toBeNull();
		expect(stack(container, 24)).toBe((before ?? 0) - 1);
	});
});
