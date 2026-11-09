/**
 * What the phone sends to Sentry, as plain data so a test can run it
 * without the SDK. `init.ts` is the only caller that touches the SDK.
 * Policy: docs/runbooks/mobile.md#error-reporting.
 */
import type { Messages } from "@arcadeclub/core/messages";
import type { Breadcrumb, ErrorEvent, Event } from "@sentry/react-native";
import type { Tokens } from "../theme";

export type SentryEnvironment = "development" | "preview" | "production";

/**
 * A DSN is required, and a development bundle stays silent unless
 * `EXPO_PUBLIC_SENTRY_DEBUG=1` asks for it: Metro bundles run from a laptop
 * and their errors are not players'.
 */
export function shouldInitSentry(config: {
	dsn: string | undefined;
	dev: boolean;
	debug: string | undefined;
}): boolean {
	if (!config.dsn) return false;
	return !config.dev || config.debug === "1";
}

/** The EAS Update channel a build was made for is its deployment. */
export function environmentFromChannel(
	channel: string | null | undefined,
	dev: boolean,
): SentryEnvironment {
	if (channel === "preview" || channel === "development") return channel;
	return dev ? "development" : "production";
}

function stripQuery(url: unknown): unknown {
	return typeof url === "string" ? url.split(/[?#]/)[0] : url;
}

/** Drops request details and user identity; keeps the stack and tags. */
export function sanitizeEvent(event: ErrorEvent): ErrorEvent {
	const { user: _user, request, ...rest } = event;
	return {
		...rest,
		...(request ? { request: { url: stripQuery(request.url) as string } } : {}),
	};
}

/**
 * Feedback skips `beforeSend`, so a registered event processor gives the
 * report the same treatment: no user, no contact fields, no query string.
 * Other events pass through to the error hooks untouched.
 */
export function sanitizeFeedbackEvent<T extends Event>(event: T): T {
	if (event.type !== "feedback") return event;
	const feedback = event.contexts?.feedback as
		| { url?: string; contact_email?: string; name?: string }
		| undefined;
	if (feedback) {
		delete feedback.contact_email;
		delete feedback.name;
		if (feedback.url) feedback.url = stripQuery(feedback.url) as string;
	}
	const { user: _user, request: _request, ...rest } = event;
	return rest as T;
}

/**
 * The feedback form: no name or email field, an optional screenshot the
 * player takes themselves, and opened by a shake or the Profile row.
 */
export const FEEDBACK_OPTIONS = {
	enableShakeToReport: true,
	showName: false,
	showEmail: false,
	isNameRequired: false,
	isEmailRequired: false,
	enableScreenshot: false,
	enableTakeScreenshot: true,
	showBranding: false,
} as const;

/** The form in the app's colors instead of Sentry's purple. */
export function feedbackTheme(colors: Tokens) {
	return {
		background: colors.bg,
		foreground: colors.text,
		accentBackground: colors.accent,
		accentForeground: colors.onAccent,
		border: colors.border,
	};
}

/** The form's labels in the player's language. */
export function feedbackLabels(text: Messages["common"]["feedback"]) {
	return {
		formTitle: text.report,
		messageLabel: text.message,
		isRequiredLabel: text.required,
		messagePlaceholder: text.placeholder,
		submitButtonLabel: text.submit,
		cancelButtonLabel: text.cancel,
		addScreenshotButtonLabel: text.add,
		captureScreenshotButtonLabel: text.take,
		removeScreenshotButtonLabel: text.remove,
		errorTitle: text.report,
		formError: text.error,
		genericError: text.error,
		captureScreenshotError: text.error,
		successMessageText: text.success,
	};
}

/**
 * Navigation and network breadcrumbs keep their shape without addresses'
 * query strings; console breadcrumbs keep the message but not its
 * arguments, which can hold player names or room codes.
 */
export function sanitizeBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
	if (breadcrumb.category === "console") {
		const { data: _data, ...rest } = breadcrumb;
		return rest;
	}
	if (!breadcrumb.data) return breadcrumb;
	const data = { ...breadcrumb.data };
	for (const key of ["url", "from", "to"]) {
		if (key in data) data[key] = stripQuery(data[key]);
	}
	return { ...breadcrumb, data };
}

/**
 * Errors and player feedback only: tracing, profiling, replay, sessions and
 * automatic screenshots are off because nothing here needs them and they
 * would cost quota.
 */
export function buildSentryOptions(config: {
	dsn: string;
	environment: SentryEnvironment;
}) {
	return {
		dsn: config.dsn,
		environment: config.environment,
		sendDefaultPii: false,
		attachStacktrace: true,
		maxBreadcrumbs: 30,
		enableAutoSessionTracking: false,
		enableAppStartTracking: false,
		enableNativeFramesTracking: false,
		enableStallTracking: false,
		enableAutoPerformanceTracing: false,
		attachScreenshot: false,
		attachViewHierarchy: false,
		// The JS scrubbers are the only place the policy is enforced.
		enableNdkScopeSync: false,
		initialScope: { tags: { app: "arcadeclub-mobile" } },
		beforeSend: (event: ErrorEvent) => sanitizeEvent(event),
		beforeBreadcrumb: (breadcrumb: Breadcrumb) =>
			sanitizeBreadcrumb(breadcrumb),
	};
}

/** A route as its file pattern (`/hitster/[sessionId]`), never with ids. */
export function routeName(segments: readonly string[]): string {
	return `/${segments.join("/")}`;
}
