import { v } from "convex/values";
import {
	applyBackgammonMove,
	canEndBackgammonTurn,
	computeUsedFlags,
	createInitialBackgammonState,
	getBackgammonWinner,
	rollBackgammonDice,
	switchBackgammonColor,
	type BackgammonColor,
	type BackgammonTurnState,
} from "@arcadeclub/core/backgammon";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { completeSession, reopenSession } from "./lib/completion";
import { gameError, toGameError } from "./lib/errors";

async function getBackgammonState(
	ctx: MutationCtx,
	sessionId: Id<"gameSessions">,
) {
	const session = await ctx.db.get(sessionId);
	if (!session || session.gameType !== "backgammon") {
		throw gameError("gameNotFound");
	}
	const state = await ctx.db
		.query("backgammonGameStates")
		.withIndex("by_session", (q) => q.eq("sessionId", sessionId))
		.unique();
	if (!state) {
		throw gameError("gameNotFound");
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
	throw gameError("notYourTurn");
}

function toTurnState(state: Doc<"backgammonGameStates">): BackgammonTurnState {
	return {
		points: state.points,
		bar: state.bar,
		off: state.off,
		activeColor: state.activeColor,
		dice: state.dice,
		used: computeUsedFlags(state.dice, state.usedDice),
	};
}

function requireActiveParticipant(
	state: Doc<"backgammonGameStates">,
	participantId: Id<"sessionParticipants">,
): BackgammonColor {
	if (state.phase === "finished") {
		throw gameError("gameAlreadyFinished");
	}
	if (!state.whiteParticipantId || !state.blackParticipantId) {
		throw gameError("waitingForBothPlayers");
	}
	const color = getParticipantColor(state, participantId);
	if (state.activeColor !== color) {
		throw gameError("notYourTurn");
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
			throw gameError("sessionNotFound");
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
			throw gameError("endTurnBeforeRolling");
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
		let result: ReturnType<typeof applyBackgammonMove>;
		try {
			result = applyBackgammonMove(toTurnState(state), {
				color,
				from: args.from,
				to: args.to,
			});
		} catch (caught) {
			throw toGameError(caught);
		}

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
			await completeSession(ctx, args.sessionId, {
				endedAt: now,
				winnerParticipantIds: [args.participantId],
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
			throw gameError("rollBeforeEndingTurn");
		}
		if (!canEndBackgammonTurn(toTurnState(state))) {
			throw gameError("movesRemaining");
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

export const rematch = mutation({
	args: {
		sessionId: v.id("gameSessions"),
		participantId: v.id("sessionParticipants"),
	},
	handler: async (ctx, args) => {
		const state = await getBackgammonState(ctx, args.sessionId);
		if (state.phase !== "finished") {
			throw gameError("currentGameNotFinished");
		}
		const isSeated =
			state.whiteParticipantId === args.participantId ||
			state.blackParticipantId === args.participantId;
		if (!isSeated) {
			throw gameError("playersOnlyRematch");
		}
		const now = Date.now();
		// Swap colors for the rematch.
		const white = state.blackParticipantId;
		const black = state.whiteParticipantId;
		if (white) {
			await ctx.db.patch(white, { seat: "white" });
		}
		if (black) {
			await ctx.db.patch(black, { seat: "black" });
		}
		const initialState = createInitialBackgammonState();
		await ctx.db.patch(state._id, {
			phase: "ready",
			whiteParticipantId: white,
			blackParticipantId: black,
			activeColor: initialState.activeColor,
			points: initialState.points,
			bar: initialState.bar,
			off: initialState.off,
			dice: initialState.dice,
			usedDice: [],
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
