/**
 * Public configuration read from the environment.
 *
 * **Static dot access is load-bearing.** Metro inlines `EXPO_PUBLIC_*` by
 * textually substituting `process.env.EXPO_PUBLIC_NAME` at build time; a
 * computed or destructured read is `undefined` in a release build.
 *
 * The dev-login prefill is gated on a `pk_test_` key, not `__DEV__`: a dev
 * build pointed at production must never offer it.
 */
const PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
const TEST_USER_EMAIL = process.env.EXPO_PUBLIC_TEST_USER_EMAIL;
const TEST_USER_PASSWORD = process.env.EXPO_PUBLIC_TEST_USER_PASSWORD;

if (!PUBLISHABLE_KEY) {
	throw new Error(
		"EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY is not set. Add it to apps/mobile/.env.local (see .env.example).",
	);
}

export const publishableKey: string = PUBLISHABLE_KEY;

/** Prefill for the sign-in form, or `null` when it must not exist. */
export const devLogin: { email: string; password: string } | null =
	PUBLISHABLE_KEY.startsWith("pk_test_") &&
	TEST_USER_EMAIL &&
	TEST_USER_PASSWORD
		? { email: TEST_USER_EMAIL, password: TEST_USER_PASSWORD }
		: null;
