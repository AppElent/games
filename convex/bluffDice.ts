import {
	BLUFF_MAX_PLAYERS,
	BLUFF_MIN_PLAYERS,
	BLUFF_STARTING_DICE,
	bluffDiceCounts,
	isClaimHigher,
	isValidBluffClaim,
	nextActiveIndex,
	resolveBluffRound,
	rollBluffDice,
} from "@arcadeclub/core/bluff-dice";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { gameError } from "./lib/errors";
import {
	findGameState,
	finishSession,
	listPlayersIncludingKicked,
	loadBundle,
	loadGame,
	reopenSession,
	requireHostByParticipantId,
	requireParticipant,
	startSession,
} from "./lib/gameSession";
import {
	createdSession,
	createdSessionValidator,
	hostedSessionArgs,
	hostGame,
} from "./lib/hostedSession";

function requireActive(
	state: Doc<"bluffDiceStates">,
	participantId: Id<"sessionParticipants">,
) {
	if (state.phase !== "claim") {
		throw gameError("noActiveRound");
	}
	if (state.turnOrder[state.activeIndex] !== participantId) {
		throw gameError("notYourTurn");
	}
}

async function insertState(ctx: MutationCtx, sessionId: Id<"gameSessions">) {
	const now = Date.now();
	return await ctx.db.insert("bluffDiceStates", {
		sessionId,
		phase: "lobby",
		turnOrder: [],
		hands: [],
		activeIndex: 0,
		roundNumber: 0,
		claimHistory: [],
		createdAt: now,
		updatedAt: now,
	});
}

export const create = mutation({
	args: hostedSessionArgs,
	returns: createdSessionValidator,
	handler: async (ctx, args) => {
		const hosted = await hostGame(ctx, "bluff-dice", args);
		await insertState(ctx, hosted.session._id);
		return createdSession(hosted);
	},
});

export const start = mutation({
	args: {
		sessionId: v.id("gameSessions"),
		participantId: v.id("sessionParticipants"),
	},
	handler: async (ctx, args) => {
		const { session, state } = await loadGame(
			ctx,
			"bluff-dice",
			args.sessionId,
		);
		if (state.phase !== "lobby") {
			throw gameError("gameAlreadyStarted");
		}
		requireHostByParticipantId(session, args.participantId, "hostOnlyStart");
		const players = await listPlayersIncludingKicked(ctx, args.sessionId);
		if (players.length < BLUFF_MIN_PLAYERS) {
			throw gameError("needTwoPlayers");
		}
		if (players.length > BLUFF_MAX_PLAYERS) {
			throw gameError("bluffDiceMaxPlayers");
		}
		const now = Date.now();
		await ctx.db.patch(state._id, {
			phase: "claim",
			turnOrder: players.map((player) => player._id),
			hands: players.map((player) => ({
				participantId: player._id,
				values: rollBluffDice(BLUFF_STARTING_DICE),
			})),
			activeIndex: 0,
			roundNumber: 1,
			claimHistory: [],
			lastReveal: undefined,
			winnerParticipantId: undefined,
			updatedAt: now,
		});
		await startSession(ctx, session, now);
	},
});

export const submitClaim = mutation({
	args: {
		sessionId: v.id("gameSessions"),
		participantId: v.id("sessionParticipants"),
		quantity: v.number(),
		face: v.number(),
	},
	handler: async (ctx, args) => {
		const { state } = await loadGame(ctx, "bluff-dice", args.sessionId);
		requireActive(state, args.participantId);
		const totalDice = state.hands.reduce(
			(sum, hand) => sum + hand.values.length,
			0,
		);
		const claim = { quantity: args.quantity, face: args.face };
		if (!isValidBluffClaim(claim, totalDice)) {
			throw gameError("claimImpossible");
		}
		const previous = state.claimHistory.at(-1);
		if (previous && !isClaimHigher(previous, claim)) {
			throw gameError("claimMustOutrank");
		}
		const diceCounts = bluffDiceCounts(state.turnOrder, state.hands);
		await ctx.db.patch(state._id, {
			claimHistory: [
				...state.claimHistory,
				{ ...claim, byParticipantId: args.participantId },
			],
			activeIndex: nextActiveIndex(diceCounts, state.activeIndex),
			updatedAt: Date.now(),
		});
	},
});

export const challenge = mutation({
	args: {
		sessionId: v.id("gameSessions"),
		participantId: v.id("sessionParticipants"),
	},
	handler: async (ctx, args) => {
		const { state } = await loadGame(ctx, "bluff-dice", args.sessionId);
		requireActive(state, args.participantId);
		const claim = state.claimHistory.at(-1);
		if (!claim) {
			throw gameError("noClaimToChallenge");
		}
		const round = resolveBluffRound(state, claim, args.participantId);
		const now = Date.now();
		const resolved = { ...round, updatedAt: now };
		if (round.winnerParticipantId !== undefined) {
			await finishSession(ctx, state, resolved, {
				now,
				winners: [round.winnerParticipantId],
			});
		} else {
			await ctx.db.patch(state._id, resolved);
		}
	},
});

export const rematch = mutation({
	args: {
		sessionId: v.id("gameSessions"),
		participantId: v.id("sessionParticipants"),
	},
	handler: async (ctx, args) => {
		const { session, state } = await loadGame(
			ctx,
			"bluff-dice",
			args.sessionId,
		);
		if (state.phase !== "finished") {
			throw gameError("currentGameNotFinished");
		}
		requireHostByParticipantId(session, args.participantId, "hostOnlyRematch");
		const now = Date.now();
		await ctx.db.patch(state._id, {
			phase: "claim",
			hands: state.turnOrder.map((participantId) => ({
				participantId,
				values: rollBluffDice(BLUFF_STARTING_DICE),
			})),
			activeIndex: 0,
			roundNumber: 1,
			claimHistory: [],
			lastReveal: undefined,
			winnerParticipantId: undefined,
			updatedAt: now,
		});
		await reopenSession(ctx, args.sessionId);
	},
});

/**
 * Public bundle: dice values are stripped — only per-player counts are
 * exposed. Full hands appear only inside lastReveal (already public).
 */
export const getBundle = query({
	args: { sessionId: v.id("gameSessions") },
	handler: async (ctx, args) => {
		const bundle = await loadBundle(ctx, "bluff-dice", args.sessionId);
		if (!bundle) {
			return null;
		}
		const { session, participants, state } = bundle;
		if (!state) {
			return { session, participants, state: null };
		}
		const { hands, ...publicState } = state;
		return {
			session,
			participants,
			state: {
				...publicState,
				diceCounts: hands.map((hand) => ({
					participantId: hand.participantId,
					count: hand.values.length,
				})),
			},
		};
	},
});

/** The requesting participant's own dice. */
export const getMyDice = query({
	args: {
		sessionId: v.id("gameSessions"),
		participantId: v.id("sessionParticipants"),
	},
	handler: async (ctx, args) => {
		await requireParticipant(ctx, args.sessionId, args.participantId);
		const state = await findGameState(ctx, "bluff-dice", args.sessionId);
		if (!state) {
			return null;
		}
		return (
			state.hands.find((hand) => hand.participantId === args.participantId)
				?.values ?? null
		);
	},
});
