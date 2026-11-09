/**
 * Clerk error codes mapped to translated copy. Behaviour copied from
 * developer-tools `auth/examples/native.ts`: Core 3 calls resolve to
 * `{ error }` wrappers, while the machine-stable code lives on the hook's
 * `errors` signal, so field errors are read first and the wrapper last.
 */
import type { Messages } from "../../../i18n";

export type ErrorKey = keyof Messages["auth"]["errors"];

const CODE_MAP: Readonly<Record<string, ErrorKey>> = {
	form_identifier_not_found: "identifierNotFound",
	form_password_incorrect: "passwordIncorrect",
	form_identifier_exists: "identifierExists",
	form_param_format_invalid: "emailInvalid",
	form_param_nil: "required",
	form_param_missing: "required",
	form_password_length_too_short: "passwordTooShort",
	form_password_pwned: "passwordPwned",
	form_password_validation_failed: "passwordDoesNotMeetRequirements",
	form_code_incorrect: "codeIncorrect",
	verification_failed: "codeIncorrect",
	verification_expired: "codeExpired",
	too_many_requests: "tooManyRequests",
	rate_limit_exceeded: "tooManyRequests",
	network_error: "network",
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

/** A machine-stable code, searched through nested `errors` arrays. */
function clerkErrorCode(error: unknown, depth = 0): string | null {
	if (!isRecord(error) || depth > 8) return null;
	if (typeof error.code === "string") return error.code;
	if (Array.isArray(error.errors)) {
		for (const nested of error.errors) {
			const code = clerkErrorCode(nested, depth + 1);
			if (code) return code;
		}
	}
	return null;
}

/** The translation key for an error, or `null` for no error. */
function clerkErrorKey(error: unknown): ErrorKey | null {
	if (!error) return null;
	const code = clerkErrorCode(error);
	const key = code ? CODE_MAP[code] : undefined;
	if (code && !key && __DEV__) {
		console.warn(`[auth] unmapped Clerk error code: ${code}`);
	}
	return key ?? "generic";
}

export type ClerkErrorSignal = {
	fields?: object;
	global?: readonly unknown[] | null;
};

/** Field errors first, then global, then the method's returned wrapper. */
export function pickClerkErrorKey(
	errors: ClerkErrorSignal | null | undefined,
	returned: unknown,
): ErrorKey | null {
	for (const value of Object.values(errors?.fields ?? {})) {
		const list = Array.isArray(value) ? value : [value];
		for (const item of list) {
			const key = clerkErrorKey(item);
			if (key) return key;
		}
	}
	return clerkErrorKey(errors?.global?.[0]) ?? clerkErrorKey(returned);
}
