import { expect, it } from "vitest";
import { executionErrorEvent, sanitizeText } from "./convex-sentry.mjs";

const options = { deployment: "chatty-ram-217", app: "arcadeclub-convex" };
const failure = {
	kind: "Completion",
	error: "Error: Scheduled job failed\n    at handler (convex/jobs.ts:12:3)",
	identifier: "jobs:run",
	udfType: "Mutation",
	timestamp: 12345,
	requestId: "request-1",
	executionId: "execution-1",
	logLines: ["private player payload"],
	args: { password: "secret" },
};

it("forwards execution failures with the server stack and structural tags only", () => {
	const result = executionErrorEvent(failure, options);
	expect(result.error.stack).toBe(failure.error);
	expect(result.tags).toEqual({
		app: "arcadeclub-convex",
		func: "jobs:run",
		func_type: "Mutation",
		request_id: "request-1",
	});
	expect(JSON.stringify(result)).not.toContain("private player payload");
	expect(JSON.stringify(result)).not.toContain("secret");
});

it("ignores console output, successful calls, retried conflicts, and malformed records", () => {
	for (const entry of [
		null,
		{},
		{ ...failure, kind: "Progress" },
		{ ...failure, error: null },
		{ ...failure, error: "" },
		{ ...failure, willRetry: true },
	]) {
		expect(executionErrorEvent(entry, options)).toBeNull();
	}
});

it("uses a stable event ID for replayed history and distinct IDs for new executions", () => {
	expect(executionErrorEvent(failure, options).eventId).toBe(
		executionErrorEvent({ ...failure }, options).eventId,
	);
	expect(
		executionErrorEvent({ ...failure, executionId: "execution-2" }, options).eventId,
	).not.toBe(executionErrorEvent(failure, options).eventId);
});

it("filters credentials, email addresses, and logged values from error text", () => {
	const text = sanitizeText(
		"Error: Bearer abc.def for player@example.com at /cb?token=xyz\n  Object: {secret}",
	);
	expect(text).not.toMatch(/abc\.def|player@example\.com|xyz|\{secret\}/);
});
