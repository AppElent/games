import { type ObjectType, v } from "convex/values";
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
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { hitsterModeValidator, hitsterPlaybackModeValidator } from "./schema";
import { gameError, rules } from "./lib/errors";
import {
	createdSessionValidator,
	createHostedSession,
	hostedSessionArgs,
} from "./lib/hostedSession";
import {
	findGameState,
	finishSession,
	listParticipants,
	listPlayersIncludingKicked,
	loadSession,
	requireHostByParticipantId,
	requireParticipant,
	startSession,
} from "./lib/gameSession";

/** Hitster's state may not exist yet: `setup` creates it, and callers word its absence. */
async function getSessionAndState(
	ctx: MutationCtx,
	sessionId: Id<"gameSessions">,
) {
	const session = await loadSession(ctx, "hitster", sessionId);
	const state = await findGameState(ctx, "hitster", sessionId);
	return { session, state };
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

const gameConfigArgs = {
	mode: hitsterModeValidator,
	packId: v.string(),
	targetCards: v.number(),
	turnTimerSeconds: v.optional(v.number()),
	playbackMode: hitsterPlaybackModeValidator,
};

function checkedConfig(config: ObjectType<typeof gameConfigArgs>, now: number) {
	const playable = getPlayableHitsterCards(config.packId, config.playbackMode);
	if (playable.length < config.targetCards + HITSTER_SPARE_TRACKS) {
		throw gameError("notEnoughTracks");
	}
	if (
		config.targetCards < HITSTER_TARGET_CARDS_RANGE.min ||
		config.targetCards > HITSTER_TARGET_CARDS_RANGE.max
	) {
		throw gameError("targetCardsRange");
	}
	return {
		mode: config.mode,
		packId: config.packId,
		targetCards: config.targetCards,
		turnTimerSeconds: config.turnTimerSeconds,
		playbackMode: config.playbackMode,
		updatedAt: now,
	};
}

async function insertLobbyState(
	ctx: MutationCtx,
	sessionId: Id<"gameSessions">,
	config: ReturnType<typeof checkedConfig>,
) {
	return await ctx.db.insert("hitsterGameStates", {
		sessionId,
		...config,
		phase: "lobby",
		deck: [],
		roundNumber: 0,
		turnOrder: [],
		activeIndex: 0,
		timelines: [],
		tokens: [],
		stealClaims: [],
		createdAt: config.updatedAt,
	});
}

export const create = mutation({
	args: { ...hostedSessionArgs, ...gameConfigArgs },
	returns: createdSessionValidator,
	handler: async (ctx, args) => {
		const hosted = await createHostedSession(ctx, {
			...args,
			gameType: "hitster",
			joinMode: "room",
			authPolicy: "hostChoice",
		});
		await insertLobbyState(
			ctx,
			hosted.sessionId,
			checkedConfig(args, Date.now()),
		);
		return hosted;
	},
});

// Installed mobile builds call this: remove once no installed build predates hitster.create.
export const setup = mutation({
	args: {
		sessionId: v.id("gameSessions"),
		participantId: v.id("sessionParticipants"),
		...gameConfigArgs,
	},
	handler: async (ctx, args) => {
		const { session, state } = await getSessionAndState(ctx, args.sessionId);
		await requireParticipant(ctx, args.sessionId, args.participantId);
		requireHostByParticipantId(session, args.participantId);
		if (session.status !== "lobby") {
			throw gameError("gameAlreadyStarted");
		}
		const config = checkedConfig(args, Date.now());
		if (state) {
			await ctx.db.patch(state._id, config);
			return state._id;
		}
		return await insertLobbyState(ctx, args.sessionId, config);
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
		requireHostByParticipantId(session, args.participantId);
		if (!state || state.phase !== "lobby") {
			throw gameError("gameNotReady");
		}
		const config = getHitsterModeConfig(state.mode);
		const players = await listPlayersIncludingKicked(ctx, args.sessionId);
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
		await startSession(ctx, session, now);
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
		requireHostByParticipantId(session, args.participantId);
		if (!state || state.phase !== "nowPlaying" || !state.currentCardId) {
			throw gameError("nothingToReveal");
		}
		const { currentCardId } = state;
		const revealed = rules(() => resolveHitsterReveal(state, currentCardId));
		const now = Date.now();
		const patch = { ...revealed, updatedAt: now };
		if (revealed.phase === "finished") {
			await finishSession(ctx, state, patch, {
				now,
				winners: [revealed.winnerParticipantId],
			});
		} else {
			await ctx.db.patch(state._id, patch);
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
		requireHostByParticipantId(session, args.participantId);
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
			await finishSession(
				ctx,
				state,
				{
					phase: "finished",
					deck,
					currentCardId: undefined,
					winnerParticipantId: leader?.participantId,
					coopResult: config.shared ? "lost" : undefined,
					updatedAt: now,
				},
				{ now, winners: [leader?.participantId] },
			);
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
		const participants = await listParticipants(ctx, args.sessionId);
		const state = await findGameState(ctx, "hitster", args.sessionId);
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
