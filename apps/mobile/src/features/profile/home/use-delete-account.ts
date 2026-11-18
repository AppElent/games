/**
 * Deleting the signed-in account; the steps and their order live in
 * `@arcadeclub/core/account-deletion`, shared with the web Account page.
 *
 * Clerk deletes an account only after a recent sign-in. Clerk's verify
 * dialog is web-only, so the app checks first and, when the sign-in is old,
 * stops before anything is deleted and offers `signInAgain`: the app's own
 * sign-in, with password autofill or an emailed code, gives a fresh one.
 */
import { deleteAccount as runDeletion } from "@arcadeclub/core/account-deletion";
import { useAuth, useClerk, useUser } from "@clerk/expo";
import { useMutation } from "convex/react";
import { useState } from "react";
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

	async function deleteAccount() {
		if (!user || busy) return;
		if (!user.deleteSelfEnabled) {
			setUnavailable(true);
			return;
		}
		setUnavailable(false);
		const sessionId = clerk.session?.id;
		if (!sessionId) return;
		const account = { userId: user.id, sessionId };
		await run(() =>
			runDeletion(
				deletionSteps({
					clerk,
					account,
					deleteBatch: () => deleteMyData({ expectedSubject: account.userId }),
					signOut: () => signOut(),
				}),
			),
		);
	}

	return {
		deleteAccount,
		busy,
		ready: backendAuth.ready,
		error,
		unavailable,
		/** The refusal asks for a fresh sign-in; offer `signInAgain`. */
		needsSignIn: needsSignInAgain(error),
		/**
		 * Signs out so the person can sign in again; deleting after that has a
		 * recent sign-in. The refusal goes, so it doesn't greet the new session.
		 */
		signInAgain: async () => {
			reset();
			await signOut();
		},
	};
}
