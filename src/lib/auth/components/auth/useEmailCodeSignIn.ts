/**
 * Passwordless sign-in for accounts made on the phone with an emailed code:
 * email a 6-digit code, then trade it for a session. Mirrors apps/mobile's
 * `use-email-code-sign-in.ts`; on the web both steps live on one screen, so
 * one instance of this hook carries the whole attempt.
 *
 * Failures come back as `messages.auth.errors` keys, never Clerk's text.
 */
import {
	type AuthErrorKey,
	pickClerkErrorKey,
} from "@arcadeclub/core/auth-errors";
import { useSignIn } from "@clerk/react";
import { useState } from "react";

/** Digits in the code Clerk emails. */
export const EMAIL_CODE_LENGTH = 6;

type Step = () => Promise<{ error: unknown }>;
type Busy = "send" | "resend" | "verify" | null;

export function useEmailCodeSignIn() {
	const { signIn, errors } = useSignIn();
	const [busy, setBusy] = useState<Busy>(null);
	const [returned, setReturned] = useState<unknown>(null);

	/** Runs the steps in turn; true when every one succeeded. */
	async function run(kind: Exclude<Busy, null>, ...steps: Step[]) {
		if (busy) return false;
		setReturned(null);
		setBusy(kind);
		try {
			for (const step of steps) {
				const { error } = await step();
				if (error) {
					setReturned(error);
					return false;
				}
			}
			return true;
		} catch (err) {
			setReturned(err ?? new Error("email code sign-in failed"));
			return false;
		} finally {
			setBusy(null);
		}
	}

	return {
		/** Emails a code to `email`, starting a new attempt. */
		send: (email: string) =>
			run("send", () =>
				signIn.emailCode.sendCode({ emailAddress: email.trim() }),
			),
		/** Emails a fresh code for the attempt already started. */
		resend: () => run("resend", () => signIn.emailCode.sendCode()),
		/** Trades the code for a session; true once it is active. */
		verify: (code: string) =>
			run(
				"verify",
				() => signIn.emailCode.verifyCode({ code }),
				() => signIn.finalize(),
			),
		/** Drops the attempt so another email can start one; no request. */
		startOver: async () => {
			setReturned(null);
			await signIn.reset();
		},
		clearError: () => setReturned(null),
		busy,
		errorKey: (returned
			? pickClerkErrorKey(errors, returned)
			: null) as AuthErrorKey | null,
	};
}
