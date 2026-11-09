import { type ObjectType, v } from "convex/values";
import {
	getHitsterModeConfig,
	HITSTER_SPARE_TRACKS,
	HITSTER_TARGET_CARDS_RANGE,
	hitsterPlayerView,
} from "@arcadeclub/core/hitster";
import {
	buildSpotifySearchUrl,
	getHitsterCard,
	getPlayableHitsterCards,
} from "@arcadeclub/core/hitster-packs";
import { resolveHitsterReveal } from "@arcadeclub/core/hitster-reveal";
import {
	advanceHitsterRound,
	startHitsterGame,
} from "@arcadeclub/core/hitster-round";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { hitsterModeValidator, hitsterPlaybackModeValidator } from "./schema";
import { gameError, rules } from "./lib/errors";
import {
	createdSession,
	createdSessionValidator,
	hostedSessionArgs,
	hostGame,
} from "./lib/hostedSession";
import {
	findGameState,
	finishSession,
	listPlayersIncludingKicked,
	loadBundle,
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

function requireTimeline<T>(view: { myTimeline: T | undefined }) {
	if (!view.myTimeline) {
		throw gameError("timelineNotFound");
	}
	return view.myTimeline;
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
		const hosted = await hostGame(ctx, "hitster", args);
		await insertLobbyState(
			ctx,
			hosted.session._id,
			checkedConfig(args, Date.now()),
		);
		return createdSession(hosted);
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
		const players = await listPlayersIncludingKicked(ctx, args.sessionId);
		const playable = getPlayableHitsterCards(state.packId, state.playbackMode);
		const dealt = rules(() =>
			startHitsterGame(
				state.mode,
				playable.map((card) => card.id),
				players.map((player) => player._id),
			),
		);
		const now = Date.now();
		await ctx.db.patch(state._id, {
			...dealt,
			roundStartedAt: now,
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
		const view = hitsterPlayerView(state, args.participantId);
		if (!view.isActive) {
			throw gameError("notYourTurn");
		}
		if (state.pendingGuess) {
			throw gameError("guessAlreadyLocked");
		}
		const timeline = requireTimeline(view);
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
		const view = hitsterPlayerView(state, args.participantId);
		if (view.isActive) {
			throw gameError("activePlayerCannotSteal");
		}
		if (!view.isPlaying) {
			throw gameError("notPlaying");
		}
		if (view.hasClaimed) {
			throw gameError("stealAlreadyClaimed");
		}
		if (view.myTokens < 1) {
			throw gameError("stealNeedsToken");
		}
		const timeline = requireTimeline(view);
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
		const next = advanceHitsterRound(state);
		const now = Date.now();
		if (next.phase === "finished") {
			await finishSession(
				ctx,
				state,
				{ ...next, updatedAt: now },
				{ now, winners: [next.winnerParticipantId] },
			);
			return;
		}
		await ctx.db.patch(state._id, {
			...next,
			roundStartedAt: now,
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
		const bundle = await loadBundle(ctx, "hitster", args.sessionId);
		if (!bundle) {
			return null;
		}
		const { session, participants, state } = bundle;
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
