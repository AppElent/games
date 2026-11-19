/**
 * The decisions behind Profile's account edits, apart from the screens so
 * they run in tests without Clerk or native modules.
 */
import {
	clerkErrorKey,
	type ErrorKey,
} from "../../auth/components/clerk-errors";

export type AccountName = { firstName: string; lastName: string };

/** The trimmed name to send to Clerk, or `null` when nothing changed. */
export function nameUpdate(
	saved: { firstName: string | null; lastName: string | null },
	draft: AccountName,
): AccountName | null {
	const next = {
		firstName: draft.firstName.trim(),
		lastName: draft.lastName.trim(),
	};
	return next.firstName === (saved.firstName ?? "").trim() &&
		next.lastName === (saved.lastName ?? "").trim()
		? null
		: next;
}

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

/** The message key for a failed `user.updatePassword`. */
export function passwordChangeError(error: unknown): ErrorKey {
	const wrongCurrent = entries(error).some(
		(entry) =>
			entry.meta?.paramName === "current_password" &&
			typeof entry.code === "string" &&
			WRONG_CURRENT.has(entry.code),
	);
	if (wrongCurrent) return "passwordIncorrect";
	return clerkErrorKey(error) ?? "generic";
}
