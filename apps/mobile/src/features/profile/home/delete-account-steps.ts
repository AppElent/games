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
	type LiveClerk,
} from "@arcadeclub/core/account-deletion";
import { GameRuleError, gameErrorData } from "@arcadeclub/core/errors";
import { forgetAccountSaves } from "../../sudoku/saves/sudoku-save-store";

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
	signOut,
}: {
	clerk: Clerk;
	account: DeletingAccount;
	scope: DeletionScope;
	deleteBatch: AccountDeletionSteps["deleteBatch"];
	signOut: () => Promise<unknown>;
}): AccountDeletionSteps {
	const common = {
		confirmRecentSignIn: async () => {
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
	return {
		...common,
		scope,
		deleteUser: async () => {
			assertSameAccount(clerk, account);
			return clerk.user?.delete();
		},
	};
}

/** Refusals that a fresh sign-in, then deleting again, resolves (no session included). */
export function needsSignInAgain(error: unknown) {
	const code = gameErrorData(error)?.code;
	return (
		code === "accountSignInFirst" ||
		code === "accountSignInToFinish" ||
		code === "accountSessionEnded"
	);
}
