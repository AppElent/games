import { createServerFn } from "@tanstack/react-start";
import { getCookie, getRequestHeader } from "@tanstack/react-start/server";
import { resolveLocale } from "./core";
import { SUPPORTED_LOCALES } from "./index";

/** The player's locale for SSR: the `lang` cookie, else Accept-Language. */
export const getSsrLocale = createServerFn({ method: "GET" }).handler(() => ({
	locale: resolveLocale(
		SUPPORTED_LOCALES,
		"en",
		getCookie("lang"),
		getRequestHeader("accept-language"),
	),
}));
