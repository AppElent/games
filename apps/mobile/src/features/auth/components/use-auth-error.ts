import { useI18n } from "../../../i18n";
import type { ErrorKey } from "./clerk-errors";

/** The translated message for a Clerk error key, or `null`. */
export function useAuthError(key: ErrorKey | null): string | null {
	const { t } = useI18n();
	return key ? t.auth.errors[key] : null;
}
