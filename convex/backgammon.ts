import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const createState = mutation({
	args: {
		sessionId: v.id("gameSessions"),
		hostParticipantId: v.id("sessionParticipants"),
	},
	handler: async (ctx, args) => {
		const session = await ctx.db.get(args.sessionId);
		if (!session || session.gameType !== "backgammon") {
			throw new Error("Backgammon session not found");
		}
		const existing = await ctx.db
			.query("backgammonStates")
			.withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
			.unique();
		if (existing) {
			return existing._id;
		}
		await ctx.db.patch(args.hostParticipantId, { seat: "white" });
		return await ctx.db.insert("backgammonStates", {
			sessionId: args.sessionId,
			phase: "waiting",
			whiteParticipantId: args.hostParticipantId,
			moveLog: ["Challenge created"],
		});
	},
});

export const getBundle = query({
	args: { sessionId: v.id("gameSessions") },
	handler: async (ctx, args) => {
		const session = await ctx.db.get(args.sessionId);
		if (!session) {
			return null;
		}
		const participants = await ctx.db
			.query("sessionParticipants")
			.withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
			.collect();
		const state = await ctx.db
			.query("backgammonStates")
			.withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
			.unique();
		return { session, participants, state };
	},
});
