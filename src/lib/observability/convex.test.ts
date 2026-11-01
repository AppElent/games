import { ConvexError } from "convex/values";
import { beforeEach, expect, it, vi } from "vitest";

const captureException = vi.hoisted(() => vi.fn());
vi.mock("@sentry/react", () => ({ captureException }));

import { reportConvexFailure } from "./convex";

beforeEach(() => captureException.mockClear());

it("reports an unexpected failure once, tagged with the function", () => {
	const error = new Error("boom");
	reportConvexFailure(error, "sessions:create");
	reportConvexFailure(error, "sessions:create");
	expect(captureException).toHaveBeenCalledTimes(1);
	expect(captureException).toHaveBeenCalledWith(error, {
		tags: { operation: "sessions:create", handled: true },
	});
});

it("leaves keyed ConvexErrors to the UI", () => {
	reportConvexFailure(
		new ConvexError({ code: "roomNotFound" }),
		"sessions:joinByCode",
	);
	expect(captureException).not.toHaveBeenCalled();
});
