/**
 * Deleting the signed-in account, the same on web and in the app: the Arcade
 * Club data first, one batch of `account.deleteMyData` at a time until the
 * backend reports `done`, then the Clerk user, then the session. The Clerk
 * user is the shared Appelent account, so it goes last: a failure part way
 * (an active game, a dropped connection) leaves the account able to sign in
 * and run it again, and the rerun resumes where the last one stopped.
 */
export type AccountDeletionSteps = {
	/** One `deleteMyData` call for the account being deleted. */
	deleteBatch: () => Promise<{ done: boolean }>;
	/** Deletes the identity-provider (Clerk) user. */
	deleteUser: () => Promise<unknown>;
	/**
	 * Ends the session. Best-effort: the account is already gone, and Clerk
	 * may have signed the client out with it, so a failure here is not a
	 * failed deletion.
	 */
	signOut: () => Promise<unknown>;
};

export async function deleteAccount({
	deleteBatch,
	deleteUser,
	signOut,
}: AccountDeletionSteps) {
	let done = false;
	while (!done) {
		({ done } = await deleteBatch());
	}
	await deleteUser();
	await signOut().catch(() => {});
}
