import type { ConvexReactClient } from "convex/react";
import { makeFunctionReference } from "convex/server";
import { ConvexError } from "convex/values";
import { beforeEach, expect, it, vi } from "vitest";

const captureException = vi.hoisted(() => vi.fn());
vi.mock("@sentry/react", () => ({ captureException }));

import { instrumentConvexClient } from "./convex";

beforeEach(() => captureException.mockClear());

/** A client whose every write fails with `error`. */
function failingClient(error: unknown) {
	const fail = async () => {
		throw error;
	};
	return instrumentConvexClient({
		mutation: fail,
		action: fail,
	} as unknown as ConvexReactClient);
}

it("reports an unexpected failure once, tagged with the function", async () => {
	const error = new Error("boom");
	const client = failingClient(error);
	const create = makeFunctionReference<"mutation">("sessions:create");
	await expect(client.mutation(create, {})).rejects.toBe(error);
	await expect(client.mutation(create, {})).rejects.toBe(error);
	expect(captureException).toHaveBeenCalledTimes(1);
	expect(captureException).toHaveBeenCalledWith(error, {
		tags: { operation: "sessions:create", handled: true },
	});
});

it("leaves keyed ConvexErrors to the UI", async () => {
	const error = new ConvexError({ code: "roomNotFound" });
	const client = failingClient(error);
	await expect(
		client.mutation(
			makeFunctionReference<"mutation">("sessions:joinByCode"),
			{},
		),
	).rejects.toBe(error);
	expect(captureException).not.toHaveBeenCalled();
});
