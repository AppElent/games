/**
 * The decisions behind Profile's account edits, apart from the screens so
 * they run in tests without Clerk or native modules.
 */
import { passwordFailure } from "@arcadeclub/core/account-password";
import { type AuthErrorKey, clerkErrorKey } from "@arcadeclub/core/auth-errors";
import { gameErrorData } from "@arcadeclub/core/errors";

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

export type PasswordChangeError = AuthErrorKey | "secondFactorUnsupported";

/** The message key for a failed password change. */
export function passwordChangeError(error: unknown): PasswordChangeError {
	switch (gameErrorData(error)?.code) {
		case "accountSignInFirst":
		case "accountSessionEnded":
			return "signInAgain";
		case "accountSecondFactorUnsupported":
			return "secondFactorUnsupported";
		case "accountChanged":
			return "generic";
	}
	return passwordFailure(error)?.key ?? clerkErrorKey(error) ?? "generic";
}
