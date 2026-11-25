/**
 * Confirms it's still the account's owner without leaving the screen: Clerk's
 * session verification, shown by `ReverifySheet`. Clerk's own verify dialog
 * is web-only.
 *
 * `verify` opens the sheet and resolves once it closes. The password comes
 * first when the account has one, with an emailed code as the way out of a
 * forgotten one; otherwise the code. An account that offers neither is
 * `unsupported` and never sees the sheet. An account with two-step
 * verification confirms with its second factor, the same step as the sign-in;
 * one whose second factor the app can't do is `noSecondFactor`, before
 * anything is typed where Clerk tells, and signing in again can't help it.
 *
 * A session that ended, or that Clerk won't verify, closes the sheet:
 * `verify` rejects with `accountSessionEnded` or `accountSignInFirst`.
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
import {
	type AuthError,
	clerkError,
	clerkErrorCode,
} from "@arcadeclub/core/auth-errors";
import { GameRuleError, gameErrorData } from "@arcadeclub/core/errors";
import {
	type SecondFactorActions,
	secondFactorOptions,
} from "@arcadeclub/core/second-factor";
import type { useClerk } from "@clerk/expo";
import { useCallback, useEffect, useRef, useState } from "react";
import { haptics } from "../../../feedback/haptics";
import { reportError } from "../../../observability/report";

type Session = NonNullable<ReturnType<typeof useClerk>["session"]>;
type Verification = Awaited<ReturnType<Session["startVerification"]>>;
type SecondFactor = NonNullable<Verification["supportedSecondFactors"]>[number];
type VerifyingClerk = LiveClerk & {
	readonly user?: {
		id: string;
		twoFactorEnabled?: boolean;
		totpEnabled?: boolean;
		backupCodeEnabled?: boolean;
		phoneNumbers?: readonly { reservedForSecondFactor: boolean }[];
	} | null;
	readonly session?:
		| (NonNullable<LiveClerk["session"]> &
				Pick<
					Session,
					| "startVerification"
					| "prepareFirstFactorVerification"
					| "attemptFirstFactorVerification"
					| "prepareSecondFactorVerification"
					| "attemptSecondFactorVerification"
				>)
		| null;
};

export type ReverifyOutcome =
	| "verified"
	| "cancelled"
	| "unsupported"
	| "noSecondFactor";
export type ReverifyMethod = "password" | "code" | "secondFactor";

type EmailFactor = { emailAddressId: string; email: string };
type Attempt = {
	method: ReverifyMethod;
	/** Whether Clerk also offered a password for this verification. */
	hasPassword: boolean;
	/** The address a code goes to; `null` when Clerk offers no code. */
	email: EmailFactor | null;
	/** What the second step needs once `method` is `secondFactor`. */
	secondFactor?: {
		factors: readonly SecondFactor[];
		actions: SecondFactorActions;
	};
};

/** The second factors a session verification and the app can both do. */
function usableSecondFactors(factors: Verification["supportedSecondFactors"]) {
	// Clerk emails no second code here, unlike at sign-in.
	return secondFactorOptions(
		factors?.filter(({ strategy }) => (strategy as string) !== "email_code"),
	).flatMap(
		({ strategy }) => factors?.find((f) => f.strategy === strategy) ?? [],
	);
}

/**
 * A second factor will be asked for and the app can do none of them. Before
 * the first factor Clerk may not list them yet; the user says what it has.
 */
function lacksSecondFactor(
	user: VerifyingClerk["user"],
	factors: Verification["supportedSecondFactors"],
) {
	if (!user?.twoFactorEnabled) return false;
	if (factors?.length) return usableSecondFactors(factors).length === 0;
	return !(
		user.totpEnabled ||
		user.backupCodeEnabled ||
		user.phoneNumbers?.some((phone) => phone.reservedForSecondFactor)
	);
}

const SESSION_ENDED = new Set(["session_not_found", "authentication_invalid"]);

/** The error `verify` rejects with when the sheet can't go on; else `null`. */
function sheetEnd(caught: unknown): unknown {
	if (gameErrorData(caught)?.code === "accountChanged") return caught;
	if (clerkError(caught)?.key !== "signInAgain") return null;
	// Never a wrong entry: keep telling Sentry about it.
	reportError(caught);
	return new GameRuleError(
		SESSION_ENDED.has(clerkErrorCode(caught) ?? "")
			? "accountSessionEnded"
			: "accountSignInFirst",
	);
}

type OpenCall = {
	account: DeletingAccount;
	resolve: (outcome: ReverifyOutcome) => void;
	reject: (error: unknown) => void;
};

export function useReverify(clerk: VerifyingClerk) {
	const [attempt, setAttempt] = useState<Attempt | null>(null);
	const [busy, setBusy] = useState(false);
	const [sending, setSending] = useState(false);
	const [error, setError] = useState<AuthError | null>(null);
	const [codeSent, setCodeSent] = useState(false);
	/** The open `verify` call; a result for any other one is stale. */
	const open = useRef<OpenCall | null>(null);

	const liveSession = (account: DeletingAccount) => {
		assertSameAccount(clerk, account);
		return clerk.session as NonNullable<VerifyingClerk["session"]>;
	};

	const close = useCallback(() => {
		open.current = null;
		setAttempt(null);
		setBusy(false);
		setSending(false);
		setError(null);
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

	/**
	 * Closes the sheet on a failure it can't go on from. Otherwise returns
	 * Clerk's refusal to show; `null` when there is nothing left to show.
	 */
	const refused = (call: OpenCall, caught: unknown): AuthError | null => {
		if (open.current !== call) return null;
		haptics.actionFailed();
		const end = sheetEnd(caught);
		if (end) {
			close();
			call.reject(end);
			return null;
		}
		const mapped = clerkError(caught) ?? { key: "generic" as const };
		if (mapped.key === "generic") reportError(caught);
		return mapped;
	};

	const fail = (call: OpenCall, caught: unknown) => {
		const mapped = refused(call, caught);
		if (mapped) setError(mapped);
	};

	/** The second step's Clerk calls, for `call` only. */
	const secondFactorActions = (
		call: OpenCall,
		factors: readonly SecondFactor[],
	): SecondFactorActions => {
		const guard = async (action: () => Promise<void>) => {
			try {
				await action();
				return { error: null };
			} catch (caught) {
				refused(call, caught);
				return { error: caught };
			}
		};
		return {
			send: () =>
				guard(async () => {
					const phone = factors.find((f) => f.strategy === "phone_code");
					if (!phone) throw new Error("no phone to text a code to");
					await liveSession(call.account).prepareSecondFactorVerification({
						strategy: "phone_code",
						phoneNumberId: phone.phoneNumberId,
					});
					assertSameAccount(clerk, call.account);
				}),
			verify: (strategy, code) =>
				guard(async () => {
					if (strategy === "email_code") throw new Error("not offered");
					const { status } = await liveSession(
						call.account,
					).attemptSecondFactorVerification({ strategy, code });
					// Cancelled while Clerk checked: too late to count.
					if (open.current !== call) return;
					assertSameAccount(clerk, call.account);
					settle(status === "complete" ? "verified" : "unsupported");
				}),
		};
	};

	/** The second step for `call`; `null` when the app can do none of them. */
	const secondFactorAttempt = (
		call: OpenCall,
		offered: Verification["supportedSecondFactors"],
	): Attempt | null => {
		const factors = usableSecondFactors(offered);
		if (factors.length === 0) return null;
		return {
			method: "secondFactor",
			hasPassword: false,
			email: null,
			secondFactor: { factors, actions: secondFactorActions(call, factors) },
		};
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
		setError(null);
		setCodeSent(false);
		try {
			await liveSession(call.account).prepareFirstFactorVerification({
				strategy: "email_code",
				emailAddressId: email.emailAddressId,
			});
			if (open.current !== call) return;
			assertSameAccount(clerk, call.account);
			if (resend) setCodeSent(true);
		} catch (caught) {
			fail(call, caught);
		} finally {
			if (open.current === call) setSending(false);
		}
	}

	async function verify(account: DeletingAccount): Promise<ReverifyOutcome> {
		const started = await liveSession(account)
			.startVerification({ level: RECENT_SIGN_IN.level })
			.catch((caught: unknown) => {
				throw sheetEnd(caught) ?? caught;
			});
		// Signed in to another account while Clerk answered.
		assertSameAccount(clerk, account);
		if (!mounted.current) return "cancelled";
		if (started.status === "complete") return "verified";
		let call!: OpenCall;
		const promise = new Promise<ReverifyOutcome>((resolve, reject) => {
			call = { account, resolve, reject };
		});
		if (started.status === "needs_second_factor") {
			const second = secondFactorAttempt(call, started.supportedSecondFactors);
			if (!second) return "noSecondFactor";
			open.current = call;
			setAttempt(second);
			return promise;
		}
		if (started.status !== "needs_first_factor") return "unsupported";
		if (lacksSecondFactor(clerk.user, started.supportedSecondFactors)) {
			return "noSecondFactor";
		}
		const factors = started.supportedFirstFactors ?? [];
		const hasPassword = factors.some(({ strategy }) => strategy === "password");
		const emails = factors.filter((factor) => factor.strategy === "email_code");
		const mail = emails.find(({ primary }) => primary) ?? emails[0];
		const email = mail
			? { emailAddressId: mail.emailAddressId, email: mail.safeIdentifier }
			: null;
		if (!hasPassword && !email) return "unsupported";
		open.current = call;
		setAttempt({
			method: hasPassword ? "password" : "code",
			hasPassword,
			email,
		});
		if (!hasPassword && email) void sendCode(email);
		return promise;
	}

	async function submit(value: string) {
		const call = open.current;
		if (!call || !attempt || busy || attempt.method === "secondFactor") return;
		setBusy(true);
		setError(null);
		setCodeSent(false);
		try {
			const { status, supportedSecondFactors } = await liveSession(
				call.account,
			).attemptFirstFactorVerification(
				attempt.method === "password"
					? { strategy: "password", password: value }
					: { strategy: "email_code", code: value },
			);
			// Cancelled while Clerk checked: too late to count.
			if (open.current !== call) return;
			// Another account signed in while Clerk answered.
			assertSameAccount(clerk, call.account);
			if (status !== "needs_second_factor") {
				settle(status === "complete" ? "verified" : "unsupported");
				return;
			}
			const second = secondFactorAttempt(call, supportedSecondFactors);
			if (second) setAttempt(second);
			else settle("noSecondFactor");
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
		/** Whether this account can verify with its password. */
		hasPassword: attempt?.hasPassword ?? false,
		/** The address a code goes to, as Clerk shows it. */
		email: attempt?.email?.email ?? null,
		/** The second step's factors and Clerk calls, when that is asked for. */
		secondFactor: attempt?.secondFactor ?? null,
		busy,
		sending,
		error,
		errorKey: error?.key ?? null,
		/** A new code was asked for and is on its way. */
		codeSent,
		submit,
		/** Emails a (new) code, switching to it from the password. */
		sendCode: async () => {
			if (!attempt?.email || busy || sending) return;
			setAttempt({ ...attempt, method: "code" });
			await sendCode(attempt.email, attempt.method === "code");
		},
		/** Returns to the password step without cancelling the sheet. */
		usePassword: () => {
			if (
				!attempt?.hasPassword ||
				attempt.method === "password" ||
				busy ||
				sending
			) {
				return;
			}
			setError(null);
			setCodeSent(false);
			setAttempt({ ...attempt, method: "password" });
		},
		cancel: () => settle("cancelled"),
	};
}
