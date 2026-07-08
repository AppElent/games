import { useUser } from "@clerk/clerk-react";
import { useEffect } from "react";
import { hasExplicitLocaleChoice, isLocale, useI18n } from "./index";

export function LanguageSync() {
	const { user } = useUser();
	const { locale, setLocale } = useI18n();
	const userId = user?.id;

	// biome-ignore lint/correctness/useExhaustiveDependencies: `user` identity changes on every update() — keying on userId/locale is deliberate to avoid a sync loop.
	useEffect(() => {
		if (!user) {
			return;
		}
		const saved = user.unsafeMetadata?.language;
		const savedLocale = isLocale(saved) ? saved : undefined;
		if (savedLocale === locale) {
			return;
		}
		if (savedLocale && !hasExplicitLocaleChoice()) {
			setLocale(savedLocale);
			return;
		}
		user
			.update({ unsafeMetadata: { ...user.unsafeMetadata, language: locale } })
			.catch(() => {
				// Best-effort sync; the cookie already holds the choice locally.
			});
	}, [userId, locale, setLocale]);

	return null;
}
