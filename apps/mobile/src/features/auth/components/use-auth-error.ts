import {
	type AuthError,
	type AuthErrorKey,
	authErrorMessage,
} from "@arcadeclub/core/auth-errors";
import { useI18n } from "../../../i18n";

/** The translated message for a Clerk error (key or structured error), or `null`. */
export function useAuthError(
	error: AuthErrorKey | AuthError | null,
): string | null {
	const { locale, t } = useI18n();
	return authErrorMessage(t, locale, error);
}
