import { v } from "convex/values";
import {
	applyBackgammonMove,
	canEndBackgammonTurn,
	computeUsedFlags,
	createInitialBackgammonState,
	getBackgammonWinner,
	rollBackgammonDice,
	switchBackgammonColor,
	type BackgammonTurnState,
} from "@arcadeclub/core/backgammon";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import {
	BACKGAMMON_DUEL,
	requireRematch,
	requireTurn,
	swapSeats,
} from "./lib/duel";
import { gameError, rules } from "./lib/errors";
import {
	findGameState,
	finishSession,
	listParticipants,
	loadGame,
	loadSession,
	reopenSession,
	startSession,
} from "./lib/gameSession";
import {
	createdSessionValidator,
	createHostedSession,
	hostedSessionArgs,
} from "./lib/hostedSession";

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

async function insertState(
	ctx: MutationCtx,
	sessionId: Id<"gameSessions">,
	hostParticipantId: Id<"sessionParticipants">,
) {
	const now = Date.now();
	const initialState = createInitialBackgammonState();
	await ctx.db.patch(hostParticipantId, { seat: "white" });
	return await ctx.db.insert("backgammonGameStates", {
		sessionId,
		phase: "waiting",
		whiteParticipantId: hostParticipantId,
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
		const hosted = await createHostedSession(ctx, {
			...args,
			gameType: "backgammon",
			joinMode: "challenge",
			authPolicy: "guestAllowed",
		});
		await insertState(ctx, hosted.sessionId, hosted.participantId);
		return hosted;
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
		const session = await ctx.db.get(args.sessionId);
		if (!session) {
			return null;
		}
		const participants = await listParticipants(ctx, args.sessionId);
		const state = await findGameState(ctx, "backgammon", args.sessionId);
		const moves = await ctx.db
			.query("backgammonMoves")
			.withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
			.collect();
		return { session, participants, state, moves };
	},
});
