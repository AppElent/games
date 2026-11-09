// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCopyFeedback } from "#/lib/use-copy-feedback";

function stubClipboard(writeText: ((text: string) => Promise<void>) | null) {
	Object.defineProperty(navigator, "clipboard", {
		configurable: true,
		value: writeText ? { writeText } : undefined,
	});
}

describe("useCopyFeedback", () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => {
		cleanup();
		vi.useRealTimers();
	});

	it("shows copied for two seconds after a copy that worked", async () => {
		const written: string[] = [];
		stubClipboard(async (text) => {
			written.push(text);
		});
		const { result } = renderHook(() => useCopyFeedback());
		let ok: boolean | undefined;
		await act(async () => {
			ok = await result.current.copy("ABC123");
		});
		expect(ok).toBe(true);
		expect(written).toEqual(["ABC123"]);
		expect(result.current.copied).toBe(true);
		act(() => vi.advanceTimersByTime(1999));
		expect(result.current.copied).toBe(true);
		act(() => vi.advanceTimersByTime(1));
		expect(result.current.copied).toBe(false);
	});

	it("restarts the two seconds on a second copy", async () => {
		stubClipboard(async () => undefined);
		const { result } = renderHook(() => useCopyFeedback());
		await act(() => result.current.copy("a"));
		act(() => vi.advanceTimersByTime(1500));
		await act(() => result.current.copy("b"));
		act(() => vi.advanceTimersByTime(1500));
		expect(result.current.copied).toBe(true);
	});

	it("never shows copied when the clipboard refuses", async () => {
		stubClipboard(async () => {
			throw new DOMException("denied", "NotAllowedError");
		});
		const { result } = renderHook(() => useCopyFeedback());
		let ok: boolean | undefined;
		await act(async () => {
			ok = await result.current.copy("ABC123");
		});
		expect(ok).toBe(false);
		expect(result.current.copied).toBe(false);
	});

	it("never shows copied without a clipboard", async () => {
		stubClipboard(null);
		const { result } = renderHook(() => useCopyFeedback());
		let ok: boolean | undefined;
		await act(async () => {
			ok = await result.current.copy("ABC123");
		});
		expect(ok).toBe(false);
		expect(result.current.copied).toBe(false);
	});
});
