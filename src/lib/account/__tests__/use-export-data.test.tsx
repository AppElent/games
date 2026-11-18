// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useExportData } from "#/lib/account/use-export-data";
import { LocaleProvider } from "#/lib/i18n";

const query = vi.fn();
vi.mock("convex/react", () => ({
	useConvex: () => ({ query }),
	useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
}));

function wrapper({ children }: { children: ReactNode }) {
	return <LocaleProvider initialLocale="en">{children}</LocaleProvider>;
}

async function runExport() {
	const hook = renderHook(() => useExportData(), { wrapper });
	let ok: boolean | undefined;
	await act(async () => {
		ok = await hook.result.current.exportData();
	});
	return { ok, result: hook.result };
}

describe("useExportData", () => {
	const saved: { name: string; blob: Blob }[] = [];

	beforeEach(() => {
		vi.useFakeTimers({ now: new Date(2026, 10, 18, 9), toFake: ["Date"] });
		URL.createObjectURL = vi.fn((blob: Blob) => {
			saved.push({ name: "", blob });
			return "blob:export";
		});
		URL.revokeObjectURL = vi.fn();
		vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
			this: HTMLAnchorElement,
		) {
			const last = saved.at(-1);
			if (last) last.name = this.download;
		});
	});
	afterEach(() => {
		cleanup();
		vi.useRealTimers();
		vi.restoreAllMocks();
		query.mockReset();
		saved.length = 0;
	});

	it("saves every page as one dated JSON file", async () => {
		query
			.mockResolvedValueOnce({
				tables: { quizSets: [{ title: "Mine" }] },
				next: { source: 1, page: null },
			})
			.mockResolvedValueOnce({
				tables: { gameSessions: [{ gameType: "chess" }] },
				next: null,
			});
		const { ok, result } = await runExport();
		expect(ok).toBe(true);
		expect(query.mock.calls.map(([, args]) => args)).toEqual([
			{ cursor: null },
			{ cursor: { source: 1, page: null } },
		]);
		expect(saved).toHaveLength(1);
		expect(saved[0].name).toBe("arcade-club-export-2026-11-18.json");
		expect(saved[0].blob.type).toBe("application/json");
		const data = JSON.parse(await saved[0].blob.text());
		expect(data.tables).toEqual({
			quizSets: [{ title: "Mine" }],
			gameSessions: [{ gameType: "chess" }],
		});
		expect(result.current.error).toBe("");
		expect(result.current.busy).toBe(false);
	});

	it("shows the failure and saves nothing when a page fails", async () => {
		query.mockRejectedValueOnce(new Error("[CONVEX Q] network"));
		const { ok, result } = await runExport();
		expect(ok).toBe(false);
		expect(saved).toHaveLength(0);
		expect(result.current.error).toBe(
			"Your data could not be downloaded. Try again.",
		);
	});
});
