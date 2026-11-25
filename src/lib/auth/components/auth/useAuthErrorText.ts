import { authErrorMessage, clerkError } from "@arcadeclub/core/auth-errors";
import { useI18n } from "#/lib/i18n";

/**
 * Turns a thrown Clerk error into catalog copy in the page's language, never
 * Clerk's own English; an unknown code reads as the generic message, a locked
 * account shows its wait.
 */
export function useAuthErrorText(): (error: unknown) => string {
	const { messages, locale } = useI18n();
	return (error) =>
		authErrorMessage(messages, locale, clerkError(error)) ??
		messages.auth.errors.generic;
}
