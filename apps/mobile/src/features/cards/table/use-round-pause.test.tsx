import { ROUND_PAUSE_MS } from "@arcadeclub/core/cards/table-view";
import { act, renderHook } from "@testing-library/react-native";
import { useRoundPause } from "./use-round-pause";

describe("useRoundPause", () => {
	beforeEach(() => jest.useFakeTimers());
	afterEach(() => jest.useRealTimers());

	it("holds for a moment after the round changes, not on first show", async () => {
		const { result, rerender } = await renderHook(
			({ round }: { round: number }) => useRoundPause(round),
			{ initialProps: { round: 1 } },
		);
		expect(result.current).toBe(false);
		await rerender({ round: 2 });
		expect(result.current).toBe(true);
		await act(async () => {
			jest.advanceTimersByTime(ROUND_PAUSE_MS);
		});
		expect(result.current).toBe(false);
	});
});
