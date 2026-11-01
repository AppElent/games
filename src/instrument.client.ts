/**
 * Browser Sentry, imported first by `client.tsx` so it runs before hydration.
 * Errors and player feedback only, like the app (docs/runbooks/sentry.md).
 */
import * as Sentry from "@sentry/react";
import {
	DEFAULT_SENTRY_DSN,
	isLocalSentryUrl,
	SENTRY_DATA_COLLECTION,
} from "./lib/observability/config";
import {
	sanitizeBreadcrumb,
	sanitizeEvent,
	sanitizeFeedbackEvent,
} from "./lib/observability/privacy";

Sentry.init({
	dsn: import.meta.env.VITE_SENTRY_DSN || DEFAULT_SENTRY_DSN,
	enabled: !import.meta.env.DEV && !isLocalSentryUrl(window.location.href),
	environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE,
	release: import.meta.env.VITE_SENTRY_RELEASE,
	dataCollection: { ...SENTRY_DATA_COLLECTION, httpBodies: [] },
	beforeSend: sanitizeEvent,
	beforeBreadcrumb: sanitizeBreadcrumb,
	integrations: (defaults) =>
		defaults.filter((integration) => integration.name !== "Console"),
});

// Feedback skips beforeSend; redact the typed report separately.
Sentry.addEventProcessor(sanitizeFeedbackEvent);
Sentry.setTag("app", "arcadeclub-web");
