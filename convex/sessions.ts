import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import {
	authPolicyValidator,
	gameTypeValidator,
	joinModeValidator,
} from "./schema";
import { getOptionalUserId, requireUserId } from "./lib/auth";
import { claimSeatOnJoin } from "./lib/cardSeats";
import { createHostedSession } from "./lib/hostedSession";
import { gameError } from "./lib/errors";

/** Finds this identity's existing participant row inside one session. */
async function findExistingParticipant(
	ctx: MutationCtx,
	sessionId: Id<"gameSessions">,
	userId: string | undefined,
	guestId: string | undefined,
) {
	const participants = await ctx.db
		.query("sessionParticipants")
		.withIndex("by_session", (q) => q.eq("sessionId", sessionId))
		.collect();
	return participants.find(
		(participant) =>
			(userId && participant.userId === userId) ||
			(!userId && guestId && participant.guestId === guestId),
	);
}

/** Shared join guards: session availability, auth policy, kicks, and lock. */
async function guardJoin(
	ctx: MutationCtx,
	session: Doc<"gameSessions">,
	args: { guestId?: string },
) {
	const userId = await getOptionalUserId(ctx);
	if (session.authPolicy === "signedInRequired" && !userId) {
		throw gameError("signInToJoin");
	}
	const existing = await findExistingParticipant(
		ctx,
		session._id,
		userId,
		args.guestId,
	);
	if (existing?.kickedAt) {
		throw gameError("removedByHost");
	}
	if (!existing && session.locked) {
		throw gameError("roomLocked");
	}
	return { userId, existing };
}

/** Loads a session and verifies the caller participant is its host. */
async function requireHost(
	ctx: MutationCtx,
	sessionId: Id<"gameSessions">,
	hostParticipantId: Id<"sessionParticipants">,
) {
	const session = await ctx.db.get(sessionId);
	if (!session) {
		throw gameError("gameNotFound");
	}
	if (session.hostParticipantId !== hostParticipantId) {
		throw gameError("hostOnly");
	}
	// The host's participant id is public, so a signed-in host must prove it.
	const host = await ctx.db.get(hostParticipantId);
	if (host?.userId && host.userId !== (await getOptionalUserId(ctx))) {
		throw gameError("hostOnly");
	}
	return session;
}

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
		// A card table needs its host's seat secret from the first moment, so it
		// is created in one step by `cardGames.createTable`.
		if (args.gameType === "card-games") {
			throw gameError("gameUnavailable");
		}
		return await createHostedSession(ctx, args);
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
		const { joinCode, shareToken } = args;
		let session: Doc<"gameSessions"> | null = null;
		if (shareToken) {
			session = await ctx.db
				.query("gameSessions")
				.withIndex("by_shareToken", (q) => q.eq("shareToken", shareToken))
				.unique();
		} else if (joinCode) {
			const normalized = joinCode.replace(/[^a-z0-9]/gi, "").toUpperCase();
			session = await ctx.db
				.query("gameSessions")
				.withIndex("by_joinCode", (q) => q.eq("joinCode", normalized))
				.unique();
		}
		if (
			!session ||
			session.status === "completed" ||
			session.status === "cancelled"
		) {
			return null;
		}
		return session.gameType;
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
			throw gameError("roomNotFound");
		}
		const { userId, existing } = await guardJoin(ctx, session, args);

		if (existing) {
			// Same device/account returning: reclaim the same participant row
			// (and therefore the same seat) instead of duplicating.
			await ctx.db.patch(existing._id, {
				connected: true,
				lastSeen: Date.now(),
			});
			return {
				sessionId: session._id,
				participantId: existing._id,
				gameType: session.gameType,
				seatClaimed:
					!args.asSpectator &&
					(await claimSeatOnJoin(ctx, session, existing._id, args.seatSecret)),
			};
		}

		const participantId = await ctx.db.insert("sessionParticipants", {
			sessionId: session._id,
			userId,
			guestId: userId ? undefined : args.guestId,
			displayName: args.displayName,
			role: args.asSpectator ? "watcher" : "player",
			connected: true,
			lastSeen: Date.now(),
		});
		const seatClaimed =
			!args.asSpectator &&
			(await claimSeatOnJoin(ctx, session, participantId, args.seatSecret));

		return {
			sessionId: session._id,
			participantId,
			gameType: session.gameType,
			seatClaimed,
		};
	},
});

export const joinByToken = mutation({
	args: {
		shareToken: v.string(),
		displayName: v.string(),
		guestId: v.optional(v.string()),
		asSpectator: v.optional(v.boolean()),
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
			throw gameError("gameUnavailable");
		}
		const { userId, existing } = await guardJoin(ctx, session, args);

		const participantId =
			existing?._id ??
			(await ctx.db.insert("sessionParticipants", {
				sessionId: session._id,
				userId,
				guestId: userId ? undefined : args.guestId,
				displayName: args.displayName,
				role: args.asSpectator ? "watcher" : "player",
				connected: true,
				lastSeen: Date.now(),
			}));

		if (existing) {
			await ctx.db.patch(existing._id, {
				connected: true,
				lastSeen: Date.now(),
			});
		}

		// Spectators never claim seats; full challenge boards demote extra
		// joiners to watchers instead of rejecting them.
		const wantsSeat = !args.asSpectator;
		const demoteToWatcher = async () => {
			await ctx.db.patch(participantId, { role: "watcher", seat: undefined });
		};

		if (wantsSeat && session.gameType === "backgammon") {
			const state = await ctx.db
				.query("backgammonGameStates")
				.withIndex("by_session", (q) => q.eq("sessionId", session._id))
				.unique();
			if (state) {
				if (
					state.blackParticipantId &&
					state.blackParticipantId !== participantId &&
					state.whiteParticipantId !== participantId
				) {
					await demoteToWatcher();
				} else if (state.whiteParticipantId === participantId) {
					await ctx.db.patch(participantId, { seat: "white" });
				} else if (state.blackParticipantId === participantId) {
					await ctx.db.patch(participantId, { seat: "black" });
				} else {
					await ctx.db.patch(participantId, { seat: "black" });
					await ctx.db.patch(state._id, {
						blackParticipantId: participantId,
						phase: "ready",
						updatedAt: Date.now(),
					});
				}
			}
		}

		if (wantsSeat && session.gameType === "chess") {
			const state = await ctx.db
				.query("chessGameStates")
				.withIndex("by_session", (q) => q.eq("sessionId", session._id))
				.unique();
			if (state) {
				const isSeated =
					state.whiteParticipantId === participantId ||
					state.blackParticipantId === participantId;
				if (!isSeated) {
					if (state.whiteParticipantId && state.blackParticipantId) {
						await demoteToWatcher();
					} else {
						const seat = state.whiteParticipantId ? "black" : "white";
						await ctx.db.patch(participantId, { seat });
						await ctx.db.patch(state._id, {
							[seat === "white" ? "whiteParticipantId" : "blackParticipantId"]:
								participantId,
							updatedAt: Date.now(),
						});
					}
				}
			}
		}

		if (wantsSeat && session.gameType === "connect-four") {
			const state = await ctx.db
				.query("connectFourStates")
				.withIndex("by_session", (q) => q.eq("sessionId", session._id))
				.unique();
			if (state) {
				const isSeated =
					state.redParticipantId === participantId ||
					state.yellowParticipantId === participantId;
				if (!isSeated) {
					if (state.redParticipantId && state.yellowParticipantId) {
						await demoteToWatcher();
					} else {
						const seat = state.redParticipantId ? "yellow" : "red";
						await ctx.db.patch(participantId, { seat });
						await ctx.db.patch(state._id, {
							[seat === "red" ? "redParticipantId" : "yellowParticipantId"]:
								participantId,
							updatedAt: Date.now(),
						});
					}
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

/** Full result bundle for one completed session (scoreboard + quiz stats). */
export const getResults = query({
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
		const quizState =
			session.gameType === "live-quiz"
				? await ctx.db
						.query("liveQuizStates")
						.withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
						.unique()
				: null;
		const quizSet = quizState?.quizSetId
			? await ctx.db.get(quizState.quizSetId)
			: null;
		const answers =
			session.gameType === "live-quiz"
				? await ctx.db
						.query("liveQuizAnswers")
						.withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
						.collect()
				: [];
		return { session, participants, quizSet, answers };
	},
});

export const heartbeat = mutation({
	args: { participantId: v.id("sessionParticipants") },
	handler: async (ctx, args) => {
		const participant = await ctx.db.get(args.participantId);
		if (!participant) {
			throw gameError("participantNotFound");
		}
		await ctx.db.patch(args.participantId, {
			connected: true,
			lastSeen: Date.now(),
		});
	},
});

export const kickParticipant = mutation({
	args: {
		sessionId: v.id("gameSessions"),
		hostParticipantId: v.id("sessionParticipants"),
		targetParticipantId: v.id("sessionParticipants"),
	},
	handler: async (ctx, args) => {
		await requireHost(ctx, args.sessionId, args.hostParticipantId);
		if (args.targetParticipantId === args.hostParticipantId) {
			throw gameError("hostCannotKickSelf");
		}
		const target = await ctx.db.get(args.targetParticipantId);
		if (!target || target.sessionId !== args.sessionId) {
			throw gameError("participantNotFound");
		}
		await ctx.db.patch(args.targetParticipantId, {
			kickedAt: Date.now(),
			connected: false,
		});
	},
});

export const setLocked = mutation({
	args: {
		sessionId: v.id("gameSessions"),
		hostParticipantId: v.id("sessionParticipants"),
		locked: v.boolean(),
	},
	handler: async (ctx, args) => {
		await requireHost(ctx, args.sessionId, args.hostParticipantId);
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
		await requireHost(ctx, args.sessionId, args.hostParticipantId);
		const title = args.title.trim();
		if (!title || title.length > 80) {
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
		const session = await requireHost(
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
