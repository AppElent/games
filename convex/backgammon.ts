import { v } from "convex/values";
import {
	applyBackgammonMove,
	computeUsedFlags,
	createInitialBackgammonState,
	getBackgammonWinner,
	rollBackgammonDice,
	switchBackgammonColor,
	type BackgammonColor,
	type BackgammonMoveDestination,
	type BackgammonMoveSource,
} from "../src/lib/games/backgammon";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";

async function getBackgammonState(
	ctx: MutationCtx,
	sessionId: Id<"gameSessions">,
) {
	const session = await ctx.db.get(sessionId);
	if (!session || session.gameType !== "backgammon") {
		throw new Error("Backgammon game not found");
	}
	const state = await ctx.db
		.query("backgammonGameStates")
		.withIndex("by_session", (q) => q.eq("sessionId", sessionId))
		.unique();
	if (!state) {
		throw new Error("Backgammon game not found");
	}
	return state;
}

function getParticipantColor(
	state: Doc<"backgammonGameStates">,
	participantId: Id<"sessionParticipants">,
): BackgammonColor {
	if (state.whiteParticipantId === participantId) {
		return "white";
	}
	if (state.blackParticipantId === participantId) {
		return "black";
	}
	throw new Error("It is not your turn");
}

function requireActiveParticipant(
	state: Doc<"backgammonGameStates">,
	participantId: Id<"sessionParticipants">,
): BackgammonColor {
	if (state.phase === "finished") {
		throw new Error("This match is already finished");
	}
	if (!state.whiteParticipantId || !state.blackParticipantId) {
		throw new Error("Waiting for both players");
	}
	const color = getParticipantColor(state, participantId);
	if (state.activeColor !== color) {
		throw new Error("It is not your turn");
	}
	return color;
}

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
			.query("backgammonGameStates")
			.withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
			.unique();
		if (existing) {
			return existing._id;
		}
		const now = Date.now();
		const initialState = createInitialBackgammonState();
		await ctx.db.patch(args.hostParticipantId, { seat: "white" });
		return await ctx.db.insert("backgammonGameStates", {
			sessionId: args.sessionId,
			phase: "waiting",
			whiteParticipantId: args.hostParticipantId,
			activeColor: initialState.activeColor,
			points: initialState.points,
			bar: initialState.bar,
			off: initialState.off,
			dice: initialState.dice,
			usedDice: [],
			createdAt: now,
			updatedAt: now,
		});
	},
});

export const rollDice = mutation({
	args: {
		sessionId: v.id("gameSessions"),
		participantId: v.id("sessionParticipants"),
	},
	handler: async (ctx, args) => {
		const state = await getBackgammonState(ctx, args.sessionId);
		const color = requireActiveParticipant(state, args.participantId);
		if (state.dice.length > 0) {
			throw new Error("End your turn before rolling again");
		}
		const now = Date.now();
		const dice = rollBackgammonDice();
		await ctx.db.patch(state._id, {
			phase: "active",
			dice,
			usedDice: [],
			updatedAt: now,
		});
		const session = await ctx.db.get(args.sessionId);
		await ctx.db.patch(args.sessionId, {
			status: "active",
			startedAt: session?.startedAt ?? now,
		});
		await ctx.db.insert("backgammonMoves", {
			sessionId: args.sessionId,
			participantId: args.participantId,
			moveType: "roll",
			color,
			dice,
			createdAt: now,
		});
		return dice;
	},
});

export const applyMove = mutation({
	args: {
		sessionId: v.id("gameSessions"),
		participantId: v.id("sessionParticipants"),
		from: v.union(v.number(), v.literal("bar")),
		to: v.union(v.number(), v.literal("off")),
	},
	handler: async (ctx, args) => {
		const state = await getBackgammonState(ctx, args.sessionId);
		const color = requireActiveParticipant(state, args.participantId);
		const now = Date.now();
		const result = applyBackgammonMove(
			{
				points: state.points,
				bar: state.bar,
				off: state.off,
				activeColor: state.activeColor,
				dice: state.dice,
				used: computeUsedFlags(state.dice, state.usedDice),
			},
			{
				color,
				from: args.from as BackgammonMoveSource,
				to: args.to as BackgammonMoveDestination,
			},
		);

		const winner = getBackgammonWinner(result.state.off);
		await ctx.db.patch(state._id, {
			points: result.state.points,
			bar: result.state.bar,
			off: result.state.off,
			usedDice: [...state.usedDice, result.usedDie],
			updatedAt: now,
			...(winner
				? {
						phase: "finished" as const,
						winnerParticipantId: args.participantId,
					}
				: {}),
		});
		if (winner) {
			await ctx.db.patch(args.sessionId, {
				status: "completed",
				endedAt: now,
			});
		}
		await ctx.db.insert("backgammonMoves", {
			sessionId: args.sessionId,
			participantId: args.participantId,
			moveType: "move",
			color,
			from: args.from,
			to: args.to,
			dice: [result.usedDie],
			createdAt: now,
		});
	},
});

export const endTurn = mutation({
	args: {
		sessionId: v.id("gameSessions"),
		participantId: v.id("sessionParticipants"),
	},
	handler: async (ctx, args) => {
		const state = await getBackgammonState(ctx, args.sessionId);
		const color = requireActiveParticipant(state, args.participantId);
		if (state.dice.length === 0) {
			throw new Error("Roll before ending your turn");
		}
		const now = Date.now();
		await ctx.db.patch(state._id, {
			activeColor: switchBackgammonColor(state.activeColor),
			dice: [],
			usedDice: [],
			updatedAt: now,
		});
		await ctx.db.insert("backgammonMoves", {
			sessionId: args.sessionId,
			participantId: args.participantId,
			moveType: "endTurn",
			color,
			dice: [],
			createdAt: now,
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
			.query("backgammonGameStates")
			.withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
			.unique();
		const moves = await ctx.db
			.query("backgammonMoves")
			.withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
			.collect();
		return { session, participants, state, moves };
	},
});
