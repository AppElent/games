import { v } from "convex/values";
import {
	applyChessMove,
	CHESS_INITIAL_FEN,
	hasFlagFallen,
	initialClock,
	switchChessColor,
	tickClockAfterMove,
} from "@arcadeclub/chess/chess";
import {
	CHESS_COLORS,
	CHESS_PROMOTIONS,
	type ChessColor,
} from "@arcadeclub/chess/enums";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { completeSession, reopenSession } from "./lib/completion";
import { chessTimeControlValidator } from "./schema";
import { gameError, toGameError } from "./lib/errors";
import { literals } from "./lib/validators";

async function getChessState(ctx: MutationCtx, sessionId: Id<"gameSessions">) {
	const session = await ctx.db.get(sessionId);
	if (!session || session.gameType !== "chess") {
		throw gameError("gameNotFound");
	}
	const state = await ctx.db
		.query("chessGameStates")
		.withIndex("by_session", (q) => q.eq("sessionId", sessionId))
		.unique();
	if (!state) {
		throw gameError("gameNotFound");
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
	throw gameError("notSeated");
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
	await completeSession(ctx, state.sessionId, {
		endedAt: now,
		winnerParticipantIds: winnerParticipantId ? [winnerParticipantId] : [],
	});
}

export const createState = mutation({
	args: {
		sessionId: v.id("gameSessions"),
		hostParticipantId: v.id("sessionParticipants"),
		timeControl: chessTimeControlValidator,
		hostColor: literals([...CHESS_COLORS, "random"]),
	},
	handler: async (ctx, args) => {
		const session = await ctx.db.get(args.sessionId);
		if (!session || session.gameType !== "chess") {
			throw gameError("sessionNotFound");
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
			...initialClock(args.timeControl),
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
		promotion: v.optional(literals(CHESS_PROMOTIONS)),
	},
	handler: async (ctx, args) => {
		const { session, state } = await getChessState(ctx, args.sessionId);
		if (state.phase === "finished") {
			throw gameError("gameAlreadyFinished");
		}
		if (!state.whiteParticipantId || !state.blackParticipantId) {
			throw gameError("waitingForOpponent");
		}
		const color = getParticipantColor(state, args.participantId);
		if (state.activeColor !== color) {
			throw gameError("notYourTurn");
		}
		const now = Date.now();

		let clock = state.phase === "active" ? getClock(state) : undefined;
		if (clock && hasFlagFallen(clock, color, now)) {
			await finishGame(
				ctx,
				state,
				"timeout",
				switchChessColor(color),
				now,
			);
			throw gameError("timeRanOut");
		}

		let outcome: ReturnType<typeof applyChessMove>;
		try {
			outcome = applyChessMove(state.fen, {
				from: args.from,
				to: args.to,
				promotion: args.promotion,
			});
		} catch (caught) {
			throw toGameError(caught);
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
			throw gameError("gameAlreadyFinished");
		}
		const color = getParticipantColor(state, args.participantId);
		await finishGame(
			ctx,
			state,
			"resignation",
			switchChessColor(color),
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
			throw gameError("noActiveGame");
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
			throw gameError("noDrawOffer");
		}
		const color = getParticipantColor(state, args.participantId);
		if (state.drawOfferBy === color) {
			throw gameError("ownOffer");
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
			throw gameError("noActiveGame");
		}
		const color = getParticipantColor(state, args.participantId);
		const clock = getClock(state);
		if (!clock) {
			throw gameError("gameUntimed");
		}
		const now = Date.now();
		if (
			state.activeColor === color ||
			!hasFlagFallen(clock, state.activeColor, now)
		) {
			throw gameError("opponentHasTime");
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
			throw gameError("currentGameNotFinished");
		}
		getParticipantColor(state, args.participantId);
		const now = Date.now();
		const clock = initialClock(state.timeControl);
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
			...clock,
			turnStartedAt: clock.remainingWhiteMs === undefined ? undefined : now,
			drawOfferBy: undefined,
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
			.query("chessGameStates")
			.withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
			.unique();
		return { session, participants, state };
	},
});
