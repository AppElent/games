import type { GameErrorCode } from "@arcadeclub/core/errors";
import { gameError } from "./errors";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type Ctx = MutationCtx | QueryCtx;

export async function getOptionalUserId(ctx: Ctx) {
	const identity = await ctx.auth.getUserIdentity();
	return identity?.subject;
}

export async function requireUserId(ctx: Ctx) {
	const userId = await getOptionalUserId(ctx);
	if (!userId) {
		throw gameError("signInRequired");
	}
	return userId;
}

/** A row this user owns. Someone else's looks exactly like a missing one. */
export function requireOwned<Row extends { ownerUserId?: string }>(
	row: Row | null,
	ownerUserId: string,
	notFound: GameErrorCode,
) {
	if (!row || row.ownerUserId !== ownerUserId) {
		throw gameError(notFound);
	}
	return row;
}
