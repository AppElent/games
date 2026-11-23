/**
 * Deleting from the signed-in account, Arcade Club's data only or the whole
 * AppElent account; the steps and their order live in
 * `@arcadeclub/core/account-deletion`, shared with the web Account page.
 *
 * Clerk deletes an account only after a recent sign-in. Clerk's verify
 * dialog is web-only, so the app checks first and, when the sign-in is old,
 * stops before anything is deleted and offers `signInAgain`: the app's own
 * sign-in, with password autofill or an emailed code, gives a fresh one, and
 * the app returns to the delete screen afterwards.
 */
import {
	type DeletionScope,
	deleteAccount as runDeletion,
} from "@arcadeclub/core/account-deletion";
import { GameRuleError } from "@arcadeclub/core/errors";
import { useAuth, useClerk, useUser } from "@clerk/expo";
import { useMutation } from "convex/react";
import { useState } from "react";
import { signOutToReturn } from "../../../auth/return-target";
import { api } from "../../../convex/api";
import { useBackendAuthReady } from "../../sessions/use-backend-auth-ready";
import { useSessionAction } from "../../sessions/use-session-action";
import { deletionSteps, needsSignInAgain } from "./delete-account-steps";

export function useDeleteAccount() {
	const { user } = useUser();
	const clerk = useClerk();
	const { signOut } = useAuth();
	const backendAuth = useBackendAuthReady();
	const deleteMyData = useMutation(api.account.deleteMyData);
	const { run, busy, error, reset } = useSessionAction();
	/** The Clerk instance does not let users delete themselves. */
	const [unavailable, setUnavailable] = useState(false);

	/** Resolves true once the deletion is done and this phone signed out. */
	async function deleteAccount(scope: DeletionScope) {
		if (busy) return false;
		if (user && scope === "account" && !user.deleteSelfEnabled) {
			setUnavailable(true);
			return false;
		}
		setUnavailable(false);
		const sessionId = clerk.session?.id;
		if (!user || !sessionId) {
			// Nothing to delete with; a fresh sign-in starts one.
			await run(() => Promise.reject(new GameRuleError("accountSessionEnded")));
			return false;
		}
		const account = { userId: user.id, sessionId };
		return (
			(await run(() =>
				runDeletion(
					deletionSteps({
						clerk,
						account,
						scope,
						deleteBatch: () =>
							deleteMyData({ expectedSubject: account.userId }),
						signOut: () => signOut(),
					}),
				),
			)) === true
		);
	}

	return {
		deleteAccount,
		busy,
		/** Nobody is signed in: there is nothing to sign out of first. */
		signedOut: !user,
		/** Signed out counts: deleting then says so and offers the sign-in. */
		ready: backendAuth.ready || !backendAuth.isSignedIn,
		error,
		unavailable,
		/** The refusal asks for a fresh sign-in; offer `signInAgain`. */
		needsSignIn: needsSignInAgain(error),
		/**
		 * Signs out so the person can sign in again; deleting after that has a
		 * recent sign-in. The refusal goes, so it doesn't greet the new session.
		 */
		signInAgain: async () => {
			if (!user) return;
			reset();
			await signOutToReturn("/profile/delete-account", user.id, () =>
				signOut(),
			);
		},
	};
}
