import { ConvexError } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type Ctx = MutationCtx | QueryCtx;

export async function getOptionalUserId(ctx: Ctx) {
	const identity = await ctx.auth.getUserIdentity();
	return identity?.subject;
}

export async function requireUserId(ctx: Ctx) {
	const userId = await getOptionalUserId(ctx);
	if (!userId) {
		throw new ConvexError("Sign in required");
	}
	return userId;
}
