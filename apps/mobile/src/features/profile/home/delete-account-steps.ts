/**
 * The app's deletion steps for `@arcadeclub/core/account-deletion`, apart
 * from `useDeleteAccount` so they run in tests without the native modules.
 */
import {
	type AccountDeletionSteps,
	assertSameAccount,
	type DeletingAccount,
	type DeletionScope,
	hasRecentSignIn,
	isRecentSignInRefusal,
	type LiveClerk,
} from "@arcadeclub/core/account-deletion";
import { GameRuleError, gameErrorData } from "@arcadeclub/core/errors";
import { reportError } from "../../../observability/report";
import { forgetAccountSaves } from "../../sudoku/saves/sudoku-save-store";
import type { ReverifyOutcome } from "../reverify/use-reverify";

type Clerk = LiveClerk & {
	readonly user?: { id: string; delete: () => Promise<unknown> } | null;
};

/**
 * This phone's deletion steps for `account`: Arcade Club's data only
 * (`app`, the login stays) or the whole AppElent account.
 */
export function deletionSteps({
	clerk,
	account,
	scope,
	deleteBatch,
	reverify,
	signOut,
}: {
	clerk: Clerk;
	account: DeletingAccount;
	scope: DeletionScope;
	deleteBatch: AccountDeletionSteps["deleteBatch"];
	/** Asks the person to confirm it's them, in the sheet. */
	reverify: () => Promise<ReverifyOutcome>;
	signOut: () => Promise<unknown>;
}): AccountDeletionSteps {
	const common = {
		confirmRecentSignIn: async () => {
			if (await hasRecentSignIn(clerk, account)) return true;
			const outcome = await reverify();
			if (outcome === "cancelled") return false;
			if (outcome === "unsupported") {
				throw new GameRuleError("accountVerifyUnsupported");
			}
			if (outcome === "noSecondFactor") {
				// Signing in again needs the same step, so it isn't offered.
				throw new GameRuleError("accountSecondFactorUnsupported");
			}
			if (await hasRecentSignIn(clerk, account)) return true;
			throw new GameRuleError("accountSignInFirst");
		},
		deleteBatch,
		signOut: async () => {
			// The account's puzzles are gone from the server; its copies on
			// this phone go with them.
			forgetAccountSaves(account.userId);
			await signOut();
		},
	};
	if (scope === "app") return { ...common, scope };
	const deleteUser = async () => {
		assertSameAccount(clerk, account);
		return clerk.user?.delete();
	};
	return {
		...common,
		scope,
		deleteUser: async () => {
			try {
				return await deleteUser();
			} catch (caught) {
				// The sign-in aged past Clerk's window while the data went.
				if (!isRecentSignInRefusal(caught)) throw caught;
				// The data is gone, so whatever stops the sheet (offline, say) must
				// not read as "nothing was deleted".
				const outcome = await reverify().catch((failure) => {
					if (gameErrorData(failure)) throw onceDataIsGone(failure);
					reportError(failure);
					return "cancelled" as const;
				});
				// Without a second step the app can do, signing in again would
				// only lock the person out, and deleting again would meet the same
				// wall: say who can finish it.
				if (outcome === "noSecondFactor") {
					throw new GameRuleError("accountSecondFactorToFinish");
				}
				if (outcome === "cancelled")
					throw new GameRuleError("accountDeleteAgain");
				if (outcome === "unsupported") throw caught;
			}
			return deleteUser();
		},
	};
}

/** `failure` once the data is deleted: signing in again then finishes it. */
export function onceDataIsGone(failure: unknown): unknown {
	const code = gameErrorData(failure)?.code;
	return code === "accountSignInFirst" || code === "accountSessionEnded"
		? new GameRuleError("accountSignInToFinish")
		: failure;
}

/** Refusals that a fresh sign-in, then deleting again, resolves (no session included). */
export function needsSignInAgain(error: unknown) {
	const code = gameErrorData(error)?.code;
	return (
		code === "accountSignInFirst" ||
		code === "accountVerifyUnsupported" ||
		code === "accountSignInToFinish" ||
		code === "accountSessionEnded"
	);
}
