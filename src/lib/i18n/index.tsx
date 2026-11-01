import {
	LOCALES,
	type Locale,
	type Messages,
	messages,
} from "@arcadeclub/core/messages";
import { createI18n } from "./react";

export { fmt, plural } from "./core";
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
