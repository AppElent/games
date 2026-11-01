/** Public client configuration for the shared appelent/arcadeclub project. */
export const DEFAULT_SENTRY_DSN =
	"https://6aadd60de214ee0977243d34bc50a28a@o4504753234051072.ingest.us.sentry.io/4512351895552000";

export const SENTRY_DATA_COLLECTION = {
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
