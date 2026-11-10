/**
 * Deleting the signed-in account: the Arcade Club data first, in batches until
 * the backend reports `done`, then the Clerk user, then the session. The Clerk
 * user is the shared Appelent account, so it goes last: a failure part way
 * leaves the account able to sign in and try again.
 */
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
		await run(async () => {
			let done = false;
			while (!done) {
				({ done } = await deleteMyData({ expectedSubject }));
			}
			await user.delete();
			await signOut();
		});
	}

	return {
		deleteAccount,
		busy,
		ready: backendAuth.ready,
		error,
		unavailable,
	};
}
