import { deleteAccount as runDeletion } from "@arcadeclub/core/account-deletion";
import { useClerk, useUser } from "@clerk/react";
import { useNavigate } from "@tanstack/react-router";
import { useConvexAuth, useMutation } from "convex/react";
import { useState } from "react";
import { useGameAction } from "#/lib/games/use-game-action";
import { useMessages } from "#/lib/i18n";
import { api } from "../../../convex/_generated/api";

/**
 * "Delete account" on the Account page, the same steps as the app's Profile
 * (`@arcadeclub/core/account-deletion`). A refusal (an active game, an account
 * switch) or an interrupted run lands in `error`, localized; running it again
 * resumes. `deleteAccount` resolves true once the account is gone, and the
 * player lands on the home page rather than the sign-in redirect that
 * `RequireSignedIn` starts when the session ends.
 */
export function useDeleteAccount() {
	const { user } = useUser();
	const { signOut } = useClerk();
	const { isAuthenticated } = useConvexAuth();
	const navigate = useNavigate();
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
			const deleted = await run(
				() =>
					runDeletion({
						deleteBatch: () => deleteMyData({ expectedSubject }),
						deleteUser: () => user.delete(),
						signOut: () => signOut({ redirectUrl: "/" }),
					}),
				copy.failed,
			);
			if (deleted) await navigate({ to: "/", replace: true });
			return deleted;
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
