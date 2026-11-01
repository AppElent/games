import { resolveLocale } from "@appelent/i18n";
import { createServerFn } from "@tanstack/react-start";
import { getCookie, getRequestHeader } from "@tanstack/react-start/server";
import { SUPPORTED_LOCALES } from "./index";

/**
 * Defined here, not via `@appelent/i18n/server`'s factory: Start only compiles
 * server functions in app source, and the prebuilt one returns undefined
 * during SSR.
 */
export const getSsrLocale = createServerFn({ method: "GET" }).handler(() => ({
	locale: resolveLocale(
		SUPPORTED_LOCALES,
		"en",
		getCookie("lang"),
		getRequestHeader("accept-language"),
	),
}));
