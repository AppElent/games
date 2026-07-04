import { ConvexError, v } from "convex/values";
import {
	applyChessMove,
	CHESS_INITIAL_FEN,
	CHESS_TIME_CONTROLS,
	hasFlagFallen,
	tickClockAfterMove,
	type ChessColor,
	type ChessTimeControl,
} from "../src/lib/games/chess";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { chessTimeControlValidator } from "./schema";

async function getChessState(ctx: MutationCtx, sessionId: Id<"gameSessions">) {
	const session = await ctx.db.get(sessionId);
	if (!session || session.gameType !== "chess") {
		throw new ConvexError("Chess game not found");
	}
	const state = await ctx.db
		.query("chessGameStates")
		.withIndex("by_session", (q) => q.eq("sessionId", sessionId))
		.unique();
	if (!state) {
		throw new ConvexError("Chess game not found");
	}
	return { session, state };
}

function getParticipantColor(
	state: Doc<"chessGameStates">,
	participantId: Id<"sessionParticipants">,
): ChessColor {
	if (state.whiteParticipantId === participantId) {
		return "white";
	}
	if (state.blackParticipantId === participantId) {
		return "black";
	}
	throw new ConvexError("You are not seated in this game");
}

function getClock(state: Doc<"chessGameStates">) {
	if (
		state.remainingWhiteMs === undefined ||
		state.remainingBlackMs === undefined ||
		state.turnStartedAt === undefined
	) {
		return undefined;
	}
	return {
		remainingWhiteMs: state.remainingWhiteMs,
		remainingBlackMs: state.remainingBlackMs,
		turnStartedAt: state.turnStartedAt,
	};
}

async function finishGame(
	ctx: MutationCtx,
	state: Doc<"chessGameStates">,
	outcome: Doc<"chessGameStates">["resultOutcome"],
	winner: ChessColor | undefined,
	now: number,
) {
	const winnerParticipantId =
		winner === "white"
			? state.whiteParticipantId
			: winner === "black"
				? state.blackParticipantId
				: undefined;
	await ctx.db.patch(state._id, {
		phase: "finished",
		resultOutcome: outcome,
		resultWinner: winner,
		winnerParticipantId,
		drawOfferBy: undefined,
		updatedAt: now,
	});
	await ctx.db.patch(state.sessionId, { status: "completed", endedAt: now });
}

export const createState = mutation({
	args: {
		sessionId: v.id("gameSessions"),
		hostParticipantId: v.id("sessionParticipants"),
		timeControl: chessTimeControlValidator,
		hostColor: v.union(
			v.literal("white"),
			v.literal("black"),
			v.literal("random"),
		),
	},
	handler: async (ctx, args) => {
		const session = await ctx.db.get(args.sessionId);
		if (!session || session.gameType !== "chess") {
			throw new ConvexError("Chess session not found");
		}
		const existing = await ctx.db
			.query("chessGameStates")
			.withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
			.unique();
		if (existing) {
			return existing._id;
		}
		const hostColor: ChessColor =
			args.hostColor === "random"
				? Math.random() < 0.5
					? "white"
					: "black"
				: args.hostColor;
		await ctx.db.patch(args.hostParticipantId, { seat: hostColor });
		const now = Date.now();
		const initialSeconds =
			CHESS_TIME_CONTROLS[args.timeControl as ChessTimeControl].initialSeconds;
		return await ctx.db.insert("chessGameStates", {
			sessionId: args.sessionId,
			phase: "waiting",
			whiteParticipantId:
				hostColor === "white" ? args.hostParticipantId : undefined,
			blackParticipantId:
				hostColor === "black" ? args.hostParticipantId : undefined,
			fen: CHESS_INITIAL_FEN,
			sanHistory: [],
			activeColor: "white",
			timeControl: args.timeControl,
			remainingWhiteMs: initialSeconds ? initialSeconds * 1000 : undefined,
			remainingBlackMs: initialSeconds ? initialSeconds * 1000 : undefined,
			createdAt: now,
			updatedAt: now,
		});
	},
});

export const applyMove = mutation({
	args: {
		sessionId: v.id("gameSessions"),
		participantId: v.id("sessionParticipants"),
		from: v.string(),
		to: v.string(),
		promotion: v.optional(
			v.union(v.literal("q"), v.literal("r"), v.literal("b"), v.literal("n")),
		),
	},
	handler: async (ctx, args) => {
		const { session, state } = await getChessState(ctx, args.sessionId);
		if (state.phase === "finished") {
			throw new ConvexError("This game is already finished");
		}
		if (!state.whiteParticipantId || !state.blackParticipantId) {
			throw new ConvexError("Waiting for an opponent");
		}
		const color = getParticipantColor(state, args.participantId);
		if (state.activeColor !== color) {
			throw new ConvexError("It is not your turn");
		}
		const now = Date.now();

		let clock = state.phase === "active" ? getClock(state) : undefined;
		if (clock && hasFlagFallen(clock, color, now)) {
			await finishGame(
				ctx,
				state,
				"timeout",
				color === "white" ? "black" : "white",
				now,
			);
			throw new ConvexError("Your time ran out");
		}

		let outcome: ReturnType<typeof applyChessMove>;
		try {
			outcome = applyChessMove(state.fen, {
				from: args.from,
				to: args.to,
				promotion: args.promotion,
			});
		} catch {
			throw new ConvexError("Illegal move");
		}

		if (clock) {
			clock = tickClockAfterMove(clock, color, now);
		}
		const startingClock =
			state.phase === "waiting" && state.remainingWhiteMs !== undefined
				? { turnStartedAt: now }
				: {};

		await ctx.db.patch(state._id, {
			phase: "active",
			fen: outcome.fen,
			sanHistory: [...state.sanHistory, outcome.san],
			activeColor: outcome.activeColor,
			drawOfferBy: undefined,
			...(clock
				? {
						remainingWhiteMs: clock.remainingWhiteMs,
						remainingBlackMs: clock.remainingBlackMs,
						turnStartedAt: clock.turnStartedAt,
					}
				: startingClock),
			updatedAt: now,
		});
		if (session.status === "lobby") {
			await ctx.db.patch(args.sessionId, {
				status: "active",
				startedAt: now,
			});
		}
		if (outcome.result) {
			const freshState = await ctx.db.get(state._id);
			if (freshState) {
				await finishGame(
					ctx,
					freshState,
					outcome.result.outcome,
					"winner" in outcome.result ? outcome.result.winner : undefined,
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
		const { state } = await getChessState(ctx, args.sessionId);
		if (state.phase === "finished") {
			throw new ConvexError("This game is already finished");
		}
		const color = getParticipantColor(state, args.participantId);
		await finishGame(
			ctx,
			state,
			"resignation",
			color === "white" ? "black" : "white",
			Date.now(),
		);
	},
});

export const offerDraw = mutation({
	args: {
		sessionId: v.id("gameSessions"),
		participantId: v.id("sessionParticipants"),
	},
	handler: async (ctx, args) => {
		const { state } = await getChessState(ctx, args.sessionId);
		if (state.phase !== "active") {
			throw new ConvexError("No active game");
		}
		const color = getParticipantColor(state, args.participantId);
		if (state.drawOfferBy && state.drawOfferBy !== color) {
			await finishGame(ctx, state, "drawAgreed", undefined, Date.now());
			return;
		}
		await ctx.db.patch(state._id, {
			drawOfferBy: color,
			updatedAt: Date.now(),
		});
	},
});

export const respondDraw = mutation({
	args: {
		sessionId: v.id("gameSessions"),
		participantId: v.id("sessionParticipants"),
		accept: v.boolean(),
	},
	handler: async (ctx, args) => {
		const { state } = await getChessState(ctx, args.sessionId);
		if (state.phase !== "active" || !state.drawOfferBy) {
			throw new ConvexError("No draw offer to respond to");
		}
		const color = getParticipantColor(state, args.participantId);
		if (state.drawOfferBy === color) {
			throw new ConvexError("You cannot respond to your own offer");
		}
		if (args.accept) {
			await finishGame(ctx, state, "drawAgreed", undefined, Date.now());
		} else {
			await ctx.db.patch(state._id, {
				drawOfferBy: undefined,
				updatedAt: Date.now(),
			});
		}
	},
});

export const claimTimeout = mutation({
	args: {
		sessionId: v.id("gameSessions"),
		participantId: v.id("sessionParticipants"),
	},
	handler: async (ctx, args) => {
		const { state } = await getChessState(ctx, args.sessionId);
		if (state.phase !== "active") {
			throw new ConvexError("No active game");
		}
		const color = getParticipantColor(state, args.participantId);
		const clock = getClock(state);
		if (!clock) {
			throw new ConvexError("This game is untimed");
		}
		const now = Date.now();
		if (
			state.activeColor === color ||
			!hasFlagFallen(clock, state.activeColor, now)
		) {
			throw new ConvexError("Your opponent still has time");
		}
		await finishGame(ctx, state, "timeout", color, now);
	},
});

export const rematch = mutation({
	args: {
		sessionId: v.id("gameSessions"),
		participantId: v.id("sessionParticipants"),
	},
	handler: async (ctx, args) => {
		const { state } = await getChessState(ctx, args.sessionId);
		if (state.phase !== "finished") {
			throw new ConvexError("The current game is not finished");
		}
		getParticipantColor(state, args.participantId);
		const now = Date.now();
		const initialSeconds =
			CHESS_TIME_CONTROLS[state.timeControl as ChessTimeControl]
				.initialSeconds;
		// Swap colors for the rematch.
		const white = state.blackParticipantId;
		const black = state.whiteParticipantId;
		if (white) {
			await ctx.db.patch(white, { seat: "white" });
		}
		if (black) {
			await ctx.db.patch(black, { seat: "black" });
		}
		await ctx.db.patch(state._id, {
			phase: "active",
			whiteParticipantId: white,
			blackParticipantId: black,
			fen: CHESS_INITIAL_FEN,
			sanHistory: [],
			activeColor: "white",
			remainingWhiteMs: initialSeconds ? initialSeconds * 1000 : undefined,
			remainingBlackMs: initialSeconds ? initialSeconds * 1000 : undefined,
			turnStartedAt: initialSeconds ? now : undefined,
			drawOfferBy: undefined,
			resultOutcome: undefined,
			resultWinner: undefined,
			winnerParticipantId: undefined,
			updatedAt: now,
		});
		await ctx.db.patch(args.sessionId, {
			status: "active",
			endedAt: undefined,
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
			.query("chessGameStates")
			.withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
			.unique();
		return { session, participants, state };
	},
});
