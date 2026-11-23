import type { AuthErrorKey } from "@arcadeclub/core/auth-errors";
import { useI18n } from "../../../i18n";

/** The translated message for a Clerk error key, or `null`. */
export function useAuthError(key: AuthErrorKey | null): string | null {
	const { t } = useI18n();
	return key ? t.auth.errors[key] : null;
}
