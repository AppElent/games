import type { CardWords } from "@arcadeclub/core/cards/table-view";
import { fmt, plural, useI18n, useMessages } from "#/lib/i18n";

/** The current language's words and text helpers for the shared table logic. */
export function useCardWords(): CardWords {
	const { locale } = useI18n();
	return {
		cards: useMessages().games.cards,
		fmt,
		countOf: (count, forms) => plural(locale, count, forms),
	};
}
