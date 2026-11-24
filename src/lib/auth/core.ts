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

/** The sign-in, sign-up and reset pages: never a page to return to. */
export const AUTH_PAGE_PATHS: readonly string[] = [
	"/sign-in",
	"/sign-up",
	"/forgot-password",
];

/** Compared the way the router matches: decoded, any case, any end slash. */
function isAuthPage(path: string): boolean {
	let pathname = path.split(/[?#]/, 1)[0];
	try {
		pathname = decodeURIComponent(pathname);
	} catch {}
	pathname = pathname.toLowerCase().replace(/\/+$/, "") || "/";
	return AUTH_PAGE_PATHS.includes(pathname);
}

/** The checked return path, unless it is itself an auth page. */
function returnPath(value: unknown): string | undefined {
	const path = safeReturnPath(value);
	return path && !isAuthPage(path) ? path : undefined;
}

/**
 * Where sign-in goes next: the checked return path, else `fallback`. An
 * auth page counts as no return path, so a finished sign-in never lands
 * back on a sign-in form.
 */
export function signInDestination(redirect: unknown, fallback: string): string {
	return returnPath(redirect) ?? fallback;
}

/**
 * A link to an auth page (`authPath`) that brings the visitor back to
 * `returnTo` afterwards: `/sign-in?redirect=%2Fsudoku`. Without a usable
 * return path, the bare page.
 */
export function authPageHref(authPath: string, returnTo: unknown): string {
	const path = returnPath(returnTo);
	return path ? `${authPath}?redirect=${encodeURIComponent(path)}` : authPath;
}

/**
 * The page a link on `here` should return to: `here` itself, or, on an
 * auth page, the `redirect` that page already carries.
 */
export function returnTarget(here: string): string | undefined {
	const path = safeReturnPath(here);
	if (!path) return undefined;
	if (!isAuthPage(path)) return path;
	const url = new URL(path, "https://return.invalid");
	return returnPath(url.searchParams.get("redirect"));
}
