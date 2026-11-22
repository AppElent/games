import { describe, expect, it } from "vitest";
import { clerkErrorKey, pickClerkErrorKey } from "../auth-errors";
import { messages } from "../messages";

describe("clerkErrorKey", () => {
	it("maps the email-code sign-in failures to catalog keys", () => {
		expect(clerkErrorKey({ code: "form_identifier_not_found" })).toBe(
			"identifierNotFound",
		);
		expect(clerkErrorKey({ errors: [{ code: "form_code_incorrect" }] })).toBe(
			"codeIncorrect",
		);
		expect(clerkErrorKey({ errors: [{ code: "verification_expired" }] })).toBe(
			"codeExpired",
		);
		expect(clerkErrorKey({ errors: [{ code: "verification_failed" }] })).toBe(
			"codeAttemptsExceeded",
		);
		// What Clerk returns for a password on a code-only account.
		expect(
			clerkErrorKey({ errors: [{ code: "strategy_for_user_invalid" }] }),
		).toBe("noPassword");
		expect(clerkErrorKey({ errors: [{ code: "too_many_requests" }] })).toBe(
			"tooManyRequests",
		);
	});

	it("falls back to generic for an unknown code or a bare error", () => {
		expect(clerkErrorKey({ code: "something_new" })).toBe("generic");
		expect(clerkErrorKey(new Error("boom"))).toBe("generic");
		expect(clerkErrorKey(null)).toBeNull();
	});

	it("has copy in both languages for every key", () => {
		for (const key of Object.keys(messages.en.auth.errors)) {
			const k = key as keyof typeof messages.en.auth.errors;
			expect(messages.nl.auth.errors[k]).toBeTruthy();
			expect(messages.nl.auth.errors[k]).not.toBe(messages.en.auth.errors[k]);
		}
	});
});

describe("pickClerkErrorKey", () => {
	it("prefers a field error over the returned wrapper", () => {
		expect(
			pickClerkErrorKey(
				{ fields: { code: { code: "form_code_incorrect" } }, global: null },
				{ errors: [{ code: "something_new" }] },
			),
		).toBe("codeIncorrect");
	});

	it("reads the returned wrapper when the signal is empty", () => {
		expect(
			pickClerkErrorKey(
				{ fields: {}, global: null },
				{ errors: [{ code: "rate_limit_exceeded" }] },
			),
		).toBe("tooManyRequests");
		expect(pickClerkErrorKey(null, null)).toBeNull();
	});
});
