import {
	applyChessMove,
	CHESS_INITIAL_FEN,
	hasFlagFallen,
	initialClock,
	runningClock,
	tickClockAfterMove,
} from "@arcadeclub/chess/chess";
import {
	CHESS_COLORS,
	CHESS_HOST_COLORS,
	CHESS_PROMOTIONS,
	type ChessColor,
	type ChessOutcome,
} from "@arcadeclub/chess/enums";
import { type ObjectType, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import {
	CHESS_DUEL,
	finishDuel,
	rematchDuel,
	requireResign,
	requireSeat,
	requireTurn,
	seatHost,
} from "./lib/duel";
import { gameError, rules } from "./lib/errors";
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
import { literals } from "./lib/validators";
import { chessTimeControlValidator } from "./schema";

async function finishGame(
	ctx: MutationCtx,
	state: Doc<"chessGameStates">,
	outcome: ChessOutcome,
	winner: ChessColor | undefined,
	now: number,
) {
	await finishDuel(
		ctx,
		state,
		winner,
		{ resultOutcome: outcome, resultWinner: winner, drawOfferBy: undefined },
		now,
	);
}

const matchArgs = {
	timeControl: chessTimeControlValidator,
	hostColor: literals(CHESS_HOST_COLORS),
};

async function insertState(
	ctx: MutationCtx,
	sessionId: Id<"gameSessions">,
	hostParticipantId: Id<"sessionParticipants">,
	match: ObjectType<typeof matchArgs>,
) {
	const hostColor =
		match.hostColor === "random"
			? CHESS_COLORS[Math.random() < 0.5 ? 0 : 1]
			: match.hostColor;
	const hostSeat = await seatHost(
		ctx,
		CHESS_DUEL,
		hostParticipantId,
		hostColor,
	);
	const now = Date.now();
	return await ctx.db.insert("chessGameStates", {
		sessionId,
		phase: "waiting",
		...hostSeat,
		fen: CHESS_INITIAL_FEN,
		sanHistory: [],
		activeColor: "white",
		timeControl: match.timeControl,
		...initialClock(match.timeControl),
		createdAt: now,
		updatedAt: now,
	});
}

export const create = mutation({
	args: { ...hostedSessionArgs, ...matchArgs },
	returns: createdSessionValidator,
	handler: async (ctx, args) => {
		const hosted = await hostGame(ctx, "chess", args);
		await insertState(ctx, hosted.session._id, hosted.participantId, args);
		return createdSession(hosted);
	},
});

export const applyMove = mutation({
	args: {
		...seatArgs,
		from: v.string(),
		to: v.string(),
		promotion: v.optional(literals(CHESS_PROMOTIONS)),
	},
	handler: async (ctx, args) => {
		const { session, state } = await loadGame(ctx, "chess", args.sessionId);
		await requireOwnParticipant(ctx, args);
		const color = requireTurn(CHESS_DUEL, state, args.participantId);
		const now = Date.now();

		let clock = runningClock(state);
		if (clock && hasFlagFallen(clock, color, now)) {
			throw gameError("timeRanOut");
		}

		const outcome = rules(() =>
			applyChessMove(state.fen, {
				from: args.from,
				to: args.to,
				promotion: args.promotion,
			}),
		);

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
		await startSession(ctx, session, now);
		if (outcome.result) {
			await finishGame(
				ctx,
				state,
				outcome.result.outcome,
				"winner" in outcome.result ? outcome.result.winner : undefined,
				now,
			);
		}
	},
});

export const resign = mutation({
	args: seatArgs,
	handler: async (ctx, args) => {
		const { state } = await loadGame(ctx, "chess", args.sessionId);
		await requireOwnParticipant(ctx, args);
		const winner = requireResign(CHESS_DUEL, state, args.participantId);
		await finishGame(ctx, state, "resignation", winner, Date.now());
	},
});

export const offerDraw = mutation({
	args: seatArgs,
	handler: async (ctx, args) => {
		const { state } = await loadGame(ctx, "chess", args.sessionId);
		await requireOwnParticipant(ctx, args);
		if (state.phase !== "active") {
			throw gameError("noActiveGame");
		}
		const color = requireSeat(CHESS_DUEL, state, args.participantId);
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
		...seatArgs,
		accept: v.boolean(),
	},
	handler: async (ctx, args) => {
		const { state } = await loadGame(ctx, "chess", args.sessionId);
		await requireOwnParticipant(ctx, args);
		if (state.phase !== "active" || !state.drawOfferBy) {
			throw gameError("noDrawOffer");
		}
		const color = requireSeat(CHESS_DUEL, state, args.participantId);
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
	args: seatArgs,
	handler: async (ctx, args) => {
		const { state } = await loadGame(ctx, "chess", args.sessionId);
		await requireOwnParticipant(ctx, args);
		if (state.phase !== "active") {
			throw gameError("noActiveGame");
		}
		const color = requireSeat(CHESS_DUEL, state, args.participantId);
		const clock = runningClock(state);
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
	args: seatArgs,
	handler: async (ctx, args) => {
		const { state } = await loadGame(ctx, "chess", args.sessionId);
		await requireOwnParticipant(ctx, args);
		await rematchDuel(ctx, CHESS_DUEL, state, args.participantId, (now) => {
			const clock = initialClock(state.timeControl);
			return {
				phase: "active",
				fen: CHESS_INITIAL_FEN,
				sanHistory: [],
				activeColor: "white",
				...clock,
				turnStartedAt: clock.remainingWhiteMs === undefined ? undefined : now,
				drawOfferBy: undefined,
				resultOutcome: undefined,
				resultWinner: undefined,
			};
		});
	},
});

export const getBundle = query({
	args: { sessionId: v.id("gameSessions") },
	handler: async (ctx, args) => {
		return await loadBundle(ctx, "chess", args.sessionId);
	},
});
