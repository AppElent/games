import { type ObjectType, v } from "convex/values";
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
import { chessTimeControlValidator } from "./schema";
import {
	CHESS_DUEL,
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
import { literals } from "./lib/validators";

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
	const winnerParticipantId = winnerOf(state, winner);
	await finishSession(
		ctx,
		state,
		{
			phase: "finished",
			resultOutcome: outcome,
			resultWinner: winner,
			winnerParticipantId,
			drawOfferBy: undefined,
			updatedAt: now,
		},
		{ now, winners: [winnerParticipantId] },
	);
}

const matchArgs = {
	timeControl: chessTimeControlValidator,
	hostColor: literals([...CHESS_COLORS, "random"]),
};

async function insertState(
	ctx: MutationCtx,
	sessionId: Id<"gameSessions">,
	hostParticipantId: Id<"sessionParticipants">,
	match: ObjectType<typeof matchArgs>,
) {
	const hostColor: ChessColor =
		match.hostColor === "random"
			? Math.random() < 0.5
				? "white"
				: "black"
			: match.hostColor;
	await ctx.db.patch(hostParticipantId, { seat: hostColor });
	const now = Date.now();
	return await ctx.db.insert("chessGameStates", {
		sessionId,
		phase: "waiting",
		whiteParticipantId: hostColor === "white" ? hostParticipantId : undefined,
		blackParticipantId: hostColor === "black" ? hostParticipantId : undefined,
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
		const hosted = await createHostedSession(ctx, {
			...args,
			gameType: "chess",
			joinMode: "challenge",
			authPolicy: "guestAllowed",
		});
		await insertState(ctx, hosted.sessionId, hosted.participantId, args);
		return hosted;
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
		const { session, state } = await loadGame(ctx, "chess", args.sessionId);
		const color = requireTurn(CHESS_DUEL, state, args.participantId);
		const now = Date.now();

		let clock = state.phase === "active" ? getClock(state) : undefined;
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
	args: {
		sessionId: v.id("gameSessions"),
		participantId: v.id("sessionParticipants"),
	},
	handler: async (ctx, args) => {
		const { state } = await loadGame(ctx, "chess", args.sessionId);
		if (state.phase === "finished") {
			throw gameError("gameAlreadyFinished");
		}
		const color = requireSeat(CHESS_DUEL, state, args.participantId);
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
		const { state } = await loadGame(ctx, "chess", args.sessionId);
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
		sessionId: v.id("gameSessions"),
		participantId: v.id("sessionParticipants"),
		accept: v.boolean(),
	},
	handler: async (ctx, args) => {
		const { state } = await loadGame(ctx, "chess", args.sessionId);
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
	args: {
		sessionId: v.id("gameSessions"),
		participantId: v.id("sessionParticipants"),
	},
	handler: async (ctx, args) => {
		const { state } = await loadGame(ctx, "chess", args.sessionId);
		if (state.phase !== "active") {
			throw gameError("noActiveGame");
		}
		const color = requireSeat(CHESS_DUEL, state, args.participantId);
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
		const { state } = await loadGame(ctx, "chess", args.sessionId);
		requireRematch(CHESS_DUEL, state, args.participantId);
		const now = Date.now();
		const clock = initialClock(state.timeControl);
		const seats = await swapSeats(ctx, CHESS_DUEL, state);
		await ctx.db.patch(state._id, {
			phase: "active",
			...seats,
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
		const participants = await listParticipants(ctx, args.sessionId);
		const state = await findGameState(ctx, "chess", args.sessionId);
		return { session, participants, state };
	},
});
