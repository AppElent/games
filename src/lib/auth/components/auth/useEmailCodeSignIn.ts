/**
 * Passwordless sign-in for accounts made on the phone with an emailed code:
 * email a 6-digit code, then trade it for a session. Mirrors apps/mobile's
 * `use-email-code-sign-in.ts`; on the web both steps live on one screen, so
 * one instance of this hook carries the whole attempt.
 *
 * Failures come back as mapped errors, never Clerk's text.
 */
import { type AuthError, pickClerkError } from "@arcadeclub/core/auth-errors";
import { needsSecondFactor } from "@arcadeclub/core/second-factor";
import { useSignIn } from "@clerk/react";
import { useRef, useState } from "react";
import { useSignInAttempt } from "./useSignInAttempt";

/** Digits in the code Clerk emails. */
export const EMAIL_CODE_LENGTH = 6;

type Step = () => Promise<{ error: unknown } | "unsupported">;
type Busy = "send" | "resend" | "verify" | null;
/** A code for an attempt that is gone; resending starts a new one. */
const EXPIRED = { error: { code: "verification_expired" } };
type Failure = { error: unknown } | "unsupported" | null;

export function useEmailCodeSignIn() {
	const { signIn, errors } = useSignIn();
	const begin = useSignInAttempt();
	const [busy, setBusy] = useState<Busy>(null);
	const [failure, setFailure] = useState<Failure>(null);

	/** The attempt the code was emailed for; an earlier answer can replace it. */
	const emailed = useRef<string | undefined>(undefined);
	const isEmailed = () => signIn.id === emailed.current;
	async function sendTo(email: string) {
		const result = await signIn.emailCode.sendCode({
			emailAddress: email.trim(),
		});
		emailed.current = signIn.id;
		return result;
	}

	/**
	 * Runs the steps in turn; true when every one succeeded. A successful
	 * `verify` stays busy: the session is active and the page is leaving.
	 */
	async function run(kind: Exclude<Busy, null>, ...steps: Step[]) {
		if (busy) return false;
		const attempt = begin();
		setFailure(null);
		setBusy(kind);
		let done = false;
		try {
			for (const step of steps) {
				const result = await step();
				// Answered too late: a newer sign-in has taken over.
				if (!attempt.isLatest()) return false;
				if (result === "unsupported" || result.error) {
					setFailure(result);
					return false;
				}
			}
			done = true;
			return attempt.isShown();
		} catch (err) {
			if (!attempt.isLatest()) return false;
			setFailure({ error: err ?? new Error("email code sign-in failed") });
			return false;
		} finally {
			if (!done || kind !== "verify") setBusy(null);
		}
	}

	// Read at render time: Clerk refreshes the `errors` signal per call.
	const error: AuthError | null =
		failure === "unsupported"
			? { key: "unsupportedStep" }
			: failure
				? pickClerkError(failure === EXPIRED ? null : errors, failure.error)
				: null;

	return {
		/** Emails a code to `email`, starting a new attempt. */
		send: (email: string) => run("send", () => sendTo(email)),
		/** Emails a fresh code for the attempt already started, or a new one. */
		resend: (email: string) =>
			run("resend", () =>
				isEmailed() ? signIn.emailCode.sendCode() : sendTo(email),
			),
		/**
		 * Trades the code for a session. "secondFactor" when the account wants a
		 * second step first; `false` when the code failed.
		 */
		verify: async (
			code: string,
		): Promise<"signedIn" | "secondFactor" | false> => {
			let secondFactor = false;
			const done = await run(
				"verify",
				async () =>
					isEmailed() ? signIn.emailCode.verifyCode({ code }) : EXPIRED,
				async () => {
					if (needsSecondFactor(signIn.status)) {
						secondFactor = true;
						return { error: null };
					}
					return signIn.status === "complete"
						? signIn.finalize()
						: "unsupported";
				},
			);
			if (!done) return false;
			if (!secondFactor) return "signedIn";
			setBusy(null);
			return "secondFactor";
		},
		/**
		 * Drops the attempt so another email can start one; no request. A
		 * failed reset is harmless: the next `send` starts a new attempt.
		 */
		startOver: async () => {
			setFailure(null);
			try {
				await signIn.reset();
			} catch {}
		},
		clearError: () => setFailure(null),
		busy,
		error,
	};
}
