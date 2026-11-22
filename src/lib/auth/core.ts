// DOM-free auth helpers: no React, no browser globals, no styling deps.

export interface TestLoginEnv {
	VITE_CLERK_PUBLISHABLE_KEY?: string;
	VITE_TEST_USER_EMAIL?: string;
	VITE_TEST_USER_PASSWORD?: string;
}

/**
 * Show the dev test-login button only on a Clerk *test* instance with the
 * test-user credentials provided via env. Both conditions must hold, so the
 * button can never appear in production (pk_live_ + no creds in the bundle).
 *
 * Takes a plain env object instead of reading `import.meta.env`, so tests
 * can pass their own.
 */
export function shouldShowTestLogin(env: TestLoginEnv): boolean {
	const onTestInstance =
		!!env.VITE_CLERK_PUBLISHABLE_KEY?.startsWith("pk_test_");
	const hasCreds = !!env.VITE_TEST_USER_EMAIL && !!env.VITE_TEST_USER_PASSWORD;
	return onTestInstance && hasCreds;
}

interface ClerkLikeError {
	errors?: { longMessage?: string; message?: string }[];
}

/** Extract a readable message from a thrown Clerk error (or any error). */
export function clerkErrorMessage(
	err: unknown,
	fallback = "Something went wrong.",
): string {
	const e = err as ClerkLikeError;
	const first = e?.errors?.[0];
	return first?.longMessage ?? first?.message ?? fallback;
}

/**
 * The in-app path to return to after sign-in, or `undefined` for anything
 * that could leave the site. Resolved against a placeholder origin, so
 * `//host`, `/\host` and tricks like `/.//host` count by where a browser
 * would go, not by how the string starts.
 */
export function safeReturnPath(value: unknown): string | undefined {
	if (typeof value !== "string" || !value.startsWith("/")) return undefined;
	// biome-ignore lint/suspicious/noControlCharactersInRegex: rejecting them is the point.
	if (/[\u0000-\u001f\u007f\\]/.test(value)) return undefined;
	const base = "https://return.invalid";
	let url: URL;
	try {
		url = new URL(value, base);
	} catch {
		return undefined;
	}
	if (url.origin !== base || url.pathname.startsWith("//")) return undefined;
	return `${url.pathname}${url.search}${url.hash}`;
}

/** Where sign-in goes next: the checked return path, else `fallback`. */
export function signInDestination(redirect: unknown, fallback: string): string {
	return safeReturnPath(redirect) ?? fallback;
}
