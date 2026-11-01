import { createLanguageSync } from "./clerk-sync";
import { hasExplicitLocaleChoice, SUPPORTED_LOCALES, useI18n } from "./index";

export const LanguageSync = createLanguageSync({
	useI18n,
	hasExplicitLocaleChoice,
	locales: SUPPORTED_LOCALES,
});
