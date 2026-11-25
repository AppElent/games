/**
 * The second step Clerk can ask for after a first one: a sign-in stops at
 * `needs_second_factor` when the account has two-step verification on, and at
 * `needs_client_trust` when Clerk wants a new device verified. Both are
 * completed with the same methods.
 *
 * The web and apps/mobile share this module: which methods an account can use,
 * and one flow that sends, verifies, switches and locks them. The flow knows
 * nothing about sign-in; `SecondFactorActions` does the Clerk calls, so
 * another verification (a recent-sign-in check) can drive the same step.
 */
import {
	type AuthError,
	authErrorMessage,
	clerkError,
	clerkErrorCode,
} from "./auth-errors";
import type { Messages } from "./i18n/en";
import { fmt } from "./i18n/format";

/**
 * The order picks the default: an authenticator app needs nothing sent, a
 * texted or emailed code comes next, and a backup code, which works only
 * once, is the last resort.
 */
export const SECOND_FACTOR_STRATEGIES = [
	"totp",
	"phone_code",
	"email_code",
	"backup_code",
] as const;
export type SecondFactorStrategy = (typeof SECOND_FACTOR_STRATEGIES)[number];

/** Digits in every code except a backup code. */
export const SECOND_FACTOR_CODE_LENGTH = 6;

export type SecondFactorOption = {
	strategy: SecondFactorStrategy;
	/** Masked phone number or address a code goes to, e.g. `+1*******55`. */
	safeIdentifier?: string;
};

export type SecondFactorResult = { error: unknown };

export type SecondFactorActions = {
	/** Sends a code; only called for the methods that send one. */
	send: (strategy: SecondFactorStrategy) => Promise<SecondFactorResult>;
	/** Checks the code and completes whatever the step was for. */
	verify: (
		strategy: SecondFactorStrategy,
		code: string,
	) => Promise<SecondFactorResult>;
};

export type SecondFactorState = {
	/** The methods this account can use here, default first. */
	options: readonly SecondFactorOption[];
	/** The method being asked for; `null` when there is none we can handle. */
	strategy: SecondFactorStrategy | null;
	/** Methods with too many wrong codes; a new code unlocks one that sends. */
	locked: readonly SecondFactorStrategy[];
	busy: "send" | "verify" | null;
	error: AuthError | null;
	/** The attempt expired or was dropped; only a new one helps. */
	ended: boolean;
	/** A new code was asked for and is on its way. */
	resent: boolean;
};

/** The sign-in has passed its first factor and waits for a second. */
export function needsSecondFactor(status: string | null | undefined): boolean {
	return status === "needs_second_factor" || status === "needs_client_trust";
}

/** The methods we can complete, default first, one per strategy. */
export function secondFactorOptions(
	factors:
		| readonly { strategy: string; safeIdentifier?: string }[]
		| null
		| undefined,
): SecondFactorOption[] {
	return SECOND_FACTOR_STRATEGIES.flatMap((strategy) => {
		const factor = factors?.find((f) => f.strategy === strategy);
		if (!factor) return [];
		const { safeIdentifier } = factor;
		return [safeIdentifier ? { strategy, safeIdentifier } : { strategy }];
	});
}

/** Texted and emailed codes are sent first; the other methods need nothing. */
export function sendsCode(strategy: SecondFactorStrategy): boolean {
	return strategy === "phone_code" || strategy === "email_code";
}

/** What the code field keeps of what was typed or pasted. */
export function secondFactorInput(
	strategy: SecondFactorStrategy,
	text: string,
): string {
	return strategy === "backup_code"
		? text
		: text.replace(/\D/g, "").slice(0, SECOND_FACTOR_CODE_LENGTH);
}

/** The code is worth sending to Clerk. */
export function secondFactorReady(
	strategy: SecondFactorStrategy,
	code: string,
): boolean {
	return strategy === "backup_code"
		? code.trim().length > 0
		: code.length === SECOND_FACTOR_CODE_LENGTH;
}

type CodeCall = (params: { code: string }) => Promise<SecondFactorResult>;

/** The part of Clerk Core 3's sign-in (`useSignIn().signIn`) the step uses. */
export type SecondFactorSignIn = {
	readonly status: string | null;
	finalize: () => Promise<SecondFactorResult>;
	mfa: {
		sendPhoneCode: () => Promise<SecondFactorResult>;
		sendEmailCode: () => Promise<SecondFactorResult>;
		verifyTOTP: CodeCall;
		verifyPhoneCode: CodeCall;
		verifyEmailCode: CodeCall;
		verifyBackupCode: CodeCall;
	};
};

/** Ends the step the way a dropped attempt does. */
const SUPERSEDED: SecondFactorResult = { error: { code: "sign_in_expired" } };

const NOT_FINISHED = Symbol("second factor verified, sign-in not complete");

/**
 * The step as the end of a sign-in: a verified code still needs `finalize()`
 * before the session is active. `current` is read per call, so a resource
 * Clerk swapped in meanwhile is the one used. Once `isCurrent` says a newer
 * attempt took over, nothing is sent, verified or finalized.
 */
export function signInSecondFactor(
	current: () => SecondFactorSignIn,
	isCurrent: () => boolean = () => true,
): SecondFactorActions {
	return {
		send: async (strategy) => {
			if (!isCurrent()) return SUPERSEDED;
			const { mfa } = current();
			return strategy === "phone_code"
				? mfa.sendPhoneCode()
				: mfa.sendEmailCode();
		},
		verify: async (strategy, code) => {
			if (!isCurrent()) return SUPERSEDED;
			const signIn = current();
			const complete = () => signIn.status === "complete";
			// A verified factor whose `finalize()` failed only needs the retry.
			if (!complete()) {
				const result = await verifyCode(signIn, strategy, code);
				if (result.error) return result;
				if (!isCurrent()) return SUPERSEDED;
				if (!complete()) return { error: NOT_FINISHED };
			}
			return signIn.finalize();
		},
	};
}

function verifyCode(
	{ mfa }: SecondFactorSignIn,
	strategy: SecondFactorStrategy,
	code: string,
) {
	switch (strategy) {
		case "totp":
			return mfa.verifyTOTP({ code });
		case "phone_code":
			return mfa.verifyPhoneCode({ code });
		case "email_code":
			return mfa.verifyEmailCode({ code });
		case "backup_code":
			return mfa.verifyBackupCode({ code });
	}
}

/**
 * Codes after which the attempt cannot finish. Too many wrong codes is not
 * one: Clerk only locks the method that failed (Foundry APP-526).
 */
const ATTEMPT_ENDED = new Set(["resource_not_found", "sign_in_expired"]);

export type SecondFactorFlow = ReturnType<typeof createSecondFactorFlow>;

/**
 * One second step, from opening to a verified code. `getState` and
 * `subscribe` fit React's `useSyncExternalStore`.
 */
export function createSecondFactorFlow(
	factors: Parameters<typeof secondFactorOptions>[0],
	actions: SecondFactorActions,
	/** There is no attempt to finish. */
	ended = false,
	/** The method this attempt already sent a code for or tried: reopens on it, sends nothing. */
	startedWith?: string | null,
) {
	const options = secondFactorOptions(factors);
	const resumed = options.find((o) => o.strategy === startedWith);
	let state: SecondFactorState = {
		options,
		strategy: (resumed ?? options[0])?.strategy ?? null,
		locked: [],
		busy: null,
		error: null,
		ended,
		resent: false,
	};
	const listeners = new Set<() => void>();
	let started = !!resumed;

	function set(change: Partial<SecondFactorState>) {
		state = { ...state, ...change };
		for (const listener of listeners) listener();
	}

	/** One Clerk call at a time; true when it succeeded. */
	async function run(
		busy: "send" | "verify",
		strategy: SecondFactorStrategy,
		call: () => Promise<SecondFactorResult>,
	): Promise<boolean> {
		set({ busy, error: null, resent: false });
		let error: unknown;
		try {
			error = (await call()).error;
		} catch (caught) {
			error = caught ?? new Error("second factor failed");
		}
		if (!error) return true;
		const mapped: AuthError =
			error === NOT_FINISHED
				? { key: "unsupportedStep" }
				: (clerkError(error) ?? { key: "generic" });
		set({
			busy: null,
			error: mapped,
			// After an accepted code, the same code would only be refused.
			ended:
				error === NOT_FINISHED ||
				ATTEMPT_ENDED.has(clerkErrorCode(error) ?? ""),
			locked:
				busy === "verify" && mapped.key === "codeAttemptsExceeded"
					? [...state.locked, strategy]
					: state.locked,
		});
		return false;
	}

	async function send(strategy: SecondFactorStrategy): Promise<boolean> {
		if (!(await run("send", strategy, () => actions.send(strategy)))) {
			return false;
		}
		// A new code starts its count of wrong codes over.
		set({
			busy: null,
			locked: state.locked.filter((method) => method !== strategy),
		});
		return true;
	}

	const idle = () => !state.busy && !state.ended;

	return {
		getState: () => state,
		subscribe: (listener: () => void) => {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
		/** Sends the default method's first code, once. */
		start: () => {
			if (started) return;
			started = true;
			if (!state.ended && state.strategy && sendsCode(state.strategy)) {
				void send(state.strategy);
			}
		},
		/**
		 * Checks the code; true once the step is done. The flow then stays busy:
		 * the screen is leaving.
		 */
		verify: async (code: string): Promise<boolean> => {
			const { strategy } = state;
			if (!strategy || !idle() || state.locked.includes(strategy)) return false;
			if (!secondFactorReady(strategy, code)) return false;
			return run("verify", strategy, () =>
				actions.verify(strategy, code.trim()),
			);
		},
		/** Sends the current method's code again; true when one went out. */
		resend: async (): Promise<boolean> => {
			const { strategy } = state;
			if (!strategy || !idle() || !sendsCode(strategy)) return false;
			if (!(await send(strategy))) return false;
			set({ resent: true });
			return true;
		},
		/** Switches method, sending its code first when it needs one. */
		switchTo: async (next: SecondFactorStrategy): Promise<boolean> => {
			if (!idle() || next === state.strategy) return false;
			if (sendsCode(next) && !(await send(next))) return false;
			set({ strategy: next, error: null, resent: false });
			return true;
		},
	};
}

/** The current method takes a code now. */
export function secondFactorOpen(state: SecondFactorState): boolean {
	return (
		!!state.strategy && !state.ended && !state.locked.includes(state.strategy)
	);
}

/** What the step ends: a sign-in, or confirming it's you while signed in. */
export type SecondFactorUse = "signIn" | "confirm";

/** The localized failure to show, never raw Clerk English. */
export function secondFactorMessage(
	messages: Pick<Messages, "auth">,
	locale: string,
	state: SecondFactorState,
	use: SecondFactorUse = "signIn",
): string | null {
	const { secondFactor } = messages.auth;
	const copy =
		use === "confirm"
			? { ...secondFactor, ...secondFactor.confirm }
			: secondFactor;
	const { strategy, locked, options } = state;
	if (state.ended && state.error?.key !== "unsupportedStep") {
		return copy.attemptEnded;
	}
	if (!strategy) return copy.noMethod;
	const spent = locked.includes(strategy) && !sendsCode(strategy);
	if (spent && (!state.error || state.error.key === "codeAttemptsExceeded")) {
		const usable = options.some((o) => !locked.includes(o.strategy));
		return usable ? copy.methodLocked : copy.onlyMethodLocked;
	}
	if (locked.includes(strategy) && !state.error) {
		return messages.auth.errors.codeAttemptsExceeded;
	}
	return authErrorMessage(messages, locale, state.error);
}

/** What to enter, for the method being asked for. */
export function secondFactorPrompt(
	messages: Pick<Messages, "auth">,
	option: SecondFactorOption,
): string {
	const copy = messages.auth.secondFactor;
	return fmt(copy.prompt[option.strategy], {
		destination: destination(copy, option),
	});
}

/** The label of the action that switches to this method. */
export function secondFactorSwitchLabel(
	messages: Pick<Messages, "auth">,
	option: SecondFactorOption,
): string {
	const copy = messages.auth.secondFactor;
	return fmt(copy.switchTo[option.strategy], {
		destination: destination(copy, option),
	});
}

function destination(
	copy: Messages["auth"]["secondFactor"],
	{ strategy, safeIdentifier }: SecondFactorOption,
) {
	return (
		safeIdentifier ??
		(strategy === "phone_code" ? copy.yourPhone : copy.yourEmail)
	);
}
