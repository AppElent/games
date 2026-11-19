import { nameUpdate, passwordChangeError } from "./account-edits";

describe("nameUpdate", () => {
	const saved = { firstName: "Ada", lastName: "Lovelace" };

	it("is null when nothing changed, ignoring outer spaces", () => {
		expect(
			nameUpdate(saved, { firstName: " Ada ", lastName: "Lovelace" }),
		).toBeNull();
	});

	it("sends the trimmed name when a part changed", () => {
		expect(nameUpdate(saved, { firstName: "Ada ", lastName: " King" })).toEqual(
			{ firstName: "Ada", lastName: "King" },
		);
	});

	it("treats a missing Clerk name as empty", () => {
		const none = { firstName: null, lastName: null };
		expect(nameUpdate(none, { firstName: "", lastName: " " })).toBeNull();
		expect(nameUpdate(none, { firstName: "Bo", lastName: "" })).toEqual({
			firstName: "Bo",
			lastName: "",
		});
	});
});

const clerkError = (code: string, paramName?: string) => ({
	errors: [{ code, message: code, meta: paramName ? { paramName } : {} }],
});

describe("passwordChangeError", () => {
	it("reads a validation failure on the current password as wrong", () => {
		expect(
			passwordChangeError(
				clerkError("form_password_validation_failed", "current_password"),
			),
		).toBe("passwordIncorrect");
		expect(
			passwordChangeError(
				clerkError("form_password_incorrect", "current_password"),
			),
		).toBe("passwordIncorrect");
	});

	it("reads the same code on the new password as too weak", () => {
		expect(
			passwordChangeError(
				clerkError("form_password_validation_failed", "new_password"),
			),
		).toBe("passwordDoesNotMeetRequirements");
		expect(
			passwordChangeError(
				clerkError("form_password_length_too_short", "new_password"),
			),
		).toBe("passwordTooShort");
		expect(
			passwordChangeError(clerkError("form_password_pwned", "new_password")),
		).toBe("passwordPwned");
	});

	it("asks for a fresh sign-in when Clerk wants reverification", () => {
		expect(
			passwordChangeError(clerkError("session_reverification_required")),
		).toBe("signInAgain");
	});

	it("falls back to the generic message", () => {
		expect(passwordChangeError(new Error("offline"))).toBe("generic");
		expect(passwordChangeError(clerkError("something_new"))).toBe("generic");
	});
});
