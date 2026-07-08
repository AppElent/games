import { fmt, useI18n } from "#/lib/i18n";

const LOCALE_NAMES = { en: "English", nl: "Nederlands" } as const;

export default function LanguageToggle() {
	const { locale, messages, setLocale } = useI18n();
	const next = locale === "en" ? "nl" : "en";
	const label = fmt(messages.common.header.switchLanguage, {
		language: LOCALE_NAMES[next],
	});

	return (
		<button
			type="button"
			onClick={() => setLocale(next)}
			aria-label={label}
			title={label}
			className="rounded-md border border-white/10 bg-white/10 px-3 py-2 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-white/15"
		>
			{locale.toUpperCase()}
		</button>
	);
}
