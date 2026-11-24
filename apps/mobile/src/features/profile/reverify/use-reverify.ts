/**
 * Confirms it's still the account's owner without leaving the screen: Clerk's
 * session verification, shown by `ReverifySheet`. Clerk's own verify dialog
 * is web-only.
 *
 * `verify` opens the sheet and resolves once it closes. The password comes
 * first when the account has one, with an emailed code as the way out of a
 * forgotten one; otherwise the code. An account that offers neither, or wants
 * a second factor, is `unsupported` and never sees the sheet.
 *
 * Every Clerk call goes through `account`'s live session, so a switch to
 * another account rejects with `accountChanged` rather than verifying it.
 */
import {
	assertSameAccount,
	type DeletingAccount,
	type LiveClerk,
	RECENT_SIGN_IN,
} from "@arcadeclub/core/account-deletion";
import { type AuthErrorKey, clerkErrorKey } from "@arcadeclub/core/auth-errors";
import { gameErrorData } from "@arcadeclub/core/errors";
import type { useClerk } from "@clerk/expo";
import { useCallback, useEffect, useRef, useState } from "react";
import { haptics } from "../../../feedback/haptics";
import { reportError } from "../../../observability/report";

type Session = NonNullable<ReturnType<typeof useClerk>["session"]>;
type VerifyingClerk = LiveClerk & {
	readonly session?:
		| (NonNullable<LiveClerk["session"]> &
				Pick<
					Session,
					| "startVerification"
					| "prepareFirstFactorVerification"
					| "attemptFirstFactorVerification"
				>)
		| null;
};

export type ReverifyOutcome = "verified" | "cancelled" | "unsupported";
export type ReverifyMethod = "password" | "code";

type EmailFactor = { emailAddressId: string; email: string };
type Attempt = {
	method: ReverifyMethod;
	/** The address a code goes to; `null` when Clerk offers no code. */
	email: EmailFactor | null;
};

export function useReverify(clerk: VerifyingClerk) {
	const [attempt, setAttempt] = useState<Attempt | null>(null);
	const [busy, setBusy] = useState(false);
	const [sending, setSending] = useState(false);
	const [errorKey, setErrorKey] = useState<AuthErrorKey | null>(null);
	const [codeSent, setCodeSent] = useState(false);
	/** The open `verify` call; a result for any other one is stale. */
	const open = useRef<{
		account: DeletingAccount;
		resolve: (outcome: ReverifyOutcome) => void;
		reject: (error: unknown) => void;
	} | null>(null);

	const liveSession = (account: DeletingAccount) => {
		assertSameAccount(clerk, account);
		return clerk.session as NonNullable<VerifyingClerk["session"]>;
	};

	const close = useCallback(() => {
		open.current = null;
		setAttempt(null);
		setBusy(false);
		setSending(false);
		setErrorKey(null);
		setCodeSent(false);
	}, []);

	const settle = useCallback(
		(outcome: ReverifyOutcome) => {
			const call = open.current;
			if (!call) return;
			close();
			call.resolve(outcome);
		},
		[close],
	);

	/** Shows Clerk's refusal in the sheet; a switched account ends it. */
	const fail = (call: NonNullable<typeof open.current>, caught: unknown) => {
		if (open.current !== call) return;
		haptics.actionFailed();
		if (gameErrorData(caught)?.code === "accountChanged") {
			close();
			call.reject(caught);
			return;
		}
		const key = clerkErrorKey(caught) ?? "generic";
		if (key === "generic") reportError(caught);
		setErrorKey(key);
	};

	// The screen under the sheet is gone (signed out elsewhere): nothing more
	// may happen on its behalf.
	const mounted = useRef(true);
	useEffect(() => {
		mounted.current = true;
		return () => {
			mounted.current = false;
			open.current?.resolve("cancelled");
			open.current = null;
		};
	}, []);

	async function sendCode(email: EmailFactor, resend = false) {
		const call = open.current;
		if (!call) return;
		setSending(true);
		setErrorKey(null);
		setCodeSent(false);
		try {
			await liveSession(call.account).prepareFirstFactorVerification({
				strategy: "email_code",
				emailAddressId: email.emailAddressId,
			});
			if (open.current === call && resend) setCodeSent(true);
		} catch (caught) {
			fail(call, caught);
		} finally {
			if (open.current === call) setSending(false);
		}
	}

	async function verify(account: DeletingAccount): Promise<ReverifyOutcome> {
		const started = await liveSession(account).startVerification({
			level: RECENT_SIGN_IN.level,
		});
		// Signed in to another account while Clerk answered.
		assertSameAccount(clerk, account);
		if (!mounted.current) return "cancelled";
		if (started.status === "complete") return "verified";
		if (started.status !== "needs_first_factor") return "unsupported";
		const factors = started.supportedFirstFactors ?? [];
		const hasPassword = factors.some(({ strategy }) => strategy === "password");
		const emails = factors.filter((factor) => factor.strategy === "email_code");
		const mail = emails.find(({ primary }) => primary) ?? emails[0];
		const email = mail
			? { emailAddressId: mail.emailAddressId, email: mail.safeIdentifier }
			: null;
		if (!hasPassword && !email) return "unsupported";
		const result = new Promise<ReverifyOutcome>((resolve, reject) => {
			open.current = { account, resolve, reject };
		});
		setAttempt({ method: hasPassword ? "password" : "code", email });
		if (!hasPassword && email) void sendCode(email);
		return result;
	}

	async function submit(value: string) {
		const call = open.current;
		if (!call || !attempt || busy) return;
		setBusy(true);
		setErrorKey(null);
		setCodeSent(false);
		try {
			const { status } = await liveSession(
				call.account,
			).attemptFirstFactorVerification(
				attempt.method === "password"
					? { strategy: "password", password: value }
					: { strategy: "email_code", code: value },
			);
			// Cancelled while Clerk checked: too late to count.
			if (open.current !== call) return;
			settle(status === "complete" ? "verified" : "unsupported");
		} catch (caught) {
			fail(call, caught);
		} finally {
			if (open.current === call) setBusy(false);
		}
	}

	return {
		verify,
		/** What the sheet asks for; `null` while it is closed. */
		method: attempt?.method ?? null,
		/** Masked by Clerk, such as `j***@example.com`. */
		email: attempt?.email?.email ?? null,
		busy,
		sending,
		errorKey,
		/** A new code was asked for and is on its way. */
		codeSent,
		submit,
		/** Emails a (new) code, switching to it from the password. */
		sendCode: async () => {
			if (!attempt?.email || busy || sending) return;
			setAttempt({ ...attempt, method: "code" });
			await sendCode(attempt.email, attempt.method === "code");
		},
		cancel: () => settle("cancelled"),
	};
}
