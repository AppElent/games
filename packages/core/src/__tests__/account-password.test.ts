import { describe, expect, it } from "vitest";
import { passwordFailure, passwordUpdate } from "../account-password";

function clerkError(code: string, paramName?: string) {
	return { errors: [{ code, meta: paramName ? { paramName } : {} }] };
}

describe("passwordUpdate", () => {
	it("signs the account's other sessions out", () => {
		expect(passwordUpdate("old-pass", "new-pass")).toEqual({
			currentPassword: "old-pass",
			newPassword: "new-pass",
			signOutOfOtherSessions: true,
		});
	});
});

describe("passwordFailure", () => {
	it("puts a validation failure on the current password on that field", () => {
		for (const code of [
			"form_password_validation_failed",
			"form_password_incorrect",
		]) {
			expect(passwordFailure(clerkError(code, "current_password"))).toEqual({
				field: "current",
				key: "passwordIncorrect",
			});
		}
	});

	it("puts the same code on the new password on the new field as too weak", () => {
		expect(
			passwordFailure(
				clerkError("form_password_validation_failed", "new_password"),
			),
		).toEqual({ field: "new", key: "passwordDoesNotMeetRequirements" });
		expect(
			passwordFailure(
				clerkError("form_password_length_too_short", "new_password"),
			),
		).toEqual({ field: "new", key: "passwordTooShort" });
		expect(
			passwordFailure(clerkError("form_password_pwned", "new_password")),
		).toEqual({ field: "new", key: "passwordPwned" });
	});

	it("prefers the wrong current password when Clerk reports both", () => {
		const both = {
			errors: [
				{
					code: "form_password_validation_failed",
					meta: { paramName: "new_password" },
				},
				{
					code: "form_password_validation_failed",
					meta: { paramName: "current_password" },
				},
			],
		};
		expect(passwordFailure(both)?.field).toBe("current");
	});

	it("leaves other failures to the caller", () => {
		expect(
			passwordFailure(clerkError("session_reverification_required")),
		).toBeNull();
		expect(passwordFailure(new Error("offline"))).toBeNull();
		expect(passwordFailure(null)).toBeNull();
	});
});
