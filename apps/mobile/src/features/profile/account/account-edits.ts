/**
 * The decisions behind Profile's account edits, apart from the screens so
 * they run in tests without Clerk or native modules.
 */
import { passwordFailure } from "@arcadeclub/core/account-password";
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

/** The message key for a failed `user.updatePassword`. */
export function passwordChangeError(error: unknown): ErrorKey {
	return passwordFailure(error)?.key ?? clerkErrorKey(error) ?? "generic";
}
