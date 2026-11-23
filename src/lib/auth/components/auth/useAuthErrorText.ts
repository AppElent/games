import { clerkErrorKey } from "@arcadeclub/core/auth-errors";
import { useMessages } from "#/lib/i18n";

/**
 * Turns a thrown Clerk error into catalog copy in the page's language, never
 * Clerk's own English; an unknown code reads as the generic message.
 */
export function useAuthErrorText(): (error: unknown) => string {
	const { errors } = useMessages().auth;
	return (error) => errors[clerkErrorKey(error) ?? "generic"];
}
