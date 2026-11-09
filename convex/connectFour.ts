import { v } from "convex/values";
import {
	applyConnectFourDrop,
	createConnectFourBoard,
	getConnectFourWinner,
	switchConnectFourColor,
	type ConnectFourColor,
} from "@arcadeclub/core/connect-four";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import {
	CONNECT_FOUR_DUEL,
	requireRematch,
	requireSeat,
	requireTurn,
	swapSeats,
	winnerOf,
} from "./lib/duel";
import { gameError, rules } from "./lib/errors";
import {
	findGameState,
	finishSession,
	listParticipants,
	loadGame,
	reopenSession,
	startSession,
} from "./lib/gameSession";
import {
	createdSessionValidator,
	createHostedSession,
	hostedSessionArgs,
} from "./lib/hostedSession";

async function finishGame(
	ctx: MutationCtx,
	state: Doc<"connectFourStates">,
	outcome: "connect" | "draw" | "resignation",
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
	await ctx.db.patch(hostParticipantId, { seat: "red" });
	const now = Date.now();
	return await ctx.db.insert("connectFourStates", {
		sessionId,
		phase: "waiting",
		redParticipantId: hostParticipantId,
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
		const hosted = await createHostedSession(ctx, {
			...args,
			gameType: "connect-four",
			joinMode: "challenge",
			authPolicy: "guestAllowed",
		});
		await insertState(ctx, hosted.sessionId, hosted.participantId);
		return hosted;
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
		if (state.phase === "finished") {
			throw gameError("gameAlreadyFinished");
		}
		const color = requireSeat(CONNECT_FOUR_DUEL, state, args.participantId);
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
		const session = await ctx.db.get(args.sessionId);
		if (!session) {
			return null;
		}
		const participants = await listParticipants(ctx, args.sessionId);
		const state = await findGameState(ctx, "connect-four", args.sessionId);
		return { session, participants, state };
	},
});
