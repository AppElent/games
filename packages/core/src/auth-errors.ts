/**
 * Clerk error codes mapped to `messages.auth.errors` keys, so a sign-in
 * failure reaches the player as catalog copy, never as Clerk's English.
 * Clerk Core 3 calls resolve to `{ error }` wrappers, while the
 * machine-stable code also sits on the hook's `errors` signal, so field
 * errors are read first and the wrapper last.
 *
 * The web reads this module; apps/mobile still has its own copy in
 * `features/auth/components/clerk-errors.ts` with the same table.
 */
import type { Messages } from "./i18n/en";

export type AuthErrorKey = keyof Messages["auth"]["errors"];

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
	form_code_incorrect: "codeIncorrect",
	// Too many wrong codes: this code is spent, a new one works (APP-527).
	verification_failed: "codeAttemptsExceeded",
	verification_expired: "codeExpired",
	too_many_requests: "tooManyRequests",
	rate_limit_exceeded: "tooManyRequests",
	network_error: "network",
	form_param_max_length_exceeded: "tooLong",
	session_reverification_required: "signInAgain",
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

/**
 * A machine-stable code. Nested `errors` win over the error's own code: a
 * `ClerkAPIResponseError` carries `code: "api_response_error"` on itself
 * and the real code, such as `form_password_incorrect`, in `errors[]`.
 */
function clerkErrorCode(error: unknown, depth = 0): string | null {
	if (!isRecord(error) || depth > 8) return null;
	if (Array.isArray(error.errors)) {
		for (const nested of error.errors) {
			const code = clerkErrorCode(nested, depth + 1);
			if (code) return code;
		}
	}
	return typeof error.code === "string" ? error.code : null;
}

/** The catalog key for an error, `generic` for an unknown one, `null` for none. */
export function clerkErrorKey(error: unknown): AuthErrorKey | null {
	if (!error) return null;
	const code = clerkErrorCode(error);
	return (code ? CODE_MAP[code] : undefined) ?? "generic";
}

export type ClerkErrorSignal = {
	fields?: object | null;
	global?: readonly unknown[] | null;
};

/** Field errors first, then global, then the method's returned wrapper. */
export function pickClerkErrorKey(
	errors: ClerkErrorSignal | null | undefined,
	returned: unknown,
): AuthErrorKey | null {
	for (const value of Object.values(errors?.fields ?? {})) {
		const list = Array.isArray(value) ? value : [value];
		for (const item of list) {
			const key = clerkErrorKey(item);
			if (key) return key;
		}
	}
	return clerkErrorKey(errors?.global?.[0]) ?? clerkErrorKey(returned);
}
