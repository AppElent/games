import { describe, expect, it } from "vitest";
import {
	authErrorMessage,
	clerkError,
	clerkErrorKey,
	MAX_LOCKOUT_SECONDS,
	pickClerkError,
	pickClerkErrorKey,
} from "../auth-errors";
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

	it.each([
		["form_password_not_strong_enough", "passwordDoesNotMeetRequirements"],
		["form_password_no_uppercase", "passwordDoesNotMeetRequirements"],
		["form_password_no_lowercase", "passwordDoesNotMeetRequirements"],
		["form_password_no_number", "passwordDoesNotMeetRequirements"],
		["form_password_no_special_char", "passwordDoesNotMeetRequirements"],
		["form_conditional_param_missing", "required"],
	])("maps %s to %s (APP-596)", (code, key) => {
		expect(clerkErrorKey({ errors: [{ code }] })).toBe(key);
	});

	it("reads the code inside a ClerkAPIResponseError, not its wrapper code", () => {
		const apiError = Object.assign(new Error("Clerk: Bad request"), {
			code: "api_response_error",
			errors: [{ code: "strategy_for_user_invalid", longMessage: "No." }],
		});
		expect(clerkErrorKey(apiError)).toBe("noPassword");
		expect(clerkErrorKey({ code: "api_response_error", errors: [] })).toBe(
			"generic",
		);
	});

	it.each([
		["user_locked", "accountLocked"],
		["too_many_attempts", "tooManyRequests"],
		["too_many_verifications", "tooManyRequests"],
		["verification_code_too_many_attempts", "codeAttemptsExceeded"],
		["verification_max_attempts_reached", "codeAttemptsExceeded"],
		["form_verification_max_attempts_reached", "codeAttemptsExceeded"],
		["verification_not_sent", "codeExpired"],
		["verification_missing", "codeExpired"],
		["clerk_offline", "network"],
		["session_not_found", "signInAgain"],
		["authentication_invalid", "signInAgain"],
		["authorization_invalid", "signInAgain"],
	])("maps %s to %s (APP-777)", (code, key) => {
		expect(clerkErrorKey({ errors: [{ code }] })).toBe(key);
	});

	it("maps HTTP 429 responses without a mapped code to tooManyRequests", () => {
		expect(
			clerkErrorKey({
				code: "api_response_error",
				status: 429,
				errors: [],
			}),
		).toBe("tooManyRequests");
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

describe("pickClerkError", () => {
	it("keeps the lockout wait of the error it picks", () => {
		const locked = {
			errors: [
				{ code: "user_locked", meta: { lockout_expires_in_seconds: 90 } },
			],
		};
		expect(pickClerkError({ fields: {}, global: null }, locked)).toEqual({
			key: "accountLocked",
			lockoutSeconds: 90,
		});
		expect(pickClerkError({ fields: {}, global: [locked] }, null)).toEqual({
			key: "accountLocked",
			lockoutSeconds: 90,
		});
		expect(pickClerkError(null, null)).toBeNull();
	});
});

describe("clerkError and authErrorMessage", () => {
	it("extracts lockoutSeconds from meta, retryAfter, or longMessage fallback", () => {
		expect(
			clerkError({
				errors: [
					{ code: "user_locked", meta: { lockout_expires_in_seconds: 1800 } },
				],
			}),
		).toEqual({ key: "accountLocked", lockoutSeconds: 1800 });
		expect(
			clerkError({
				errors: [
					{ code: "user_locked", meta: { lockoutExpiresInSeconds: 600 } },
				],
			}),
		).toEqual({ key: "accountLocked", lockoutSeconds: 600 });
		expect(
			clerkError({
				retryAfter: 90,
				errors: [{ code: "user_locked" }],
			}),
		).toEqual({ key: "accountLocked", lockoutSeconds: 90 });
		expect(
			clerkError({
				errors: [
					{
						code: "user_locked",
						longMessage:
							"Your account is locked. You will be able to try again in 30 minutes.",
					},
				],
			}),
		).toEqual({ key: "accountLocked", lockoutSeconds: 1800 });
		expect(
			clerkError({
				errors: [
					{
						code: "user_locked",
						longMessage:
							"Your account is locked. For more information, contact support.",
					},
				],
			}),
		).toEqual({ key: "accountLocked" });
		expect(
			clerkError({
				errors: [
					{ code: "user_locked", meta: { lockout_expires_in_seconds: 0 } },
				],
			}),
		).toEqual({ key: "accountLocked" });
		expect(
			clerkError({
				errors: [
					{
						code: "user_locked",
						longMessage: "You can try again in 1 hour and 30 minutes.",
					},
				],
			}),
		).toEqual({ key: "accountLocked" });
		// A compound wait is not understated as its first part.
		for (const text of ["in 1 hour, 30 minutes.", "in 1 hour 30 minutes."]) {
			expect(
				clerkError({
					errors: [{ code: "user_locked", longMessage: `Try again ${text}` }],
				}),
			).toEqual({ key: "accountLocked" });
		}
		expect(clerkErrorKey({ code: "toString" })).toBe("generic");
		expect(clerkError(null)).toBeNull();
	});

	it("formats accountLocked with and without a lockout wait in EN and NL", () => {
		expect(authErrorMessage(messages.en, "en", null)).toBeNull();
		expect(authErrorMessage(messages.en, "en", { key: "accountLocked" })).toBe(
			messages.en.auth.errors.accountLocked,
		);
		expect(authErrorMessage(messages.nl, "nl", { key: "accountLocked" })).toBe(
			messages.nl.auth.errors.accountLocked,
		);
		expect(
			authErrorMessage(messages.en, "en", {
				key: "accountLocked",
				lockoutSeconds: 45,
			}),
		).toBe(
			"This account is temporarily locked after too many failed attempts. Try again in 45 seconds.",
		);
		expect(
			authErrorMessage(messages.nl, "nl", {
				key: "accountLocked",
				lockoutSeconds: 1,
			}),
		).toBe(
			"Dit account is tijdelijk vergrendeld na te veel mislukte pogingen. Probeer het over 1 seconde opnieuw.",
		);
		expect(
			authErrorMessage(messages.en, "en", {
				key: "accountLocked",
				lockoutSeconds: 1800,
			}),
		).toBe(
			"This account is temporarily locked after too many failed attempts. Try again in 30 minutes.",
		);
		expect(
			authErrorMessage(messages.nl, "nl", {
				key: "accountLocked",
				lockoutSeconds: 1800,
			}),
		).toBe(
			"Dit account is tijdelijk vergrendeld na te veel mislukte pogingen. Probeer het over 30 minuten opnieuw.",
		);
		expect(
			authErrorMessage(messages.en, "en", {
				key: "accountLocked",
				lockoutSeconds: 3600,
			}),
		).toBe(
			"This account is temporarily locked after too many failed attempts. Try again in 1 hour.",
		);
		expect(
			authErrorMessage(messages.nl, "nl", {
				key: "accountLocked",
				lockoutSeconds: 7200,
			}),
		).toBe(
			"Dit account is tijdelijk vergrendeld na te veel mislukte pogingen. Probeer het over 2 uur opnieuw.",
		);
	});

	it('says "later" instead of a wait beyond a day, in EN and NL', () => {
		const wait = (lockoutSeconds: number) =>
			({ key: "accountLocked", lockoutSeconds }) as const;
		expect(
			authErrorMessage(messages.en, "en", wait(MAX_LOCKOUT_SECONDS)),
		).toContain("24 hours");
		for (const seconds of [MAX_LOCKOUT_SECONDS + 1, 400 * 24 * 3600]) {
			expect(authErrorMessage(messages.en, "en", wait(seconds))).toBe(
				messages.en.auth.errors.accountLocked,
			);
			expect(authErrorMessage(messages.nl, "nl", wait(seconds))).toBe(
				messages.nl.auth.errors.accountLocked,
			);
		}
	});
});
