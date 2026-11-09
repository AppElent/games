/**
 * Starts Sentry. Imported first by `app/_layout.tsx` so a crash during the
 * rest of module evaluation is still reported. A no-op without
 * `EXPO_PUBLIC_SENTRY_DSN`, and in a development bundle unless
 * `EXPO_PUBLIC_SENTRY_DEBUG=1`. Also owns the player feedback form.
 */
import { type Locale, messages } from "@arcadeclub/core/messages";
import * as Sentry from "@sentry/react-native";
import * as Updates from "expo-updates";
import { env } from "../env";
// tokens.ts, not the theme index: the index loads the appearance store, which
// must not run before Sentry starts.
import { darkColors, lightColors } from "../theme/tokens";
import {
	buildSentryOptions,
	environmentFromChannel,
	FEEDBACK_OPTIONS,
	feedbackLabels,
	feedbackTheme,
	sanitizeFeedbackEvent,
	shouldInitSentry,
} from "./options";

/** The DSN this bundle reports to, or `null` when it does not report. */
const dsn = shouldInitSentry({
	dsn: env.sentryDsn,
	dev: __DEV__,
	debug: env.sentryDebug,
})
	? (env.sentryDsn ?? null)
	: null;

/**
 * Whether this bundle reports to Sentry: the one check for `Sentry.wrap`
 * and for offering the feedback form.
 */
export const sentryEnabled = dsn !== null;

const feedback = Sentry.feedbackIntegration({
	...FEEDBACK_OPTIONS,
	...feedbackLabels(messages.en.common.feedback),
	themeLight: feedbackTheme(lightColors),
	themeDark: feedbackTheme(darkColors),
});

/** Keeps the feedback form in the language the app is showing. */
export function setFeedbackLocale(locale: Locale) {
	Object.assign(
		feedback.options,
		feedbackLabels(messages[locale].common.feedback),
	);
}

/** Opens the feedback form; offer it only when `sentryEnabled`. */
export function openFeedbackForm() {
	Sentry.showFeedbackForm();
}

if (dsn) {
	Sentry.init({
		...buildSentryOptions({
			dsn,
			environment: environmentFromChannel(Updates.channel, __DEV__),
		}),
		integrations: [feedback],
	});
	Sentry.addEventProcessor(sanitizeFeedbackEvent);
}
