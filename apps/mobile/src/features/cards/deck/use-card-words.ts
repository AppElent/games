import type { CardWords } from "@arcadeclub/core/cards/table-view";
import { useMemo } from "react";
import { fmt, plural, useI18n } from "../../../i18n";

/** The current language's words and text helpers for the shared table logic. */
export function useCardWords(): CardWords {
	const { t, locale } = useI18n();
	return useMemo(
		() => ({
			cards: t.games.cards,
			fmt,
			countOf: (count, forms) => plural(locale, count, forms),
		}),
		[t, locale],
	);
}
