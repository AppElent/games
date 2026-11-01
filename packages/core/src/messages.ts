/**
 * The one Arcade Club message catalog, shared by the web app and apps/mobile.
 * Each app keeps its own i18n runtime and passes these trees to it.
 */
import { en, type Messages } from "./i18n/en";
import { nl } from "./i18n/nl";

export type { Messages };

export const LOCALES = ["en", "nl"] as const;
export type Locale = (typeof LOCALES)[number];

export const messages: Record<Locale, Messages> = { en, nl };
