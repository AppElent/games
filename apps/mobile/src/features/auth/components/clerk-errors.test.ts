import { messages } from "@arcadeclub/core/messages";
import { clerkErrorKey } from "./clerk-errors";

it("tells too many wrong codes apart from one wrong code", () => {
	// Clerk: three wrong codes give `form_code_incorrect`, the fourth
	// `verification_failed` ("Too many failed attempts") (APP-507).
	expect(clerkErrorKey({ code: "form_code_incorrect" })).toBe("codeIncorrect");
	const key = clerkErrorKey({ errors: [{ code: "verification_failed" }] });
	expect(key).toBe("codeAttemptsExceeded");
	expect(messages.en.auth.errors.codeAttemptsExceeded).toBe(
		"Too many wrong codes. Send a new one.",
	);
	expect(messages.nl.auth.errors.codeAttemptsExceeded).toBe(
		"Te veel foute codes. Vraag een nieuwe aan.",
	);
});
