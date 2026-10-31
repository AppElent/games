/**
 * What the phone sends to Sentry, as plain data so a test can run it
 * without the SDK. `init.ts` is the only caller that touches the SDK.
 * Policy: docs/runbooks/mobile.md#error-reporting.
 */
import type { Breadcrumb, ErrorEvent } from "@sentry/react-native";

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
 * Errors only: tracing, profiling, replay, sessions and screenshots are off
 * because nothing here needs them and they would cost quota.
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
