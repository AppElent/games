import { deleteAccount as runDeletion } from "@arcadeclub/core/account-deletion";
import { useClerk, useUser } from "@clerk/react";
import { useConvexAuth, useMutation } from "convex/react";
import { useState } from "react";
import { useGameAction } from "#/lib/games/use-game-action";
import { useMessages } from "#/lib/i18n";
import { api } from "../../../convex/_generated/api";

/**
 * "Delete account" on the Account page, the same steps as the app's Profile
 * (`@arcadeclub/core/account-deletion`). A refusal (an active game, an account
 * switch) or an interrupted run lands in `error`, localized; running it again
 * resumes. `deleteAccount` resolves true once the account is gone.
 */
export function useDeleteAccount() {
	const { user } = useUser();
	const { signOut } = useClerk();
	const { isAuthenticated } = useConvexAuth();
	const deleteMyData = useMutation(api.account.deleteMyData);
	const copy = useMessages().profile.deleteAccount;
	const { error, setError, run } = useGameAction();
	const [busy, setBusy] = useState(false);

	async function deleteAccount() {
		if (!user || busy) return false;
		if (!user.deleteSelfEnabled) {
			setError(copy.unavailable);
			return false;
		}
		const expectedSubject = user.id;
		setBusy(true);
		try {
			return await run(
				() =>
					runDeletion({
						deleteBatch: () => deleteMyData({ expectedSubject }),
						deleteUser: () => user.delete(),
						signOut: () => signOut({ redirectUrl: "/" }),
					}),
				copy.failed,
			);
		} finally {
			setBusy(false);
		}
	}

	return {
		deleteAccount,
		busy,
		/** Convex has the session, so the batches run as this account. */
		ready: Boolean(user) && isAuthenticated,
		error,
		clearError: () => setError(""),
	};
}
