import {
	applyConnectFourDrop,
	CONNECT_FOUR_COLORS,
	createConnectFourBoard,
	getConnectFourWinner,
} from "@arcadeclub/core/connect-four";
import { opponent } from "@arcadeclub/core/duel";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import {
	CONNECT_FOUR_DUEL,
	finishDuel,
	rematchDuel,
	requireResign,
	requireTurn,
	seatHost,
} from "./lib/duel";
import { rules } from "./lib/errors";
import {
	loadBundle,
	loadGame,
	requireOwnParticipant,
	seatArgs,
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
		...seatArgs,
		column: v.number(),
	},
	handler: async (ctx, args) => {
		const { session, state } = await loadGame(
			ctx,
			"connect-four",
			args.sessionId,
		);
		await requireOwnParticipant(ctx, args);
		const color = requireTurn(CONNECT_FOUR_DUEL, state, args.participantId);
		const next = rules(() =>
			applyConnectFourDrop(state.board, color, args.column),
		);
		const now = Date.now();
		const winner = getConnectFourWinner(next.board);
		await ctx.db.patch(state._id, {
			phase: "active",
			board: next.board,
			activeColor: opponent(CONNECT_FOUR_COLORS, color),
			updatedAt: now,
		});
		await startSession(ctx, session, now);
		if (winner) {
			const winningColor = winner === "draw" ? undefined : winner;
			await finishDuel(
				ctx,
				state,
				winningColor,
				{
					resultOutcome: winner === "draw" ? "draw" : "connect",
					resultWinner: winningColor,
				},
				now,
			);
		}
	},
});

export const resign = mutation({
	args: seatArgs,
	handler: async (ctx, args) => {
		const { state } = await loadGame(ctx, "connect-four", args.sessionId);
		await requireOwnParticipant(ctx, args);
		const winner = requireResign(CONNECT_FOUR_DUEL, state, args.participantId);
		await finishDuel(
			ctx,
			state,
			winner,
			{ resultOutcome: "resignation", resultWinner: winner },
			Date.now(),
		);
	},
});

export const rematch = mutation({
	args: seatArgs,
	handler: async (ctx, args) => {
		const { state } = await loadGame(ctx, "connect-four", args.sessionId);
		await requireOwnParticipant(ctx, args);
		await rematchDuel(
			ctx,
			CONNECT_FOUR_DUEL,
			state,
			args.participantId,
			() => ({
				phase: "active",
				board: createConnectFourBoard(),
				activeColor: "red",
				resultOutcome: undefined,
				resultWinner: undefined,
			}),
		);
	},
});

export const getBundle = query({
	args: { sessionId: v.id("gameSessions") },
	handler: async (ctx, args) => {
		return await loadBundle(ctx, "connect-four", args.sessionId);
	},
});
