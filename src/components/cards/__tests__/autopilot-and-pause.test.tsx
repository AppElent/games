// @vitest-environment jsdom
import { ROUND_PAUSE_MS } from "@arcadeclub/core/cards/table-view";
import {
	act,
	cleanup,
	render,
	renderHook,
	screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "#/lib/i18n";
import { TurnStatus } from "../Table";
import type { CardTableBundle, CardTableControls } from "../useCardTable";
import { useRoundPause } from "../useRoundPause";

function tableOf(autopilot: boolean) {
	const seat = (own: boolean) => ({
		botIndex: null,
		name: own ? "Me" : "Them",
		autopilot: own && autopilot,
		lastSeen: null,
	});
	return {
		you: 0,
		seats: [seat(true), seat(false)],
	} as unknown as CardTableBundle;
}

function renderStatus(autopilot: boolean, mine: boolean) {
	const controls = { setAutopilot: vi.fn() } as unknown as CardTableControls;
	return render(
		<LocaleProvider initialLocale="en">
			<TurnStatus
				table={tableOf(autopilot)}
				controls={controls}
				events={[]}
				turn={0}
				live
				mine={mine}
				hint={null}
			>
				<button type="button">Another card</button>
			</TurnStatus>
		</LocaleProvider>,
	);
}

describe("TurnStatus on autopilot", () => {
	afterEach(cleanup);

	it("offers the player's moves on their own turn", () => {
		renderStatus(false, true);
		expect(screen.getByRole("button", { name: "Another card" })).toBeTruthy();
	});

	it("hides the player's moves while the computer plays the seat, keeping the way back", () => {
		renderStatus(true, false);
		expect(screen.queryByRole("button", { name: "Another card" })).toBeNull();
		expect(
			screen.getByRole("button", { name: "Take my seat back" }),
		).toBeTruthy();
	});
});

describe("useRoundPause", () => {
	afterEach(() => vi.useRealTimers());

	it("holds for a moment after the round changes, not on first show", () => {
		vi.useFakeTimers();
		const { result, rerender } = renderHook(
			({ round }) => useRoundPause(round),
			{ initialProps: { round: 1 } },
		);
		expect(result.current).toBe(false);
		rerender({ round: 2 });
		expect(result.current).toBe(true);
		act(() => {
			vi.advanceTimersByTime(ROUND_PAUSE_MS);
		});
		expect(result.current).toBe(false);
	});
});
