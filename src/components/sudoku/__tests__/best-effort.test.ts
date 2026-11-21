import { ConvexError } from "convex/values";
import { beforeEach, expect, it, vi } from "vitest";

const reportHostOnlyRejection = vi.hoisted(() => vi.fn());
vi.mock("#/lib/observability/convex", () => ({ reportHostOnlyRejection }));

import { bestEffort } from "../useSoloPuzzleSession";

beforeEach(() => reportHostOnlyRejection.mockClear());

/** Lets the rejection handler run. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

it("reports a hostOnly rejection with the failing write", async () => {
	bestEffort(
		Promise.reject(new ConvexError({ code: "hostOnly" })),
		"sudoku:saveProgress",
	);
	await settle();
	expect(reportHostOnlyRejection).toHaveBeenCalledWith("sudoku:saveProgress");
});

it("drops every other failure silently", async () => {
	bestEffort(Promise.reject(new Error("offline")), "sudoku:saveProgress");
	bestEffort(
		Promise.reject(new ConvexError({ code: "roomNotFound" })),
		"sudoku:complete",
	);
	await settle();
	expect(reportHostOnlyRejection).not.toHaveBeenCalled();
});
