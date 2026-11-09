/**
 * Public configuration, and the only module that reads `process.env`.
 *
 * **Static dot access is load-bearing.** Metro inlines `EXPO_PUBLIC_*` by
 * textually substituting `process.env.EXPO_PUBLIC_NAME` at build time; a
 * computed or destructured read is `undefined` in a release build. Each
 * value is read once, when this module loads; the modules that need one
 * decide whether its absence is an error.
 */
export const env = {
	clerkPublishableKey: process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY,
	convexUrl: process.env.EXPO_PUBLIC_CONVEX_URL,
	sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
	/** `"1"` reports from a development bundle too. */
	sentryDebug: process.env.EXPO_PUBLIC_SENTRY_DEBUG,
	/** The web app invites link to; without it invites carry the code alone. */
	webOrigin: process.env.EXPO_PUBLIC_WEB_ORIGIN,
	/** Sign-in prefill, offered only with a `pk_test_` key. */
	testUserEmail: process.env.EXPO_PUBLIC_TEST_USER_EMAIL,
	testUserPassword: process.env.EXPO_PUBLIC_TEST_USER_PASSWORD,
};
