import {
	assertSameAccount,
	type DeletingAccount,
	type DeletionScope,
	hasRecentSignIn,
	NEEDS_RECENT_SIGN_IN,
	deleteAccount as runDeletion,
} from "@arcadeclub/core/account-deletion";
import { GameRuleError, gameErrorData } from "@arcadeclub/core/errors";
import { useClerk, useReverification, useUser } from "@clerk/react";
import { isReverificationCancelledError } from "@clerk/react/errors";
import { useNavigate } from "@tanstack/react-router";
import { useConvexAuth, useMutation } from "convex/react";
import { useState } from "react";
import { useErrorMessage } from "#/lib/games/errors";
import { useGameAction } from "#/lib/games/use-game-action";
import { useMessages } from "#/lib/i18n";
import { api } from "../../../convex/_generated/api";

/**
 * "Delete account" on the Account page, the same steps as the app's Profile
 * (`@arcadeclub/core/account-deletion`): Arcade Club's data only, or the
 * whole AppElent account. Both need a recent sign-in, so an old one opens
 * Clerk's verify dialog (password or code) before anything is deleted. A
 * refusal (an active game, an account switch, a sign-in Clerk still finds too
 * old, a session that ended) or an interrupted run lands in `error`, localized; running it again
 * resumes. Closing Clerk's dialog stops quietly. `deleteAccount` resolves
 * true once it is done, and the player lands on the home page rather than the
 * sign-in redirect that `RequireSignedIn` starts when the session ends; after
 * deleting only the data, the home page says the login still works elsewhere.
 */
export function useDeleteAccount() {
	const { user } = useUser();
	const clerk = useClerk();
	const { isAuthenticated } = useConvexAuth();
	const navigate = useNavigate();
	const deleteMyData = useMutation(api.account.deleteMyData);
	const copy = useMessages().profile.deleteAccount;
	const errorMessage = useErrorMessage();
	const { error, setError, run } = useGameAction();
	const [busy, setBusy] = useState(false);

	// Clerk runs these again after its verify dialog; both re-check the live
	// account each time.
	const checkSignIn = useReverification(async (account: DeletingAccount) =>
		(await hasRecentSignIn(clerk, account)) ? true : NEEDS_RECENT_SIGN_IN,
	);
	const deleteUser = useReverification(async (account: DeletingAccount) => {
		assertSameAccount(clerk, account);
		return clerk.user?.delete();
	});

	async function confirmRecentSignIn(account: DeletingAccount) {
		try {
			// Clerk returns its retry as is: anything but `true` is still old.
			if ((await checkSignIn(account)) === true) return true;
		} catch (caught) {
			if (isReverificationCancelledError(caught)) return false;
			throw caught;
		}
		throw new GameRuleError("accountSignInFirst");
	}

	async function deleteAccount(scope: DeletionScope) {
		if (!user || busy) return false;
		if (scope === "account" && !user.deleteSelfEnabled) {
			setError(copy.unavailable);
			return false;
		}
		const sessionId = clerk.session?.id;
		if (!sessionId) {
			setError(
				errorMessage(new GameRuleError("accountSessionEnded"), copy.failed),
			);
			return false;
		}
		const account = { userId: user.id, sessionId };
		setBusy(true);
		try {
			let deleted = false;
			const landing = scope === "app" ? "/?deleted=app" : "/";
			const common = {
				confirmRecentSignIn: () => confirmRecentSignIn(account),
				deleteBatch: () => deleteMyData({ expectedSubject: account.userId }),
				signOut: () => clerk.signOut({ redirectUrl: landing }),
			};
			await run(async () => {
				try {
					deleted = await runDeletion(
						scope === "app"
							? { ...common, scope }
							: { ...common, scope, deleteUser: () => deleteUser(account) },
					);
				} catch (caught) {
					// Clerk's dialog opens again on the next delete, so pressing
					// delete is all it takes; the shared copy says to sign in.
					throw gameErrorData(caught)?.code === "accountSignInToFinish"
						? new GameRuleError("accountDeleteAgain")
						: caught;
				}
			}, copy.failed);
			if (deleted) {
				await navigate({
					to: "/",
					search: scope === "app" ? { deleted: "app" } : {},
					replace: true,
				});
			}
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
