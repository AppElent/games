/**
 * Deleting the signed-in account, the same on web and in the app: a recent
 * sign-in first, then the Arcade Club data, one batch of
 * `account.deleteMyData` at a time until the backend reports `done`, then the
 * Clerk user, then the session. The Clerk user is the shared Appelent
 * account, so it goes last: a failure part way (an active game, a dropped
 * connection) leaves the account able to sign in and run it again, and the
 * rerun resumes where the last one stopped.
 *
 * Clerk deletes a user only after a recent sign-in ("strict" reverification).
 * Checking it before the first batch keeps a stale session from deleting the
 * data and then failing on the account.
 */
import { GameRuleError } from "./errors";

export type AccountDeletionSteps = {
	/**
	 * Confirms a recent sign-in before anything is deleted. Resolves false
	 * when the person cancelled; throws a keyed error (such as
	 * `accountSignInFirst`) when the sign-in is too old.
	 */
	confirmRecentSignIn?: () => Promise<boolean>;
	/** One `deleteMyData` call for the account being deleted. */
	deleteBatch: () => Promise<{ done: boolean }>;
	/**
	 * Deletes the identity-provider (Clerk) user. Resolving or throwing
	 * Clerk's reverification refusal ends the run with `accountSignInToFinish`.
	 */
	deleteUser: () => Promise<unknown>;
	/**
	 * Ends the session. Best-effort: the account is already gone, and Clerk
	 * may have signed the client out with it, so a failure here is not a
	 * failed deletion.
	 */
	signOut: () => Promise<unknown>;
};

/** How recent the sign-in must be: half Clerk's 10-minute "strict" window, so it doesn't lapse while the data is deleted. */
export const RECENT_SIGN_IN = {
	level: "second_factor",
	afterMinutes: 5,
} as const;

/**
 * Clerk's reverification hint (`reverificationError("strict")` in
 * `@clerk/shared`). Returned from a `useReverification` fetcher, it opens
 * Clerk's verify dialog and then runs the fetcher again.
 */
export const NEEDS_RECENT_SIGN_IN = {
	clerk_error: {
		type: "forbidden",
		reason: "reverification-error",
		metadata: { reverification: "strict" },
	},
} as const;

/** The Clerk account and session the person confirmed the deletion in. */
export type DeletingAccount = { userId: string; sessionId: string };

/** The parts of Clerk's live client the sign-in check reads. */
export type LiveClerk = {
	readonly user?: { id: string } | null;
	readonly session?: {
		id: string;
		reload: () => Promise<unknown>;
		checkAuthorization: (params: {
			reverification: typeof RECENT_SIGN_IN;
		}) => boolean;
	} | null;
};

/** Throws `accountChanged` once another account or session is signed in. */
export function assertSameAccount(clerk: LiveClerk, account: DeletingAccount) {
	if (
		clerk.user?.id !== account.userId ||
		clerk.session?.id !== account.sessionId
	) {
		throw new GameRuleError("accountChanged");
	}
}

/**
 * Whether the session's sign-in is recent enough for Clerk to delete the
 * user. Reloads the session first: the sign-in age is only as fresh as the
 * last reload, so a long-open page or app could otherwise pass long after
 * the window. Checks the account before and after, since another tab can
 * sign in to another account meanwhile.
 */
export async function hasRecentSignIn(
	clerk: LiveClerk,
	account: DeletingAccount,
) {
	assertSameAccount(clerk, account);
	await clerk.session?.reload();
	assertSameAccount(clerk, account);
	return (
		clerk.session?.checkAuthorization({ reverification: RECENT_SIGN_IN }) ??
		false
	);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

const REFUSAL_CODES = new Set([
	// Clerk's API: this request needs a recent sign-in.
	"session_reverification_required",
	// `useReverification`: the person closed Clerk's verify dialog.
	"reverification_cancelled",
]);

/**
 * Whether Clerk refused for want of a recent sign-in: its reverification
 * hint, its API error, or a cancelled verify dialog.
 */
export function isRecentSignInRefusal(value: unknown, depth = 0): boolean {
	if (!isRecord(value) || depth > 4) return false;
	if (isRecord(value.clerk_error)) {
		return value.clerk_error.reason === "reverification-error";
	}
	if (typeof value.code === "string" && REFUSAL_CODES.has(value.code)) {
		return true;
	}
	return (
		Array.isArray(value.errors) &&
		value.errors.some((nested) => isRecentSignInRefusal(nested, depth + 1))
	);
}

/**
 * Runs the deletion. Resolves true once the account is gone, false when the
 * person cancelled the sign-in check (nothing was deleted).
 */
export async function deleteAccount({
	confirmRecentSignIn,
	deleteBatch,
	deleteUser,
	signOut,
}: AccountDeletionSteps): Promise<boolean> {
	if (confirmRecentSignIn && !(await confirmRecentSignIn())) return false;
	let done = false;
	while (!done) {
		({ done } = await deleteBatch());
	}
	// The window can still lapse during a long deletion; the data is gone by
	// now, so the person needs to know a fresh sign-in finishes it.
	let result: unknown;
	try {
		result = await deleteUser();
	} catch (caught) {
		if (isRecentSignInRefusal(caught)) {
			throw new GameRuleError("accountSignInToFinish");
		}
		throw caught;
	}
	if (isRecentSignInRefusal(result)) {
		throw new GameRuleError("accountSignInToFinish");
	}
	await signOut().catch(() => {});
	return true;
}
