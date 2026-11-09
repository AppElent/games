import { MAX_TITLE_LENGTH } from "@arcadeclub/core/sessions";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
	authPolicyValidator,
	gameTypeValidator,
	joinModeValidator,
} from "./schema";
import { requireUserId } from "./lib/auth";
import { gameError } from "./lib/errors";
import {
	kickParticipant as kick,
	listParticipants,
	markConnected,
	requireHostByIdentity,
} from "./lib/gameSession";
import { createHostedSession } from "./lib/hostedSession";
import { findOpenSession, joinSession } from "./lib/join";

// Installed mobile builds call this: remove once no installed build predates backgammon.create and hitster.create.
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
		// A card table needs its host's seat secret from the first moment, so
		// only `cardGames.createTable` creates one.
		if (args.gameType === "card-games") {
			throw gameError("gameUnavailable");
		}
		const { session, participantId } = await createHostedSession(ctx, args);
		return { sessionId: session._id, participantId, joinCode: session.joinCode };
	},
});

/**
 * The game behind an invite, without joining it, so a client can turn away a
 * game it cannot play before claiming a seat. Null when the invite is not open.
 */
export const inviteGameType = query({
	args: {
		joinCode: v.optional(v.string()),
		shareToken: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const session = await findOpenSession(ctx, args);
		return session ? session.gameType : null;
	},
});

export const joinByCode = mutation({
	args: {
		joinCode: v.string(),
		displayName: v.string(),
		guestId: v.optional(v.string()),
		asSpectator: v.optional(v.boolean()),
		seatSecret: v.optional(v.string()),
	},
	handler: async (ctx, { joinCode, ...args }) =>
		await joinSession(ctx, { joinCode }, args),
});

export const joinByToken = mutation({
	args: {
		shareToken: v.string(),
		displayName: v.string(),
		guestId: v.optional(v.string()),
		asSpectator: v.optional(v.boolean()),
	},
	handler: async (ctx, { shareToken, ...args }) =>
		await joinSession(ctx, { shareToken }, args),
});

export const getBundle = query({
	args: { sessionId: v.id("gameSessions") },
	handler: async (ctx, args) => {
		const session = await ctx.db.get(args.sessionId);
		if (!session) {
			return null;
		}
		const participants = await listParticipants(ctx, args.sessionId);
		return { session, participants };
	},
});

/**
 * Every session the signed-in user has participated in (hosted or joined),
 * newest first, with the caller's own participant row attached.
 */
export const listParticipation = query({
	args: {},
	handler: async (ctx) => {
		const userId = await requireUserId(ctx);
		const participations = await ctx.db
			.query("sessionParticipants")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.collect();
		const rows = [];
		for (const participant of participations.slice(-100)) {
			const session = await ctx.db.get(participant.sessionId);
			if (session) {
				rows.push({ session, participant });
			}
		}
		rows.sort((a, b) => b.session._creationTime - a.session._creationTime);
		return rows;
	},
});

export const heartbeat = mutation({
	args: { participantId: v.id("sessionParticipants") },
	handler: async (ctx, args) => {
		const participant = await ctx.db.get(args.participantId);
		if (!participant) {
			throw gameError("participantNotFound");
		}
		await markConnected(ctx, args.participantId);
	},
});

export const kickParticipant = mutation({
	args: {
		sessionId: v.id("gameSessions"),
		hostParticipantId: v.id("sessionParticipants"),
		targetParticipantId: v.id("sessionParticipants"),
	},
	handler: async (ctx, args) => {
		await requireHostByIdentity(ctx, args.sessionId, args.hostParticipantId);
		if (args.targetParticipantId === args.hostParticipantId) {
			throw gameError("hostCannotKickSelf");
		}
		const target = await ctx.db.get(args.targetParticipantId);
		if (!target || target.sessionId !== args.sessionId) {
			throw gameError("participantNotFound");
		}
		await kick(ctx, args.targetParticipantId);
	},
});

export const setLocked = mutation({
	args: {
		sessionId: v.id("gameSessions"),
		hostParticipantId: v.id("sessionParticipants"),
		locked: v.boolean(),
	},
	handler: async (ctx, args) => {
		await requireHostByIdentity(ctx, args.sessionId, args.hostParticipantId);
		await ctx.db.patch(args.sessionId, { locked: args.locked });
	},
});

export const rename = mutation({
	args: {
		sessionId: v.id("gameSessions"),
		hostParticipantId: v.id("sessionParticipants"),
		title: v.string(),
	},
	handler: async (ctx, args) => {
		await requireHostByIdentity(ctx, args.sessionId, args.hostParticipantId);
		const title = args.title.trim();
		if (!title || title.length > MAX_TITLE_LENGTH) {
			throw gameError("titleLength");
		}
		await ctx.db.patch(args.sessionId, { title });
	},
});

export const transferHost = mutation({
	args: {
		sessionId: v.id("gameSessions"),
		hostParticipantId: v.id("sessionParticipants"),
		targetParticipantId: v.id("sessionParticipants"),
	},
	handler: async (ctx, args) => {
		const session = await requireHostByIdentity(
			ctx,
			args.sessionId,
			args.hostParticipantId,
		);
		const target = await ctx.db.get(args.targetParticipantId);
		if (!target || target.sessionId !== args.sessionId || target.kickedAt) {
			throw gameError("participantNotFound");
		}
		await ctx.db.patch(args.targetParticipantId, { role: "host" });
		await ctx.db.patch(args.hostParticipantId, { role: "player" });
		await ctx.db.patch(session._id, {
			hostParticipantId: args.targetParticipantId,
			hostUserId: target.userId ?? session.hostUserId,
		});
	},
});
