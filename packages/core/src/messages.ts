/**
 * The one Arcade Club message catalog, shared by the web app and apps/mobile.
 * The runtime (`fmt`, `plural`, locale resolution) is `i18n/format.ts`; each
 * app keeps its own provider, storage and language controls and passes these
 * trees to them.
 */
import { en, type Messages } from "./i18n/en";
import { nl } from "./i18n/nl";

export type { Messages };

export const LOCALES = ["en", "nl"] as const;
export type Locale = (typeof LOCALES)[number];

export const messages: Record<Locale, Messages> = { en, nl };
