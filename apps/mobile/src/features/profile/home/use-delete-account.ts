/**
 * Deleting the signed-in account; the steps and their order live in
 * `@arcadeclub/core/account-deletion`, shared with the web Account page.
 */
import { deleteAccount as runDeletion } from "@arcadeclub/core/account-deletion";
import { useAuth, useUser } from "@clerk/expo";
import { useMutation } from "convex/react";
import { useState } from "react";
import { api } from "../../../convex/api";
import { useBackendAuthReady } from "../../sessions/use-backend-auth-ready";
import { useSessionAction } from "../../sessions/use-session-action";

export function useDeleteAccount() {
	const { user } = useUser();
	const { signOut } = useAuth();
	const backendAuth = useBackendAuthReady();
	const deleteMyData = useMutation(api.account.deleteMyData);
	const { run, busy, error } = useSessionAction();
	/** The Clerk instance does not let users delete themselves. */
	const [unavailable, setUnavailable] = useState(false);

	async function deleteAccount() {
		if (!user || busy) return;
		if (!user.deleteSelfEnabled) {
			setUnavailable(true);
			return;
		}
		setUnavailable(false);
		const expectedSubject = user.id;
		await run(() =>
			runDeletion({
				deleteBatch: () => deleteMyData({ expectedSubject }),
				deleteUser: () => user.delete(),
				signOut: () => signOut(),
			}),
		);
	}

	return {
		deleteAccount,
		busy,
		ready: backendAuth.ready,
		error,
		unavailable,
	};
}
