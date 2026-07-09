// src/lib/i18n/index.tsx
import {
	createContext,
	useCallback,
	useContext,
	useMemo,
	useState,
} from "react";
import { isLocale, LANG_COOKIE, type Locale, resolveLocale } from "./core";
import { en, type Messages } from "./messages/en";
import { nl } from "./messages/nl";

export type { Locale } from "./core";
export { fmt, isLocale, LANG_COOKIE, plural, resolveLocale } from "./core";
export type { Messages };

const MESSAGES: Record<Locale, Messages> = { en, nl };

type I18nValue = {
	locale: Locale;
	messages: Messages;
	setLocale: (locale: Locale) => void;
};

const I18nContext = createContext<I18nValue | null>(null);

function readLangCookie(): string | undefined {
	const row = document.cookie
		.split("; ")
		.find((entry) => entry.startsWith(`${LANG_COOKIE}=`));
	return row?.slice(LANG_COOKIE.length + 1);
}

/** Client-side locale resolution (mirrors the server's cookie-first order). */
export function readClientLocale(): Locale {
	return resolveLocale(readLangCookie(), navigator.language);
}

/** True when the user made an explicit choice (cookie set by setLocale). */
export function hasExplicitLocaleChoice(): boolean {
	return isLocale(readLangCookie());
}

export function LocaleProvider({
	initialLocale,
	children,
}: {
	initialLocale: Locale;
	children: React.ReactNode;
}) {
	const [locale, setLocaleState] = useState<Locale>(initialLocale);

	const setLocale = useCallback((next: Locale) => {
		setLocaleState(next);
		document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
		document.documentElement.lang = next;
	}, []);

	const value = useMemo<I18nValue>(
		() => ({ locale, messages: MESSAGES[locale], setLocale }),
		[locale, setLocale],
	);

	return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
	const value = useContext(I18nContext);
	if (!value) {
		throw new Error("useI18n must be used inside LocaleProvider");
	}
	return value;
}

export function useMessages(): Messages {
	return useI18n().messages;
}
