import { authErrorMessage } from "@arcadeclub/core/auth-errors";
import { messages } from "@arcadeclub/core/messages";
import { ClerkAPIResponseError } from "@clerk/react/errors";
import { act, renderHook } from "@testing-library/react-native";
import { useAuthFlow } from "./use-auth-flow";

// The SDK drops `meta.lockout_expires_in_seconds`: the wait is in the text.
const locked = new ClerkAPIResponseError("Locked", {
	status: 422,
	data: [
		{
			code: "user_locked",
			message: "Account locked",
			long_message:
				"Your account is locked. You will be able to try again in 30 minutes.",
		},
	],
});

describe("useAuthFlow", () => {
	it("keeps the lockout wait Clerk reports, for the screen to show", async () => {
		const hook = await renderHook(() => useAuthFlow(null));
		await act(async () => {
			await hook.result.current.send(async () => ({ error: locked }));
		});
		expect(hook.result.current.error).toEqual({
			key: "accountLocked",
			lockoutSeconds: 1800,
		});
		expect(
			authErrorMessage(messages.en, "en", hook.result.current.error),
		).toContain("30 minutes");
		expect(
			authErrorMessage(messages.nl, "nl", hook.result.current.error),
		).toContain("30 minuten");
	});

	it("prefers the hook's field error, and clears on the next call", async () => {
		const errors = {
			fields: { code: { code: "form_code_incorrect" } },
			global: null,
		};
		const hook = await renderHook(() => useAuthFlow(errors));
		await act(async () => {
			await hook.result.current.send(async () => ({ error: locked }));
		});
		expect(hook.result.current.error).toEqual({ key: "codeIncorrect" });
		await act(async () => {
			await hook.result.current.send(async () => ({ error: null }));
		});
		expect(hook.result.current.error).toBeNull();
	});
});
