import { v } from "convex/values";
import {
	applyConnectFourDrop,
	createConnectFourBoard,
	type ConnectFourColor,
	type ConnectFourOutcome,
	getConnectFourWinner,
	switchConnectFourColor,
} from "@arcadeclub/core/connect-four";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import {
	CONNECT_FOUR_DUEL,
	requireRematch,
	requireResign,
	requireTurn,
	seatHost,
	swapSeats,
	winnerOf,
} from "./lib/duel";
import { rules } from "./lib/errors";
import {
	finishSession,
	loadBundle,
	loadGame,
	reopenSession,
	startSession,
} from "./lib/gameSession";
import {
	createdSession,
	createdSessionValidator,
	hostedSessionArgs,
	hostGame,
} from "./lib/hostedSession";

async function finishGame(
	ctx: MutationCtx,
	state: Doc<"connectFourStates">,
	outcome: ConnectFourOutcome,
	winner: ConnectFourColor | undefined,
	now: number,
) {
	const winnerParticipantId = winnerOf(state, winner);
	await finishSession(
		ctx,
		state,
		{
			phase: "finished",
			resultOutcome: outcome,
			resultWinner: winner,
			winnerParticipantId,
			updatedAt: now,
		},
		{ now, winners: [winnerParticipantId] },
	);
}

async function insertState(
	ctx: MutationCtx,
	sessionId: Id<"gameSessions">,
	hostParticipantId: Id<"sessionParticipants">,
) {
	const hostSeat = await seatHost(ctx, CONNECT_FOUR_DUEL, hostParticipantId);
	const now = Date.now();
	return await ctx.db.insert("connectFourStates", {
		sessionId,
		phase: "waiting",
		...hostSeat,
		board: createConnectFourBoard(),
		activeColor: "red",
		createdAt: now,
		updatedAt: now,
	});
}

export const create = mutation({
	args: hostedSessionArgs,
	returns: createdSessionValidator,
	handler: async (ctx, args) => {
		const hosted = await hostGame(ctx, "connect-four", args);
		await insertState(ctx, hosted.session._id, hosted.participantId);
		return createdSession(hosted);
	},
});

export const drop = mutation({
	args: {
		sessionId: v.id("gameSessions"),
		participantId: v.id("sessionParticipants"),
		column: v.number(),
	},
	handler: async (ctx, args) => {
		const { session, state } = await loadGame(ctx, "connect-four", args.sessionId);
		const color = requireTurn(CONNECT_FOUR_DUEL, state, args.participantId);
		const next = rules(() =>
			applyConnectFourDrop(state.board, color, args.column),
		);
		const now = Date.now();
		const winner = getConnectFourWinner(next.board);
		await ctx.db.patch(state._id, {
			phase: "active",
			board: next.board,
			activeColor: switchConnectFourColor(color),
			updatedAt: now,
		});
		await startSession(ctx, session, now);
		if (winner) {
			await finishGame(
				ctx,
				state,
				winner === "draw" ? "draw" : "connect",
				winner === "draw" ? undefined : winner,
				now,
			);
		}
	},
});

export const resign = mutation({
	args: {
		sessionId: v.id("gameSessions"),
		participantId: v.id("sessionParticipants"),
	},
	handler: async (ctx, args) => {
		const { state } = await loadGame(ctx, "connect-four", args.sessionId);
		const winner = requireResign(CONNECT_FOUR_DUEL, state, args.participantId);
		await finishGame(ctx, state, "resignation", winner, Date.now());
	},
});

export const rematch = mutation({
	args: {
		sessionId: v.id("gameSessions"),
		participantId: v.id("sessionParticipants"),
	},
	handler: async (ctx, args) => {
		const { state } = await loadGame(ctx, "connect-four", args.sessionId);
		requireRematch(CONNECT_FOUR_DUEL, state, args.participantId);
		const now = Date.now();
		const seats = await swapSeats(ctx, CONNECT_FOUR_DUEL, state);
		await ctx.db.patch(state._id, {
			phase: "active",
			...seats,
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
		return await loadBundle(ctx, "connect-four", args.sessionId);
	},
});
