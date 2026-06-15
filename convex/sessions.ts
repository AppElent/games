import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
	authPolicyValidator,
	gameTypeValidator,
	joinModeValidator,
} from "./schema";
import { getOptionalUserId, requireUserId } from "./lib/auth";
import { makeJoinCode, makeShareToken } from "./lib/codes";

export const create = mutation({
	args: {
		gameType: gameTypeValidator,
		joinMode: joinModeValidator,
		authPolicy: authPolicyValidator,
		title: v.string(),
		displayName: v.string(),
		guestId: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const userId = await getOptionalUserId(ctx);
		if (args.authPolicy === "signedInRequired" && !userId) {
			throw new Error("Sign in required to create this game");
		}

		let joinCode: string | undefined;
		if (args.joinMode === "room") {
			for (let attempt = 0; attempt < 8; attempt += 1) {
				const candidate = makeJoinCode();
				const existing = await ctx.db
					.query("gameSessions")
					.withIndex("by_joinCode", (q) => q.eq("joinCode", candidate))
					.unique();
				if (!existing) {
					joinCode = candidate;
					break;
				}
			}
			if (!joinCode) {
				throw new Error("Could not create a join code");
			}
		}

		const sessionId = await ctx.db.insert("gameSessions", {
			gameType: args.gameType,
			status: "lobby",
			joinMode: args.joinMode,
			authPolicy: args.authPolicy,
			title: args.title,
			hostUserId: userId,
			joinCode,
			shareToken: args.joinMode === "challenge" ? makeShareToken() : undefined,
		});

		const participantId = await ctx.db.insert("sessionParticipants", {
			sessionId,
			userId,
			guestId: userId ? undefined : args.guestId,
			displayName: args.displayName,
			role: "host",
			seat: "host",
			connected: true,
			lastSeen: Date.now(),
		});

		await ctx.db.patch(sessionId, { hostParticipantId: participantId });

		return { sessionId, participantId, joinCode };
	},
});

export const joinByCode = mutation({
	args: {
		joinCode: v.string(),
		displayName: v.string(),
		guestId: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const normalized = args.joinCode.replace(/[^a-z0-9]/gi, "").toUpperCase();
		const session = await ctx.db
			.query("gameSessions")
			.withIndex("by_joinCode", (q) => q.eq("joinCode", normalized))
			.unique();
		if (
			!session ||
			session.status === "completed" ||
			session.status === "cancelled"
		) {
			throw new Error("Game is unavailable");
		}
		const userId = await getOptionalUserId(ctx);
		if (session.authPolicy === "signedInRequired" && !userId) {
			throw new Error("Sign in required to join this game");
		}

		const participantId = await ctx.db.insert("sessionParticipants", {
			sessionId: session._id,
			userId,
			guestId: userId ? undefined : args.guestId,
			displayName: args.displayName,
			role: "player",
			connected: true,
			lastSeen: Date.now(),
		});

		return { sessionId: session._id, participantId, gameType: session.gameType };
	},
});

export const joinByToken = mutation({
	args: {
		shareToken: v.string(),
		displayName: v.string(),
		guestId: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const session = await ctx.db
			.query("gameSessions")
			.withIndex("by_shareToken", (q) => q.eq("shareToken", args.shareToken))
			.unique();
		if (
			!session ||
			session.status === "completed" ||
			session.status === "cancelled"
		) {
			throw new Error("Game is unavailable");
		}
		const userId = await getOptionalUserId(ctx);
		if (session.authPolicy === "signedInRequired" && !userId) {
			throw new Error("Sign in required to join this game");
		}

		const existingByUser = userId
			? await ctx.db
					.query("sessionParticipants")
					.withIndex("by_user", (q) => q.eq("userId", userId))
					.collect()
			: [];
		const existingByGuest =
			!userId && args.guestId
				? await ctx.db
						.query("sessionParticipants")
						.withIndex("by_guest", (q) => q.eq("guestId", args.guestId))
						.collect()
				: [];
		const existing = [...existingByUser, ...existingByGuest].find(
			(participant) => participant.sessionId === session._id,
		);

		const participantId =
			existing?._id ??
			(await ctx.db.insert("sessionParticipants", {
				sessionId: session._id,
				userId,
				guestId: userId ? undefined : args.guestId,
				displayName: args.displayName,
				role: "player",
				connected: true,
				lastSeen: Date.now(),
			}));

		if (existing) {
			await ctx.db.patch(existing._id, {
				connected: true,
				lastSeen: Date.now(),
			});
		}

		if (session.gameType === "backgammon") {
			const state = await ctx.db
				.query("backgammonStates")
				.withIndex("by_session", (q) => q.eq("sessionId", session._id))
				.unique();
			if (state) {
				if (
					state.blackParticipantId &&
					state.blackParticipantId !== participantId
				) {
					throw new Error("This challenge already has an opponent");
				}
				if (state.whiteParticipantId === participantId) {
					await ctx.db.patch(participantId, { seat: "white" });
				} else {
					await ctx.db.patch(participantId, { seat: "black" });
					await ctx.db.patch(state._id, {
						blackParticipantId: participantId,
						phase: "ready",
					});
				}
			}
		}

		return { sessionId: session._id, participantId, gameType: session.gameType };
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
		return { session, participants };
	},
});

export const listMine = query({
	args: {},
	handler: async (ctx) => {
		const userId = await requireUserId(ctx);
		return await ctx.db
			.query("gameSessions")
			.withIndex("by_hostUser", (q) => q.eq("hostUserId", userId))
			.order("desc")
			.take(20);
	},
});

export const heartbeat = mutation({
	args: { participantId: v.id("sessionParticipants") },
	handler: async (ctx, args) => {
		const participant = await ctx.db.get(args.participantId);
		if (!participant) {
			throw new Error("Participant not found");
		}
		await ctx.db.patch(args.participantId, {
			connected: true,
			lastSeen: Date.now(),
		});
	},
});
