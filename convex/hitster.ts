import { v } from "convex/values";
import {
	getHitsterModeConfig,
	HITSTER_SPARE_TRACKS,
	HITSTER_TARGET_CARDS_RANGE,
	hitsterMinPlayers,
	hitsterTimelineFor,
} from "@arcadeclub/core/hitster";
import {
	buildSpotifySearchUrl,
	getHitsterCard,
	getPlayableHitsterCards,
} from "@arcadeclub/core/hitster-packs";
import { resolveHitsterReveal } from "@arcadeclub/core/hitster-reveal";
import { shuffle } from "@arcadeclub/core/random";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { completeSession } from "./lib/completion";
import { hitsterModeValidator, hitsterPlaybackModeValidator } from "./schema";
import { gameError, toGameError } from "./lib/errors";

type Ctx = MutationCtx | QueryCtx;

async function getSessionAndState(ctx: Ctx, sessionId: Id<"gameSessions">) {
	const session = await ctx.db.get(sessionId);
	if (!session || session.gameType !== "hitster") {
		throw gameError("gameNotFound");
	}
	const state = await ctx.db
		.query("hitsterGameStates")
		.withIndex("by_session", (q) => q.eq("sessionId", sessionId))
		.unique();
	return { session, state };
}

async function requireParticipant(
	ctx: Ctx,
	sessionId: Id<"gameSessions">,
	participantId: Id<"sessionParticipants">,
) {
	const participant = await ctx.db.get(participantId);
	if (
		!participant ||
		participant.sessionId !== sessionId ||
		participant.kickedAt
	) {
		throw gameError("notInGame");
	}
	return participant;
}

function requireHost(
	session: Doc<"gameSessions">,
	participantId: Id<"sessionParticipants">,
) {
	if (session.hostParticipantId !== participantId) {
		throw gameError("hostOnly");
	}
}

function findTimeline(
	state: Doc<"hitsterGameStates">,
	participantId: Id<"sessionParticipants">,
) {
	const timeline = hitsterTimelineFor(state, participantId);
	if (!timeline) {
		throw gameError("timelineNotFound");
	}
	return timeline;
}

export const setup = mutation({
	args: {
		sessionId: v.id("gameSessions"),
		participantId: v.id("sessionParticipants"),
		mode: hitsterModeValidator,
		packId: v.string(),
		targetCards: v.number(),
		turnTimerSeconds: v.optional(v.number()),
		playbackMode: hitsterPlaybackModeValidator,
	},
	handler: async (ctx, args) => {
		const { session, state } = await getSessionAndState(ctx, args.sessionId);
		await requireParticipant(ctx, args.sessionId, args.participantId);
		requireHost(session, args.participantId);
		if (session.status !== "lobby") {
			throw gameError("gameAlreadyStarted");
		}
		const playable = getPlayableHitsterCards(args.packId, args.playbackMode);
		if (playable.length < args.targetCards + HITSTER_SPARE_TRACKS) {
			throw gameError("notEnoughTracks");
		}
		if (
			args.targetCards < HITSTER_TARGET_CARDS_RANGE.min ||
			args.targetCards > HITSTER_TARGET_CARDS_RANGE.max
		) {
			throw gameError("targetCardsRange");
		}
		const now = Date.now();
		const fields = {
			mode: args.mode,
			packId: args.packId,
			targetCards: args.targetCards,
			turnTimerSeconds: args.turnTimerSeconds,
			playbackMode: args.playbackMode,
			updatedAt: now,
		};
		if (state) {
			await ctx.db.patch(state._id, fields);
			return state._id;
		}
		return await ctx.db.insert("hitsterGameStates", {
			sessionId: args.sessionId,
			...fields,
			phase: "lobby",
			deck: [],
			roundNumber: 0,
			turnOrder: [],
			activeIndex: 0,
			timelines: [],
			tokens: [],
			stealClaims: [],
			createdAt: now,
		});
	},
});

export const start = mutation({
	args: {
		sessionId: v.id("gameSessions"),
		participantId: v.id("sessionParticipants"),
	},
	handler: async (ctx, args) => {
		const { session, state } = await getSessionAndState(ctx, args.sessionId);
		await requireParticipant(ctx, args.sessionId, args.participantId);
		requireHost(session, args.participantId);
		if (!state || state.phase !== "lobby") {
			throw gameError("gameNotReady");
		}
		const config = getHitsterModeConfig(state.mode);
		const participants = await ctx.db
			.query("sessionParticipants")
			.withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
			.collect();
		const players = participants
			.filter((participant) => participant.role !== "watcher")
			.sort((a, b) => a._creationTime - b._creationTime);
		if (players.length < hitsterMinPlayers(config)) {
			throw gameError("notEnoughPlayers");
		}

		const playable = getPlayableHitsterCards(state.packId, state.playbackMode);
		const deck = shuffle(playable.map((card) => card.id));
		const turnOrder = players.map((player) => player._id);

		// Deal one revealed start card per timeline, then draw the first
		// mystery card.
		const timelines = config.shared
			? [{ participantId: undefined, cardIds: [deck.pop() as string] }]
			: turnOrder.map((participantId) => ({
					participantId,
					cardIds: [deck.pop() as string],
				}));
		const currentCardId = deck.pop();
		const now = Date.now();

		await ctx.db.patch(state._id, {
			phase: "nowPlaying",
			deck,
			roundNumber: 1,
			currentCardId,
			roundStartedAt: now,
			turnOrder,
			activeIndex: 0,
			timelines,
			tokens: config.shared
				? []
				: turnOrder.map((participantId) => ({
						participantId,
						tokens: config.startTokens,
					})),
			coopTokens: config.shared ? config.startTokens : undefined,
			pendingGuess: undefined,
			stealClaims: [],
			lastRecap: undefined,
			updatedAt: now,
		});
		await ctx.db.patch(args.sessionId, { status: "active", startedAt: now });
	},
});

export const submitGuess = mutation({
	args: {
		sessionId: v.id("gameSessions"),
		participantId: v.id("sessionParticipants"),
		dropIndex: v.number(),
		artistGuess: v.optional(v.string()),
		titleGuess: v.optional(v.string()),
		yearGuess: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const { state } = await getSessionAndState(ctx, args.sessionId);
		await requireParticipant(ctx, args.sessionId, args.participantId);
		if (!state || state.phase !== "nowPlaying") {
			throw gameError("guessesClosed");
		}
		if (state.turnOrder[state.activeIndex] !== args.participantId) {
			throw gameError("notYourTurn");
		}
		if (state.pendingGuess) {
			throw gameError("guessAlreadyLocked");
		}
		const timeline = findTimeline(state, args.participantId);
		if (args.dropIndex < 0 || args.dropIndex > timeline.cardIds.length) {
			throw gameError("invalidDropPosition");
		}
		await ctx.db.patch(state._id, {
			pendingGuess: {
				participantId: args.participantId,
				dropIndex: args.dropIndex,
				artistGuess: args.artistGuess,
				titleGuess: args.titleGuess,
				yearGuess: args.yearGuess,
				submittedAt: Date.now(),
			},
			updatedAt: Date.now(),
		});
	},
});

export const submitSteal = mutation({
	args: {
		sessionId: v.id("gameSessions"),
		participantId: v.id("sessionParticipants"),
		dropIndex: v.number(),
		artistGuess: v.optional(v.string()),
		titleGuess: v.optional(v.string()),
		yearGuess: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const { state } = await getSessionAndState(ctx, args.sessionId);
		await requireParticipant(ctx, args.sessionId, args.participantId);
		if (!state || state.phase !== "nowPlaying") {
			throw gameError("stealsClosed");
		}
		const config = getHitsterModeConfig(state.mode);
		if (!config.stealsEnabled) {
			throw gameError("stealsUnavailable");
		}
		if (state.turnOrder[state.activeIndex] === args.participantId) {
			throw gameError("activePlayerCannotSteal");
		}
		if (!state.turnOrder.includes(args.participantId)) {
			throw gameError("notPlaying");
		}
		if (
			state.stealClaims.some(
				(claim) => claim.participantId === args.participantId,
			)
		) {
			throw gameError("stealAlreadyClaimed");
		}
		const tokenEntry = state.tokens.find(
			(entry) => entry.participantId === args.participantId,
		);
		if (!tokenEntry || tokenEntry.tokens < 1) {
			throw gameError("stealNeedsToken");
		}
		const timeline = findTimeline(state, args.participantId);
		if (args.dropIndex < 0 || args.dropIndex > timeline.cardIds.length) {
			throw gameError("invalidDropPosition");
		}
		await ctx.db.patch(state._id, {
			tokens: state.tokens.map((entry) =>
				entry.participantId === args.participantId
					? { ...entry, tokens: entry.tokens - 1 }
					: entry,
			),
			stealClaims: [
				...state.stealClaims,
				{
					participantId: args.participantId,
					dropIndex: args.dropIndex,
					artistGuess: args.artistGuess,
					titleGuess: args.titleGuess,
					yearGuess: args.yearGuess,
					submittedAt: Date.now(),
				},
			],
			updatedAt: Date.now(),
		});
	},
});

export const reveal = mutation({
	args: {
		sessionId: v.id("gameSessions"),
		participantId: v.id("sessionParticipants"),
	},
	handler: async (ctx, args) => {
		const { session, state } = await getSessionAndState(ctx, args.sessionId);
		await requireParticipant(ctx, args.sessionId, args.participantId);
		requireHost(session, args.participantId);
		if (!state || state.phase !== "nowPlaying" || !state.currentCardId) {
			throw gameError("nothingToReveal");
		}
		let revealed: ReturnType<
			typeof resolveHitsterReveal<Id<"sessionParticipants">>
		>;
		try {
			revealed = resolveHitsterReveal(state, state.currentCardId);
		} catch (caught) {
			throw toGameError(caught);
		}
		const now = Date.now();
		await ctx.db.patch(state._id, { ...revealed, updatedAt: now });
		if (revealed.phase === "finished") {
			await completeSession(ctx, args.sessionId, {
				endedAt: now,
				winnerParticipantIds: revealed.winnerParticipantId
					? [revealed.winnerParticipantId]
					: [],
			});
		}
	},
});

export const nextRound = mutation({
	args: {
		sessionId: v.id("gameSessions"),
		participantId: v.id("sessionParticipants"),
	},
	handler: async (ctx, args) => {
		const { session, state } = await getSessionAndState(ctx, args.sessionId);
		await requireParticipant(ctx, args.sessionId, args.participantId);
		requireHost(session, args.participantId);
		if (!state || state.phase !== "reveal") {
			throw gameError("finishRevealFirst");
		}
		const deck = [...state.deck];
		const currentCardId = deck.pop();
		const now = Date.now();
		if (!currentCardId) {
			// Deck exhausted: longest timeline wins (competitive) or coop loses.
			const config = getHitsterModeConfig(state.mode);
			const leader = config.shared
				? undefined
				: [...state.timelines].sort(
						(a, b) => b.cardIds.length - a.cardIds.length,
					)[0];
			await ctx.db.patch(state._id, {
				phase: "finished",
				deck,
				currentCardId: undefined,
				winnerParticipantId: leader?.participantId,
				coopResult: config.shared ? "lost" : undefined,
				updatedAt: now,
			});
			await completeSession(ctx, args.sessionId, {
				endedAt: now,
				winnerParticipantIds: leader?.participantId
					? [leader.participantId]
					: [],
			});
			return;
		}
		await ctx.db.patch(state._id, {
			phase: "nowPlaying",
			deck,
			roundNumber: state.roundNumber + 1,
			currentCardId,
			roundStartedAt: now,
			activeIndex: (state.activeIndex + 1) % state.turnOrder.length,
			pendingGuess: undefined,
			stealClaims: [],
			updatedAt: now,
		});
	},
});

export const getBundle = query({
	args: {
		sessionId: v.id("gameSessions"),
		participantId: v.optional(v.id("sessionParticipants")),
	},
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
			.query("hitsterGameStates")
			.withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
			.unique();
		if (!state) {
			return { session, participants, state: null, hostPlayback: null };
		}

		const revealed = state.phase === "reveal" || state.phase === "finished";
		const isHost =
			args.participantId !== undefined &&
			session.hostParticipantId === args.participantId;

		// Never ship the deck order; hide the mystery card and other players'
		// written answers until reveal.
		const { deck, ...shared } = state;
		const publicState = {
			...shared,
			deckRemaining: deck.length,
			currentCardId: revealed ? state.currentCardId : undefined,
			pendingGuess: state.pendingGuess
				? revealed || state.pendingGuess.participantId === args.participantId
					? state.pendingGuess
					: {
							participantId: state.pendingGuess.participantId,
							dropIndex: state.pendingGuess.dropIndex,
							submittedAt: state.pendingGuess.submittedAt,
						}
				: undefined,
			stealClaims: state.stealClaims.map((claim) =>
				revealed || claim.participantId === args.participantId
					? claim
					: {
							participantId: claim.participantId,
							dropIndex: claim.dropIndex,
							submittedAt: claim.submittedAt,
						},
			),
		};

		const hostPlayback =
			isHost && state.currentCardId && state.phase === "nowPlaying"
				? (() => {
						const card = getHitsterCard(state.packId, state.currentCardId);
						return card
							? {
									title: card.title,
									artistNames: card.artistNames,
									spotifySearchUrl: buildSpotifySearchUrl(card),
									previewUrl: card.previewUrl,
								}
							: null;
					})()
				: null;

		return { session, participants, state: publicState, hostPlayback };
	},
});
