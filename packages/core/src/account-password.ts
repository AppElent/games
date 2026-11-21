/**
 * "Change password", the same on web and in the app: what to send Clerk's
 * `user.updatePassword`, and which field a refusal belongs to.
 */

/**
 * The `user.updatePassword` argument. A successful change signs the account
 * out everywhere else, so a stolen session ends with the old password; the
 * session that made the change stays signed in.
 */
export function passwordUpdate(currentPassword: string, newPassword: string) {
	return { currentPassword, newPassword, signOutOfOtherSessions: true };
}

/** Message keys a refused password change can name, shared by both apps. */
export type PasswordFailureKey =
	| "passwordIncorrect"
	| "passwordTooShort"
	| "passwordPwned"
	| "passwordDoesNotMeetRequirements";

export type PasswordFailure = {
	field: "current" | "new";
	key: PasswordFailureKey;
};

type ClerkEntry = { code?: unknown; meta?: { paramName?: unknown } };

function entries(error: unknown): ClerkEntry[] {
	const list = (error as { errors?: unknown } | null)?.errors;
	return Array.isArray(list) ? (list as ClerkEntry[]) : [];
}

/**
 * Codes Clerk puts on `current_password` when that password is wrong. It
 * uses `form_password_validation_failed`, the weak-new-password code too,
 * so only the field name tells the two apart.
 */
const WRONG_CURRENT = new Set([
	"form_password_validation_failed",
	"form_password_incorrect",
]);

/** Codes that refuse the new password itself. */
const WEAK_NEW: Readonly<Record<string, PasswordFailureKey>> = {
	form_password_validation_failed: "passwordDoesNotMeetRequirements",
	form_password_length_too_short: "passwordTooShort",
	form_password_pwned: "passwordPwned",
};

/**
 * The field a failed `user.updatePassword` points at, and its message key,
 * or `null` when the failure is not about either password (reverification,
 * network, rate limits) and the caller's general handling applies.
 */
export function passwordFailure(error: unknown): PasswordFailure | null {
	const list = entries(error);
	const wrongCurrent = list.some(
		(entry) =>
			entry.meta?.paramName === "current_password" &&
			typeof entry.code === "string" &&
			WRONG_CURRENT.has(entry.code),
	);
	if (wrongCurrent) return { field: "current", key: "passwordIncorrect" };
	for (const entry of list) {
		const key = typeof entry.code === "string" ? WEAK_NEW[entry.code] : null;
		if (key) return { field: "new", key };
	}
	return null;
}
