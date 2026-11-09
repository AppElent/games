import { v } from "convex/values";
import {
	applyBackgammonMove,
	canEndBackgammonTurn,
	createInitialBackgammonState,
	getBackgammonWinner,
	rollBackgammonDice,
	switchBackgammonColor,
	toTurnState,
} from "@arcadeclub/core/backgammon";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import {
	BACKGAMMON_DUEL,
	requireRematch,
	requireTurn,
	seatHost,
	swapSeats,
} from "./lib/duel";
import { gameError, rules } from "./lib/errors";
import {
	findGameState,
	finishSession,
	loadBundle,
	loadGame,
	loadSession,
	reopenSession,
	startSession,
} from "./lib/gameSession";
import {
	createdSession,
	createdSessionValidator,
	hostedSessionArgs,
	hostGame,
} from "./lib/hostedSession";

async function insertState(
	ctx: MutationCtx,
	sessionId: Id<"gameSessions">,
	hostParticipantId: Id<"sessionParticipants">,
) {
	const now = Date.now();
	const initialState = createInitialBackgammonState();
	const hostSeat = await seatHost(ctx, BACKGAMMON_DUEL, hostParticipantId);
	return await ctx.db.insert("backgammonGameStates", {
		sessionId,
		phase: "waiting",
		...hostSeat,
		activeColor: initialState.activeColor,
		points: initialState.points,
		bar: initialState.bar,
		off: initialState.off,
		dice: initialState.dice,
		usedDice: [],
		createdAt: now,
		updatedAt: now,
	});
}

export const create = mutation({
	args: hostedSessionArgs,
	returns: createdSessionValidator,
	handler: async (ctx, args) => {
		const hosted = await hostGame(ctx, "backgammon", args);
		await insertState(ctx, hosted.session._id, hosted.participantId);
		return createdSession(hosted);
	},
});

// Installed mobile builds call this: remove once no installed build predates backgammon.create.
export const createState = mutation({
	args: {
		sessionId: v.id("gameSessions"),
		hostParticipantId: v.id("sessionParticipants"),
	},
	handler: async (ctx, args) => {
		await loadSession(ctx, "backgammon", args.sessionId, "sessionNotFound");
		const existing = await findGameState(ctx, "backgammon", args.sessionId);
		if (existing) {
			return existing._id;
		}
		return await insertState(ctx, args.sessionId, args.hostParticipantId);
	},
});

export const rollDice = mutation({
	args: {
		sessionId: v.id("gameSessions"),
		participantId: v.id("sessionParticipants"),
	},
	handler: async (ctx, args) => {
		const { session, state } = await loadGame(
			ctx,
			"backgammon",
			args.sessionId,
		);
		const color = requireTurn(BACKGAMMON_DUEL, state, args.participantId);
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
		await startSession(ctx, session, now);
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
		const { state } = await loadGame(ctx, "backgammon", args.sessionId);
		const color = requireTurn(BACKGAMMON_DUEL, state, args.participantId);
		const now = Date.now();
		const result = rules(() =>
			applyBackgammonMove(toTurnState(state), {
				color,
				from: args.from,
				to: args.to,
			}),
		);

		const winner = getBackgammonWinner(result.state.off);
		const played = {
			points: result.state.points,
			bar: result.state.bar,
			off: result.state.off,
			usedDice: [...state.usedDice, result.usedDie],
			updatedAt: now,
		};
		if (winner) {
			await finishSession(
				ctx,
				state,
				{
					...played,
					phase: "finished",
					winnerParticipantId: args.participantId,
				},
				{ now, winners: [args.participantId] },
			);
		} else {
			await ctx.db.patch(state._id, played);
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
		const { state } = await loadGame(ctx, "backgammon", args.sessionId);
		const color = requireTurn(BACKGAMMON_DUEL, state, args.participantId);
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
		const { state } = await loadGame(ctx, "backgammon", args.sessionId);
		requireRematch(BACKGAMMON_DUEL, state, args.participantId);
		const now = Date.now();
		const seats = await swapSeats(ctx, BACKGAMMON_DUEL, state);
		const initialState = createInitialBackgammonState();
		await ctx.db.patch(state._id, {
			phase: "ready",
			...seats,
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
		const bundle = await loadBundle(ctx, "backgammon", args.sessionId);
		if (!bundle) {
			return null;
		}
		const moves = await ctx.db
			.query("backgammonMoves")
			.withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
			.collect();
		return { ...bundle, moves };
	},
});
