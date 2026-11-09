import { sanitizeBreadcrumb, sanitizeEvent } from "./privacy";

/** Public client configuration for the shared appelent/arcadeclub project. */
export const DEFAULT_SENTRY_DSN =
	"https://6aadd60de214ee0977243d34bc50a28a@o4504753234051072.ingest.us.sentry.io/4512351895552000";

const SENTRY_DATA_COLLECTION = {
	userInfo: false,
	cookies: false,
	httpHeaders: false,
	httpBodies: [],
	urlQueryParams: false,
	stackFrameVariables: false,
	databaseQueryData: false,
	queues: false,
	graphQL: { document: false, variables: false },
	genAI: { inputs: false, outputs: false },
} as const;

/**
 * The `Sentry.init` options the browser and the Worker share: no collected
 * personal data, redacted events and breadcrumbs, and no console capture.
 */
export const SHARED_SENTRY_OPTIONS = {
	// Spread so the SDK gets a mutable `httpBodies` array.
	dataCollection: { ...SENTRY_DATA_COLLECTION, httpBodies: [] },
	beforeSend: sanitizeEvent,
	beforeBreadcrumb: sanitizeBreadcrumb,
	integrations: <Integration extends { name: string }>(
		defaults: Integration[],
	) => defaults.filter((integration) => integration.name !== "Console"),
};

/** Production bundles also run in local Wrangler previews. */
export function isLocalSentryUrl(url: string): boolean {
	const hostname = new URL(url).hostname.toLowerCase();
	return (
		hostname === "localhost" ||
		hostname.endsWith(".localhost") ||
		hostname === "[::1]" ||
		hostname === "0.0.0.0" ||
		/^127\.\d+\.\d+\.\d+$/.test(hostname)
	);
}
