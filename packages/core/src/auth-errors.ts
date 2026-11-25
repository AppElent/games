/**
 * Clerk error codes mapped to `messages.auth.errors` keys, so a sign-in
 * failure reaches the player as catalog copy, never as Clerk's English.
 * Clerk Core 3 calls resolve to `{ error }` wrappers, while the
 * machine-stable code also sits on the hook's `errors` signal, so field
 * errors are read first and the wrapper last.
 *
 * The web and apps/mobile both read this module: one table, one order.
 */
import type { Messages } from "./i18n/en";
import { fmt, plural } from "./i18n/format";

export type AuthErrorKey = keyof Messages["auth"]["errors"];

/** A mapped Clerk failure: its catalog key, plus any lockout wait Clerk reported. */
export type AuthError = {
	key: AuthErrorKey;
	/** Remaining seconds on a `user_locked` cooldown, when Clerk gives one. */
	lockoutSeconds?: number;
};

const CODE_MAP: Readonly<Record<string, AuthErrorKey>> = {
	form_identifier_not_found: "identifierNotFound",
	form_password_incorrect: "passwordIncorrect",
	// A password attempt on an account made with an emailed code (APP-561).
	strategy_for_user_invalid: "noPassword",
	form_identifier_exists: "identifierExists",
	form_param_format_invalid: "emailInvalid",
	form_param_nil: "required",
	form_param_missing: "required",
	form_password_length_too_short: "passwordTooShort",
	form_password_pwned: "passwordPwned",
	form_password_validation_failed: "passwordDoesNotMeetRequirements",
	// Clerk's per-rule password codes (Foundry APP-538 saw them live).
	form_password_not_strong_enough: "passwordDoesNotMeetRequirements",
	form_password_no_uppercase: "passwordDoesNotMeetRequirements",
	form_password_no_lowercase: "passwordDoesNotMeetRequirements",
	form_password_no_number: "passwordDoesNotMeetRequirements",
	form_password_no_special_char: "passwordDoesNotMeetRequirements",
	form_conditional_param_missing: "required",
	form_code_incorrect: "codeIncorrect",
	// Too many wrong codes: this code is spent, a new one works (APP-527).
	verification_failed: "codeAttemptsExceeded",
	verification_code_too_many_attempts: "codeAttemptsExceeded",
	verification_max_attempts_reached: "codeAttemptsExceeded",
	form_verification_max_attempts_reached: "codeAttemptsExceeded",
	verification_expired: "codeExpired",
	verification_not_sent: "codeExpired",
	verification_missing: "codeExpired",
	user_locked: "accountLocked",
	too_many_requests: "tooManyRequests",
	too_many_attempts: "tooManyRequests",
	too_many_verifications: "tooManyRequests",
	rate_limit_exceeded: "tooManyRequests",
	network_error: "network",
	clerk_offline: "network",
	form_param_max_length_exceeded: "tooLong",
	session_reverification_required: "signInAgain",
	session_not_found: "signInAgain",
	authentication_invalid: "signInAgain",
	authorization_invalid: "signInAgain",
};

const UNIT_SECONDS: Readonly<Record<string, number>> = {
	second: 1,
	minute: 60,
	hour: 3600,
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function positiveSeconds(value: unknown): number | undefined {
	return typeof value === "number" && Number.isFinite(value) && value > 0
		? value
		: undefined;
}

/**
 * A machine-stable code. Nested `errors` win over the error's own code: a
 * `ClerkAPIResponseError` carries `code: "api_response_error"` on itself
 * and the real code, such as `form_password_incorrect`, in `errors[]`.
 */
export function clerkErrorCode(error: unknown, depth = 0): string | null {
	if (!isRecord(error) || depth > 8) return null;
	if (Array.isArray(error.errors)) {
		for (const nested of error.errors) {
			const code = clerkErrorCode(nested, depth + 1);
			if (code) return code;
		}
	}
	return typeof error.code === "string" ? error.code : null;
}

function lockoutSecondsFromRecord(
	record: Record<string, unknown>,
): number | undefined {
	const meta = isRecord(record.meta) ? record.meta : null;
	const metaData = meta && isRecord(meta.data) ? meta.data : null;
	const direct =
		positiveSeconds(meta?.lockout_expires_in_seconds) ??
		positiveSeconds(meta?.lockoutExpiresInSeconds) ??
		positiveSeconds(metaData?.lockout_expires_in_seconds) ??
		positiveSeconds(metaData?.lockoutExpiresInSeconds) ??
		positiveSeconds(record.retryAfter) ??
		positiveSeconds(record.retry_after);
	if (direct) return direct;
	// `@clerk/shared`'s `ClerkAPIError` drops unknown `meta` fields, leaving the
	// wait only inside `longMessage` (for example "try again in 30 minutes").
	// Parse the numeric duration so we still show our own translated copy. A
	// compound wait ("1 hour and 30 minutes") would understate, so it shows "later".
	if (record.code !== "user_locked") return undefined;
	const text =
		typeof record.longMessage === "string"
			? record.longMessage
			: typeof record.long_message === "string"
				? record.long_message
				: null;
	const match = text?.match(
		/\bin\s+(\d+)\s+(second|minute|hour)s?\b(?![\s,]+(?:and\s+)?\d)/i,
	);
	if (!match) return undefined;
	const amount = Number.parseInt(match[1], 10);
	const unit = UNIT_SECONDS[match[2].toLowerCase()];
	return positiveSeconds(unit ? amount * unit : undefined);
}

function clerkLockoutSeconds(error: unknown, depth = 0): number | undefined {
	if (!isRecord(error) || depth > 8) return undefined;
	if (Array.isArray(error.errors)) {
		for (const nested of error.errors) {
			const seconds = clerkLockoutSeconds(nested, depth + 1);
			if (seconds) return seconds;
		}
	}
	return lockoutSecondsFromRecord(error);
}

/** The catalog key for an error, `generic` for an unknown one, `null` for none. */
export function clerkErrorKey(error: unknown): AuthErrorKey | null {
	if (!error) return null;
	const code = clerkErrorCode(error);
	if (code && Object.hasOwn(CODE_MAP, code)) return CODE_MAP[code];
	if (isRecord(error) && error.status === 429) return "tooManyRequests";
	return "generic";
}

/** Mapped Clerk failure, including any lockout wait Clerk reported. */
export function clerkError(error: unknown): AuthError | null {
	const key = clerkErrorKey(error);
	if (!key) return null;
	if (key === "accountLocked") {
		const lockoutSeconds = clerkLockoutSeconds(error);
		if (lockoutSeconds) return { key, lockoutSeconds };
	}
	return { key };
}

/** The longest lockout wait shown as a number; beyond it the message says "later". */
export const MAX_LOCKOUT_SECONDS = 24 * 3600;

/** Localized copy for a mapped Clerk error, never raw Clerk English. */
export function authErrorMessage(
	messages: Pick<Messages, "auth">,
	locale: string,
	error: AuthErrorKey | AuthError | null,
): string | null {
	if (!error) return null;
	if (typeof error === "string") return messages.auth.errors[error];
	const seconds = positiveSeconds(error.lockoutSeconds);
	// A wait of days (or a garbled one) reads as nonsense in hours: say "later".
	if (
		error.key === "accountLocked" &&
		seconds !== undefined &&
		seconds <= MAX_LOCKOUT_SECONDS
	) {
		const { lockout } = messages.auth;
		const duration =
			seconds < 60
				? plural(locale, Math.max(1, Math.ceil(seconds)), lockout.seconds)
				: Math.ceil(seconds / 60) < 60
					? plural(locale, Math.ceil(seconds / 60), lockout.minutes)
					: plural(locale, Math.ceil(seconds / 3600), lockout.hours);
		return fmt(lockout.body, { duration });
	}
	return messages.auth.errors[error.key];
}

export type ClerkErrorSignal = {
	fields?: object | null;
	global?: readonly unknown[] | null;
};

/**
 * Field errors first, then global, then the method's returned wrapper; the
 * mapped failure with any lockout wait Clerk gave.
 */
export function pickClerkError(
	errors: ClerkErrorSignal | null | undefined,
	returned: unknown,
): AuthError | null {
	for (const value of Object.values(errors?.fields ?? {})) {
		const list = Array.isArray(value) ? value : [value];
		for (const item of list) {
			const error = clerkError(item);
			if (error) return error;
		}
	}
	return clerkError(errors?.global?.[0]) ?? clerkError(returned);
}

/** `pickClerkError`'s catalog key alone, for callers that show no wait. */
export function pickClerkErrorKey(
	errors: ClerkErrorSignal | null | undefined,
	returned: unknown,
): AuthErrorKey | null {
	return pickClerkError(errors, returned)?.key ?? null;
}
