/**
 * Clerk's configuration. The app cannot start without a publishable key.
 *
 * The dev-login prefill is gated on a `pk_test_` key, not `__DEV__`: a dev
 * build pointed at production must never offer it.
 */
import { env } from "../env";

const PUBLISHABLE_KEY = env.clerkPublishableKey;
const TEST_USER_EMAIL = env.testUserEmail;
const TEST_USER_PASSWORD = env.testUserPassword;

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
