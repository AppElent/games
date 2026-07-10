import { ConvexError, v } from "convex/values";
import {
	applyConnectFourDrop,
	createConnectFourBoard,
	getConnectFourWinner,
	switchConnectFourColor,
	type ConnectFourColor,
} from "../src/lib/games/connect-four";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { completeSession, reopenSession } from "./lib/completion";

async function getState(ctx: MutationCtx, sessionId: Id<"gameSessions">) {
	const session = await ctx.db.get(sessionId);
	if (!session || session.gameType !== "connect-four") {
		throw new ConvexError("Connect Four game not found");
	}
	const state = await ctx.db
		.query("connectFourStates")
		.withIndex("by_session", (q) => q.eq("sessionId", sessionId))
		.unique();
	if (!state) {
		throw new ConvexError("Connect Four game not found");
	}
	return { session, state };
}

function getParticipantColor(
	state: Doc<"connectFourStates">,
	participantId: Id<"sessionParticipants">,
): ConnectFourColor {
	if (state.redParticipantId === participantId) {
		return "red";
	}
	if (state.yellowParticipantId === participantId) {
		return "yellow";
	}
	throw new ConvexError("You are not seated in this game");
}

async function finishGame(
	ctx: MutationCtx,
	state: Doc<"connectFourStates">,
	outcome: "connect" | "draw" | "resignation",
	winner: ConnectFourColor | undefined,
	now: number,
) {
	const winnerParticipantId =
		winner === "red"
			? state.redParticipantId
			: winner === "yellow"
				? state.yellowParticipantId
				: undefined;
	await ctx.db.patch(state._id, {
		phase: "finished",
		resultOutcome: outcome,
		resultWinner: winner,
		winnerParticipantId,
		updatedAt: now,
	});
	await completeSession(ctx, state.sessionId, {
		endedAt: now,
		winnerParticipantIds: winnerParticipantId ? [winnerParticipantId] : [],
	});
}

export const createState = mutation({
	args: {
		sessionId: v.id("gameSessions"),
		hostParticipantId: v.id("sessionParticipants"),
	},
	handler: async (ctx, args) => {
		const session = await ctx.db.get(args.sessionId);
		if (!session || session.gameType !== "connect-four") {
			throw new ConvexError("Connect Four session not found");
		}
		const existing = await ctx.db
			.query("connectFourStates")
			.withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
			.unique();
		if (existing) {
			return existing._id;
		}
		await ctx.db.patch(args.hostParticipantId, { seat: "red" });
		const now = Date.now();
		return await ctx.db.insert("connectFourStates", {
			sessionId: args.sessionId,
			phase: "waiting",
			redParticipantId: args.hostParticipantId,
			board: createConnectFourBoard(),
			activeColor: "red",
			createdAt: now,
			updatedAt: now,
		});
	},
});

export const drop = mutation({
	args: {
		sessionId: v.id("gameSessions"),
		participantId: v.id("sessionParticipants"),
		column: v.number(),
	},
	handler: async (ctx, args) => {
		const { session, state } = await getState(ctx, args.sessionId);
		if (state.phase === "finished") {
			throw new ConvexError("This game is already finished");
		}
		if (!state.redParticipantId || !state.yellowParticipantId) {
			throw new ConvexError("Waiting for an opponent");
		}
		const color = getParticipantColor(state, args.participantId);
		if (state.activeColor !== color) {
			throw new ConvexError("It is not your turn");
		}
		let next: ReturnType<typeof applyConnectFourDrop>;
		try {
			next = applyConnectFourDrop(state.board, color, args.column);
		} catch (caught) {
			throw new ConvexError(
				caught instanceof Error ? caught.message : "Invalid move",
			);
		}
		const now = Date.now();
		const winner = getConnectFourWinner(next.board);
		await ctx.db.patch(state._id, {
			phase: "active",
			board: next.board,
			activeColor: switchConnectFourColor(color),
			updatedAt: now,
		});
		if (session.status === "lobby") {
			await ctx.db.patch(args.sessionId, { status: "active", startedAt: now });
		}
		if (winner) {
			const fresh = await ctx.db.get(state._id);
			if (fresh) {
				await finishGame(
					ctx,
					fresh,
					winner === "draw" ? "draw" : "connect",
					winner === "draw" ? undefined : winner,
					now,
				);
			}
		}
	},
});

export const resign = mutation({
	args: {
		sessionId: v.id("gameSessions"),
		participantId: v.id("sessionParticipants"),
	},
	handler: async (ctx, args) => {
		const { state } = await getState(ctx, args.sessionId);
		if (state.phase === "finished") {
			throw new ConvexError("This game is already finished");
		}
		const color = getParticipantColor(state, args.participantId);
		await finishGame(
			ctx,
			state,
			"resignation",
			switchConnectFourColor(color),
			Date.now(),
		);
	},
});

export const rematch = mutation({
	args: {
		sessionId: v.id("gameSessions"),
		participantId: v.id("sessionParticipants"),
	},
	handler: async (ctx, args) => {
		const { state } = await getState(ctx, args.sessionId);
		if (state.phase !== "finished") {
			throw new ConvexError("The current game is not finished");
		}
		getParticipantColor(state, args.participantId);
		const now = Date.now();
		// Swap colors for the rematch.
		const red = state.yellowParticipantId;
		const yellow = state.redParticipantId;
		if (red) {
			await ctx.db.patch(red, { seat: "red" });
		}
		if (yellow) {
			await ctx.db.patch(yellow, { seat: "yellow" });
		}
		await ctx.db.patch(state._id, {
			phase: "active",
			redParticipantId: red,
			yellowParticipantId: yellow,
			board: createConnectFourBoard(),
			activeColor: "red",
			resultOutcome: undefined,
			resultWinner: undefined,
			winnerParticipantId: undefined,
			updatedAt: now,
		});
		await reopenSession(ctx, args.sessionId);
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
			.query("connectFourStates")
			.withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
			.unique();
		return { session, participants, state };
	},
});
