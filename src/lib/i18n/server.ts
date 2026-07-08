import { createServerFn } from "@tanstack/react-start";
import { getCookie, getRequestHeader } from "@tanstack/react-start/server";
import { LANG_COOKIE, type Locale, resolveLocale } from "./core";

export const getSsrLocale = createServerFn({ method: "GET" }).handler(
	(): { locale: Locale } => ({
		locale: resolveLocale(
			getCookie(LANG_COOKIE),
			getRequestHeader("accept-language"),
		),
	}),
);
