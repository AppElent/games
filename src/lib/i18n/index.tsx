import { createI18n } from "@appelent/i18n";
import {
	LOCALES,
	type Locale,
	type Messages,
	messages,
} from "@games/core/messages";

export { fmt, plural } from "@appelent/i18n";
export type { Locale, Messages };

export const SUPPORTED_LOCALES = LOCALES;

export const {
	LocaleProvider,
	useI18n,
	useMessages,
	readClientLocale,
	hasExplicitLocaleChoice,
} = createI18n<Locale, Messages>({
	locales: SUPPORTED_LOCALES,
	fallback: "en",
	messages,
});
