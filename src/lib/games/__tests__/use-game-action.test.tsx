// @vitest-environment jsdom
import { GameRuleError } from "@arcadeclub/core/errors";
import { act, cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { useGameAction } from "#/lib/games/use-game-action";
import { LocaleProvider } from "#/lib/i18n";

function wrapper({ children }: { children: ReactNode }) {
	return <LocaleProvider initialLocale="en">{children}</LocaleProvider>;
}

describe("useGameAction", () => {
	afterEach(cleanup);

	it("resolves true and keeps the error empty when the action succeeds", async () => {
		const { result } = renderHook(() => useGameAction(), { wrapper });
		let ok: boolean | undefined;
		await act(async () => {
			ok = await result.current.run(async () => "done", "Failed");
		});
		expect(ok).toBe(true);
		expect(result.current.error).toBe("");
	});

	it("resolves false and shows the localized error when the action throws a game error", async () => {
		const { result } = renderHook(() => useGameAction(), { wrapper });
		let ok: boolean | undefined;
		await act(async () => {
			ok = await result.current.run(async () => {
				throw new GameRuleError("sessionNotFound");
			}, "Failed");
		});
		expect(ok).toBe(false);
		expect(result.current.error).toBe("This game no longer exists.");
	});

	it("shows the fallback for an error without a code", async () => {
		const { result } = renderHook(() => useGameAction(), { wrapper });
		await act(async () => {
			await result.current.run(async () => {
				throw new Error("network down");
			}, "Failed");
		});
		expect(result.current.error).toBe("Failed");
	});

	it("clears the previous error when the next action starts", async () => {
		const { result } = renderHook(() => useGameAction(), { wrapper });
		await act(async () => {
			await result.current.run(async () => {
				throw new Error("boom");
			}, "Failed");
		});
		await act(async () => {
			await result.current.run(async () => undefined, "Failed");
		});
		expect(result.current.error).toBe("");
	});
});
