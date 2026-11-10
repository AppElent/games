import { v } from "convex/values";
import { mutation } from "./_generated/server";
import {
	ACTIVE_GAME_WINDOW_MINUTES,
	deleteAccountData,
	inActiveGame,
} from "./lib/accountDeletion";
import { requireUserId } from "./lib/auth";
import { gameError } from "./lib/errors";

/** Rows deleted or anonymised per call, well inside a mutation's limits. */
const DELETION_BATCH = 500;

/**
 * Deletes one batch of the signed-in account's data (see
 * `lib/accountDeletion.ts`). Clients repeat it until `done`, then delete the
 * Clerk user; an interrupted run resumes. `expectedSubject` is the account the
 * client means to delete, so an account switch mid-run deletes nothing.
 */
export const deleteMyData = mutation({
	args: { expectedSubject: v.string() },
	returns: v.object({ done: v.boolean() }),
	handler: async (ctx, { expectedSubject }) => {
		const userId = await requireUserId(ctx);
		if (userId !== expectedSubject) {
			throw gameError("accountChanged");
		}
		if (await inActiveGame(ctx, userId, Date.now())) {
			throw gameError("accountInActiveGame", {
				minutes: ACTIVE_GAME_WINDOW_MINUTES,
			});
		}
		return { done: await deleteAccountData(ctx, userId, DELETION_BATCH) };
	},
});
