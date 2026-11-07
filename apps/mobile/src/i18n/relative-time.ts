import { fmt, plural } from "@arcadeclub/core/i18n/format";
import type { Locale, Messages } from "./index";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "Just now", "5 minutes ago", … from the catalog's `common.time` forms. */
export function relativeTime(
	t: Messages,
	locale: Locale,
	timestamp: number,
	now = Date.now(),
): string {
	const elapsed = Math.max(0, now - timestamp);
	const forms = t.common.time;
	const say = (count: number, form: { one: string; other: string }) =>
		fmt(plural(locale, count, form), { count });
	if (elapsed < MINUTE) return forms.justNow;
	if (elapsed < HOUR)
		return say(Math.floor(elapsed / MINUTE), forms.minutesAgo);
	if (elapsed < DAY) return say(Math.floor(elapsed / HOUR), forms.hoursAgo);
	return say(Math.floor(elapsed / DAY), forms.daysAgo);
}
