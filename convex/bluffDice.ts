import { ConvexError, v } from "convex/values";
import {
	BLUFF_MAX_PLAYERS,
	BLUFF_MIN_PLAYERS,
	BLUFF_STARTING_DICE,
	getBluffWinnerIndex,
	isClaimHigher,
	isValidBluffClaim,
	nextActiveIndex,
	resolveBluffChallenge,
	rollBluffDice,
} from "../src/lib/games/bluff-dice";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { completeSession, reopenSession } from "./lib/completion";

async function getState(ctx: MutationCtx, sessionId: Id<"gameSessions">) {
	const session = await ctx.db.get(sessionId);
	if (!session || session.gameType !== "bluff-dice") {
		throw new ConvexError("Bluff Dice game not found");
	}
	const state = await ctx.db
		.query("bluffDiceStates")
		.withIndex("by_session", (q) => q.eq("sessionId", sessionId))
		.unique();
	if (!state) {
		throw new ConvexError("Bluff Dice game not found");
	}
	return { session, state };
}

async function requireParticipant(
	ctx: MutationCtx | QueryCtx,
	sessionId: Id<"gameSessions">,
	participantId: Id<"sessionParticipants">,
) {
	const participant = await ctx.db.get(participantId);
	if (
		!participant ||
		participant.sessionId !== sessionId ||
		participant.kickedAt
	) {
		throw new ConvexError("You are not part of this game");
	}
	return participant;
}

function requireActive(
	state: Doc<"bluffDiceStates">,
	participantId: Id<"sessionParticipants">,
) {
	if (state.phase !== "claim") {
		throw new ConvexError("No active round");
	}
	if (state.turnOrder[state.activeIndex] !== participantId) {
		throw new ConvexError("It is not your turn");
	}
}

export const createState = mutation({
	args: {
		sessionId: v.id("gameSessions"),
		hostParticipantId: v.id("sessionParticipants"),
	},
	handler: async (ctx, args) => {
		const session = await ctx.db.get(args.sessionId);
		if (!session || session.gameType !== "bluff-dice") {
			throw new ConvexError("Bluff Dice session not found");
		}
		const existing = await ctx.db
			.query("bluffDiceStates")
			.withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
			.unique();
		if (existing) {
			return existing._id;
		}
		const now = Date.now();
		return await ctx.db.insert("bluffDiceStates", {
			sessionId: args.sessionId,
			phase: "lobby",
			turnOrder: [],
			hands: [],
			activeIndex: 0,
			roundNumber: 0,
			claimHistory: [],
			createdAt: now,
			updatedAt: now,
		});
	},
});

export const start = mutation({
	args: {
		sessionId: v.id("gameSessions"),
		participantId: v.id("sessionParticipants"),
	},
	handler: async (ctx, args) => {
		const { session, state } = await getState(ctx, args.sessionId);
		if (state.phase !== "lobby") {
			throw new ConvexError("The game has already started");
		}
		if (session.hostParticipantId !== args.participantId) {
			throw new ConvexError("Only the host can start the game");
		}
		const participants = await ctx.db
			.query("sessionParticipants")
			.withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
			.collect();
		const players = participants.filter(
			(participant) => participant.role !== "watcher",
		);
		if (players.length < BLUFF_MIN_PLAYERS) {
			throw new ConvexError("Need at least 2 players");
		}
		if (players.length > BLUFF_MAX_PLAYERS) {
			throw new ConvexError("Bluff Dice supports up to 8 players");
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
		await ctx.db.patch(args.sessionId, {
			status: "active",
			startedAt: session.startedAt ?? now,
			endedAt: undefined,
		});
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
		const { state } = await getState(ctx, args.sessionId);
		requireActive(state, args.participantId);
		const totalDice = state.hands.reduce(
			(sum, hand) => sum + hand.values.length,
			0,
		);
		const claim = { quantity: args.quantity, face: args.face };
		if (!isValidBluffClaim(claim, totalDice)) {
			throw new ConvexError("That claim is not possible");
		}
		const previous = state.claimHistory.at(-1);
		if (previous && !isClaimHigher(previous, claim)) {
			throw new ConvexError("Your claim must outrank the previous claim");
		}
		const diceCounts = state.turnOrder.map(
			(participantId) =>
				state.hands.find((hand) => hand.participantId === participantId)
					?.values.length ?? 0,
		);
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
		const { state } = await getState(ctx, args.sessionId);
		requireActive(state, args.participantId);
		const claim = state.claimHistory.at(-1);
		if (!claim) {
			throw new ConvexError("There is no claim to challenge");
		}
		const outcome = resolveBluffChallenge(
			state.hands.map((hand) => hand.values),
			claim,
		);
		const loserParticipantId =
			outcome.loser === "claimant" ? claim.byParticipantId : args.participantId;

		// Loser loses one die; re-roll everyone for the next round.
		const nextHands = state.hands.map((hand) => {
			const count =
				hand.participantId === loserParticipantId
					? hand.values.length - 1
					: hand.values.length;
			return {
				participantId: hand.participantId,
				values: rollBluffDice(Math.max(0, count)),
			};
		});
		const diceCounts = state.turnOrder.map(
			(participantId) =>
				nextHands.find((hand) => hand.participantId === participantId)?.values
					.length ?? 0,
		);
		const winnerIndex = getBluffWinnerIndex(diceCounts);
		const loserIndex = state.turnOrder.indexOf(loserParticipantId);
		// The loser starts the next round, unless they were eliminated.
		const nextIndex =
			diceCounts[loserIndex] > 0
				? loserIndex
				: nextActiveIndex(diceCounts, loserIndex);
		const now = Date.now();
		await ctx.db.patch(state._id, {
			phase: winnerIndex === undefined ? "claim" : "finished",
			hands: nextHands,
			activeIndex: nextIndex,
			roundNumber: state.roundNumber + 1,
			claimHistory: [],
			lastReveal: {
				claim,
				challengerParticipantId: args.participantId,
				actualCount: outcome.actualCount,
				loserParticipantId,
				hands: state.hands,
			},
			winnerParticipantId:
				winnerIndex === undefined ? undefined : state.turnOrder[winnerIndex],
			updatedAt: now,
		});
		if (winnerIndex !== undefined) {
			await completeSession(ctx, args.sessionId, {
				endedAt: now,
				winnerParticipantIds: [state.turnOrder[winnerIndex]],
			});
		}
	},
});

export const rematch = mutation({
	args: {
		sessionId: v.id("gameSessions"),
		participantId: v.id("sessionParticipants"),
	},
	handler: async (ctx, args) => {
		const { session, state } = await getState(ctx, args.sessionId);
		if (state.phase !== "finished") {
			throw new ConvexError("The current game is not finished");
		}
		if (session.hostParticipantId !== args.participantId) {
			throw new ConvexError("Only the host can start a rematch");
		}
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
		const session = await ctx.db.get(args.sessionId);
		if (!session) {
			return null;
		}
		const participants = await ctx.db
			.query("sessionParticipants")
			.withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
			.collect();
		const state = await ctx.db
			.query("bluffDiceStates")
			.withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
			.unique();
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
		const state = await ctx.db
			.query("bluffDiceStates")
			.withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
			.unique();
		if (!state) {
			return null;
		}
		return (
			state.hands.find((hand) => hand.participantId === args.participantId)
				?.values ?? null
		);
	},
});
