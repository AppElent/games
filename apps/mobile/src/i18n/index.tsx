/**
 * The phone's language: a saved choice beats the device's language list,
 * which beats English. Resolved synchronously during the first render (see
 * `src/storage/local-store.ts`) so no frame paints in the wrong language.
 *
 * Mounted outside Clerk and Convex: language belongs to the phone, not the
 * account, and has to apply to sign-in and offline states too.
 */

import { DEFAULT_LOCALE, resolveLocale } from "@arcadeclub/core/i18n/format";
import {
	LOCALES,
	type Locale,
	type Messages,
	messages,
} from "@arcadeclub/core/messages";
import { getLocales } from "expo-localization";
import {
	createContext,
	type ReactNode,
	use,
	useCallback,
	useEffect,
	useMemo,
	useState,
} from "react";
import { setFeedbackLocale } from "../observability/init";
import { readText, STORAGE_KEYS, writeText } from "../storage/local-store";

export { fmt, plural } from "@arcadeclub/core/i18n/format";
export type { Locale, Messages };

function initialLocale(): Locale {
	let device = "";
	try {
		device = getLocales()
			.map(({ languageTag }) => languageTag)
			.join(",");
	} catch {
		// No native locale module: fall back to English.
	}
	return resolveLocale(
		LOCALES,
		DEFAULT_LOCALE,
		readText(STORAGE_KEYS.locale) ?? undefined,
		device,
	);
}

interface I18nValue {
	locale: Locale;
	/** The message tree for the active locale. */
	t: Messages;
	setLocale: (next: Locale) => void;
}

const I18nContext = createContext<I18nValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
	const [locale, setStoredLocale] = useState(initialLocale);

	const setLocale = useCallback((next: Locale) => {
		setStoredLocale(next);
		writeText(STORAGE_KEYS.locale, next);
	}, []);

	// The shake-to-report form follows the app's language.
	useEffect(() => setFeedbackLocale(locale), [locale]);

	const value = useMemo(
		() => ({ locale, t: messages[locale], setLocale }),
		[locale, setLocale],
	);

	return <I18nContext value={value}>{children}</I18nContext>;
}

export function useI18n(): I18nValue {
	const value = use(I18nContext);
	if (!value) throw new Error("useI18n must be used within a LocaleProvider");
	return value;
}
