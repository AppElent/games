/**
 * Starts Sentry. Imported first by `app/_layout.tsx` so a crash during the
 * rest of module evaluation is still reported. A no-op without
 * `EXPO_PUBLIC_SENTRY_DSN`, and in a development bundle unless
 * `EXPO_PUBLIC_SENTRY_DEBUG=1`. Also owns the player feedback form.
 *
 * Static dot access on `process.env` is load-bearing: Metro inlines
 * `EXPO_PUBLIC_*` textually at bundle time.
 */
import { type Locale, messages } from "@arcadeclub/core/messages";
import * as Sentry from "@sentry/react-native";
import * as Updates from "expo-updates";
import {
	buildSentryOptions,
	environmentFromChannel,
	FEEDBACK_OPTIONS,
	feedbackLabels,
	sanitizeFeedbackEvent,
	shouldInitSentry,
} from "./options";

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

/** Whether this bundle reports to Sentry; gate `Sentry.wrap` on it. */
export const sentryEnabled = Boolean(
	dsn &&
		shouldInitSentry({
			dsn,
			dev: __DEV__,
			debug: process.env.EXPO_PUBLIC_SENTRY_DEBUG,
		}),
);

const feedback = Sentry.feedbackIntegration({
	...FEEDBACK_OPTIONS,
	...feedbackLabels(messages.en.common.feedback),
});

/** Keeps the feedback form in the language the app is showing. */
export function setFeedbackLocale(locale: Locale) {
	Object.assign(
		feedback.options,
		feedbackLabels(messages[locale].common.feedback),
	);
}

/** Opens the feedback form; false when this build doesn't report. */
export function openFeedbackForm(): boolean {
	if (!sentryEnabled) return false;
	Sentry.showFeedbackForm();
	return true;
}

if (dsn && sentryEnabled) {
	Sentry.init({
		...buildSentryOptions({
			dsn,
			environment: environmentFromChannel(Updates.channel, __DEV__),
		}),
		integrations: [feedback],
	});
	Sentry.addEventProcessor(sanitizeFeedbackEvent);
}
