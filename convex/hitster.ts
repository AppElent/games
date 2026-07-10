import { ConvexError, v } from "convex/values";
import {
	applyHitsterTokenDelta,
	evaluateHitsterRound,
	getHitsterCoopOutcome,
	getHitsterModeConfig,
	type HitsterAnswerFlags,
	type HitsterMode,
	hitsterStealRequirementMet,
	matchesHitsterArtist,
	matchesHitsterTitle,
	shuffleHitsterDeck,
	validateHitsterPlacement,
} from "../src/lib/games/hitster";
import {
	buildSpotifySearchUrl,
	getHitsterCard,
	getPlayableHitsterCards,
} from "../src/lib/games/hitsterPacks";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { completeSession } from "./lib/completion";
import { hitsterModeValidator, hitsterPlaybackModeValidator } from "./schema";

type Ctx = MutationCtx | QueryCtx;

async function getSessionAndState(ctx: Ctx, sessionId: Id<"gameSessions">) {
	const session = await ctx.db.get(sessionId);
	if (!session || session.gameType !== "hitster") {
		throw new ConvexError("Hitster game not found");
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
		throw new ConvexError("You are not part of this game");
	}
	return participant;
}

function requireHost(
	session: Doc<"gameSessions">,
	participantId: Id<"sessionParticipants">,
) {
	if (session.hostParticipantId !== participantId) {
		throw new ConvexError("Only the host can do this");
	}
}

function timelineYears(
	packId: string,
	cardIds: string[],
): number[] {
	return cardIds.map((cardId) => {
		const card = getHitsterCard(packId, cardId);
		if (!card) {
			throw new ConvexError("Unknown card in timeline");
		}
		return card.releaseYear;
	});
}

function findTimeline(
	state: Doc<"hitsterGameStates">,
	participantId: Id<"sessionParticipants">,
) {
	const shared = getHitsterModeConfig(state.mode as HitsterMode).shared;
	const timeline = shared
		? state.timelines[0]
		: state.timelines.find((entry) => entry.participantId === participantId);
	if (!timeline) {
		throw new ConvexError("Timeline not found");
	}
	return timeline;
}

function evaluateAnswerFlags(
	state: Doc<"hitsterGameStates">,
	guess: {
		participantId: Id<"sessionParticipants">;
		dropIndex: number;
		artistGuess?: string;
		titleGuess?: string;
		yearGuess?: number;
	},
	cardId: string,
): HitsterAnswerFlags {
	const card = getHitsterCard(state.packId, cardId);
	if (!card) {
		throw new ConvexError("Card not found");
	}
	const timeline = findTimeline(state, guess.participantId);
	const years = timelineYears(state.packId, timeline.cardIds);
	return {
		placementCorrect: validateHitsterPlacement(
			years,
			guess.dropIndex,
			card.releaseYear,
		),
		artistCorrect: guess.artistGuess
			? matchesHitsterArtist(guess.artistGuess, card.artistNames)
			: false,
		titleCorrect: guess.titleGuess
			? matchesHitsterTitle(guess.titleGuess, card.title)
			: false,
		yearCorrect: guess.yearGuess === card.releaseYear,
	};
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
			throw new ConvexError("Game has already started");
		}
		const playable = getPlayableHitsterCards(args.packId, args.playbackMode);
		if (playable.length < args.targetCards + 5) {
			throw new ConvexError("Not enough playable tracks for this setup");
		}
		if (args.targetCards < 3 || args.targetCards > 20) {
			throw new ConvexError("Target cards must be between 3 and 20");
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
			throw new ConvexError("Game is not ready to start");
		}
		const config = getHitsterModeConfig(state.mode as HitsterMode);
		const participants = await ctx.db
			.query("sessionParticipants")
			.withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
			.collect();
		const players = participants
			.filter((participant) => participant.role !== "watcher")
			.sort((a, b) => a._creationTime - b._creationTime);
		if (players.length < (config.shared ? 1 : 2)) {
			throw new ConvexError("Not enough players to start");
		}

		const playable = getPlayableHitsterCards(state.packId, state.playbackMode);
		const deck = shuffleHitsterDeck(playable.map((card) => card.id));
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
			throw new ConvexError("Round is not accepting guesses");
		}
		if (state.turnOrder[state.activeIndex] !== args.participantId) {
			throw new ConvexError("It is not your turn");
		}
		if (state.pendingGuess) {
			throw new ConvexError("You already locked a guess this round");
		}
		const timeline = findTimeline(state, args.participantId);
		if (args.dropIndex < 0 || args.dropIndex > timeline.cardIds.length) {
			throw new ConvexError("Invalid drop position");
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
			throw new ConvexError("Round is not accepting steal claims");
		}
		const config = getHitsterModeConfig(state.mode as HitsterMode);
		if (!config.stealsEnabled) {
			throw new ConvexError("Steals are not available in this mode");
		}
		if (state.turnOrder[state.activeIndex] === args.participantId) {
			throw new ConvexError("The active player cannot steal");
		}
		if (!state.turnOrder.includes(args.participantId)) {
			throw new ConvexError("You are not playing this game");
		}
		if (
			state.stealClaims.some(
				(claim) => claim.participantId === args.participantId,
			)
		) {
			throw new ConvexError("You already placed a steal claim this round");
		}
		const tokenEntry = state.tokens.find(
			(entry) => entry.participantId === args.participantId,
		);
		if (!tokenEntry || tokenEntry.tokens < 1) {
			throw new ConvexError("You need a token to steal");
		}
		const timeline = findTimeline(state, args.participantId);
		if (args.dropIndex < 0 || args.dropIndex > timeline.cardIds.length) {
			throw new ConvexError("Invalid drop position");
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
			throw new ConvexError("There is nothing to reveal");
		}
		const mode = state.mode as HitsterMode;
		const config = getHitsterModeConfig(mode);
		const cardId = state.currentCardId;
		const activeParticipantId = state.turnOrder[state.activeIndex];
		const guess = state.pendingGuess;

		const flags: HitsterAnswerFlags = guess
			? evaluateAnswerFlags(state, guess, cardId)
			: {
					placementCorrect: false,
					artistCorrect: false,
					titleCorrect: false,
					yearCorrect: false,
				};
		const outcome = evaluateHitsterRound(mode, flags);

		const timelines = state.timelines.map((entry) => ({
			...entry,
			cardIds: [...entry.cardIds],
		}));
		let tokens = state.tokens.map((entry) => ({ ...entry }));
		let coopTokens = state.coopTokens;
		const tokenChanges: Array<{
			participantId?: Id<"sessionParticipants">;
			delta: number;
		}> = [];

		const activeTimeline = config.shared
			? timelines[0]
			: timelines.find(
					(entry) => entry.participantId === activeParticipantId,
				);
		if (!activeTimeline) {
			throw new ConvexError("Active timeline missing");
		}

		if (outcome.cardWon && guess) {
			activeTimeline.cardIds.splice(guess.dropIndex, 0, cardId);
		}
		if (outcome.tokenDelta !== 0) {
			tokens = tokens.map((entry) => {
				if (entry.participantId !== activeParticipantId) {
					return entry;
				}
				const next = applyHitsterTokenDelta(
					entry.tokens,
					outcome.tokenDelta,
					config.tokenCap,
				);
				if (next !== entry.tokens) {
					tokenChanges.push({
						participantId: activeParticipantId,
						delta: next - entry.tokens,
					});
				}
				return { ...entry, tokens: next };
			});
		}
		if (config.shared && !outcome.cardWon && coopTokens !== undefined) {
			coopTokens = Math.max(0, coopTokens - 1);
			tokenChanges.push({ participantId: undefined, delta: -1 });
		}

		// Steal claims already paid their token on submission; report the spend
		// and resolve the card if the active player missed.
		const stealResults: Array<{
			participantId: Id<"sessionParticipants">;
			correct: boolean;
			wonCard: boolean;
		}> = [];
		let cardWonBy: Id<"sessionParticipants"> | undefined = outcome.cardWon
			? activeParticipantId
			: undefined;
		if (config.stealsEnabled && state.stealClaims.length > 0) {
			const sortedClaims = [...state.stealClaims].sort(
				(a, b) => a.submittedAt - b.submittedAt,
			);
			let stolen = false;
			for (const claim of sortedClaims) {
				const claimFlags = evaluateAnswerFlags(state, claim, cardId);
				const qualifies = hitsterStealRequirementMet(mode, claimFlags);
				const wins = !outcome.cardWon && !stolen && qualifies;
				if (wins) {
					stolen = true;
					cardWonBy = claim.participantId;
					const claimTimeline = timelines.find(
						(entry) => entry.participantId === claim.participantId,
					);
					claimTimeline?.cardIds.splice(claim.dropIndex, 0, cardId);
				}
				tokenChanges.push({ participantId: claim.participantId, delta: -1 });
				stealResults.push({
					participantId: claim.participantId,
					correct: qualifies,
					wonCard: wins,
				});
			}
		}

		const recap = {
			roundNumber: state.roundNumber,
			cardId,
			activeParticipantId,
			placementCorrect: flags.placementCorrect,
			artistCorrect: guess?.artistGuess !== undefined ? flags.artistCorrect : undefined,
			titleCorrect: guess?.titleGuess !== undefined ? flags.titleCorrect : undefined,
			yearCorrect: guess?.yearGuess !== undefined ? flags.yearCorrect : undefined,
			cardWonByParticipantId: config.shared ? undefined : cardWonBy,
			cardWonByTeam: config.shared ? outcome.cardWon : undefined,
			tokenChanges,
			stealResults,
		};

		// Win / loss checks.
		let phase: "reveal" | "finished" = "reveal";
		let winnerParticipantId: Id<"sessionParticipants"> | undefined;
		let coopResult: "won" | "lost" | undefined;
		if (config.shared) {
			const status = getHitsterCoopOutcome({
				cardsOnTimeline: timelines[0].cardIds.length,
				tokens: coopTokens ?? 0,
				targetCards: state.targetCards,
			});
			if (status !== "ongoing") {
				phase = "finished";
				coopResult = status;
			}
		} else {
			const winner = timelines.find(
				(entry) => entry.cardIds.length >= state.targetCards,
			);
			if (winner?.participantId) {
				phase = "finished";
				winnerParticipantId = winner.participantId;
			}
		}

		const now = Date.now();
		await ctx.db.patch(state._id, {
			phase,
			timelines,
			tokens,
			coopTokens,
			lastRecap: recap,
			winnerParticipantId,
			coopResult,
			updatedAt: now,
		});
		if (phase === "finished") {
			await completeSession(ctx, args.sessionId, {
				endedAt: now,
				winnerParticipantIds: winnerParticipantId ? [winnerParticipantId] : [],
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
			throw new ConvexError("Finish the reveal first");
		}
		const deck = [...state.deck];
		const currentCardId = deck.pop();
		const now = Date.now();
		if (!currentCardId) {
			// Deck exhausted: longest timeline wins (competitive) or coop loses.
			const config = getHitsterModeConfig(state.mode as HitsterMode);
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
