export const SUPPORTED_LOCALES = ["en", "nl"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

/** Cookie that stores an explicit user language choice. */
export const LANG_COOKIE = "lang";

export function isLocale(value: unknown): value is Locale {
	return SUPPORTED_LOCALES.includes(value as Locale);
}

/**
 * Resolve the active locale: explicit cookie choice first, then the first
 * Accept-Language entry matching a supported locale, then English.
 */
export function resolveLocale(
	cookieValue: string | undefined,
	acceptLanguage: string | undefined,
): Locale {
	if (isLocale(cookieValue)) {
		return cookieValue;
	}
	if (acceptLanguage) {
		for (const part of acceptLanguage.split(",")) {
			const tag = part.split(";")[0]?.trim().toLowerCase();
			if (!tag) {
				continue;
			}
			for (const locale of SUPPORTED_LOCALES) {
				if (tag === locale || tag.startsWith(`${locale}-`)) {
					return locale;
				}
			}
		}
	}
	return "en";
}

/** Interpolate {name} placeholders. Unknown placeholders are left as-is. */
export function fmt(
	template: string,
	params: Record<string, string | number>,
): string {
	return template.replace(/\{(\w+)\}/g, (match, key: string) =>
		key in params ? String(params[key]) : match,
	);
}

/** Pick a plural form (en and nl both only have one/other) and fill {count}. */
export function plural(
	locale: Locale,
	count: number,
	forms: { one: string; other: string },
): string {
	const category = new Intl.PluralRules(locale).select(count);
	const template = category === "one" ? forms.one : forms.other;
	return fmt(template, { count });
}
