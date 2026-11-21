/**
 * Where the app goes once a fresh sign-in finishes. Signing out and in again
 * rebuilds the whole navigation tree (`ScopedQueryCache` keys it on the
 * user), so the screen that asked for the sign-in is gone and the app starts
 * on Play. A screen that sends the person to sign in again, such as the
 * delete screen, names where to return; the root navigator takes it once the
 * same account is signed in.
 *
 * It lives in module state, which survives the rebuild. It only ever holds an
 * in-app route chosen by code, never a link from outside, and it lapses: a
 * sign-in the person walked away from must not send them somewhere later.
 */
import type { Href } from "expo-router";

const LAPSES_AFTER_MS = 10 * 60 * 1000;

let pending: { href: Href; userId: string; lapsesAt: number } | null = null;

/** Return to `href` after `userId` signs in again. */
export function returnAfterSignIn(href: Href, userId: string) {
	pending = { href, userId, lapsesAt: Date.now() + LAPSES_AFTER_MS };
}

/** The person closed the sign-in without signing in. */
export function forgetReturnTarget() {
	pending = null;
}

/**
 * The route to return to, once: `null` for another account or after it
 * lapsed. A target is spent by the first signed-in user, whoever that is.
 */
export function takeReturnTarget(userId: string): Href | null {
	const target = pending;
	pending = null;
	if (!target || target.userId !== userId || Date.now() > target.lapsesAt) {
		return null;
	}
	return target.href;
}
