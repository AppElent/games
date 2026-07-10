import { ConvexError, v } from "convex/values";
import {
	applySignalClue,
	applySignalGuess,
	applySignalPass,
	createSignalGameState,
	generateSignalBoard,
	type SignalGameState,
} from "../src/lib/games/signal-words";
import { SIGNAL_WORDS_DEFAULT_PACK } from "../src/lib/games/signal-words-packs";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { completeSession, reopenSession } from "./lib/completion";
import { signalTeamValidator } from "./schema";

async function getState(ctx: MutationCtx, sessionId: Id<"gameSessions">) {
	const session = await ctx.db.get(sessionId);
	if (!session || session.gameType !== "signal-words") {
		throw new ConvexError("Signal Words game not found");
	}
	const state = await ctx.db
		.query("signalWordsStates")
		.withIndex("by_session", (q) => q.eq("sessionId", sessionId))
		.unique();
	if (!state) {
		throw new ConvexError("Signal Words game not found");
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

function isClueGiver(seat: string | undefined) {
	return seat === "red-clue" || seat === "blue-clue";
}

function toGameState(state: Doc<"signalWordsStates">): SignalGameState {
	return {
		phase: state.phase === "lobby" ? "clue" : state.phase,
		words: state.words,
		assignments: state.assignments,
		revealed: state.revealed,
		startingTeam: state.startingTeam,
		currentTeam: state.currentTeam,
		clueWord: state.clueWord,
		clueCount: state.clueCount,
		guessesLeft: state.guessesLeft,
		winnerTeam: state.winnerTeam,
		trapHitBy: state.trapHitBy,
	};
}

async function patchGameState(
	ctx: MutationCtx,
	state: Doc<"signalWordsStates">,
	next: SignalGameState,
	now: number,
) {
	await ctx.db.patch(state._id, {
		phase: next.phase,
		revealed: next.revealed,
		currentTeam: next.currentTeam,
		clueWord: next.clueWord,
		clueCount: next.clueCount,
		guessesLeft: next.guessesLeft,
		winnerTeam: next.winnerTeam,
		trapHitBy: next.trapHitBy,
		updatedAt: now,
	});
	if (next.phase === "finished") {
		const participants = await ctx.db
			.query("sessionParticipants")
			.withIndex("by_session", (q) => q.eq("sessionId", state.sessionId))
			.collect();
		const winners = next.winnerTeam
			? participants
					.filter((participant) => participant.seat?.startsWith(next.winnerTeam as string))
					.map((participant) => participant._id)
			: [];
		await completeSession(ctx, state.sessionId, {
			endedAt: now,
			winnerParticipantIds: winners,
		});
	}
}

export const createState = mutation({
	args: {
		sessionId: v.id("gameSessions"),
		hostParticipantId: v.id("sessionParticipants"),
	},
	handler: async (ctx, args) => {
		const session = await ctx.db.get(args.sessionId);
		if (!session || session.gameType !== "signal-words") {
			throw new ConvexError("Signal Words session not found");
		}
		const existing = await ctx.db
			.query("signalWordsStates")
			.withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
			.unique();
		if (existing) {
			return existing._id;
		}
		const now = Date.now();
		return await ctx.db.insert("signalWordsStates", {
			sessionId: args.sessionId,
			phase: "lobby",
			words: [],
			assignments: [],
			revealed: [],
			startingTeam: "red",
			currentTeam: "red",
			createdAt: now,
			updatedAt: now,
		});
	},
});

export const joinTeam = mutation({
	args: {
		sessionId: v.id("gameSessions"),
		participantId: v.id("sessionParticipants"),
		team: signalTeamValidator,
		clueGiver: v.boolean(),
	},
	handler: async (ctx, args) => {
		const { state } = await getState(ctx, args.sessionId);
		if (state.phase !== "lobby") {
			throw new ConvexError("The game has already started");
		}
		await requireParticipant(ctx, args.sessionId, args.participantId);
		const seat = args.clueGiver ? `${args.team}-clue` : args.team;
		if (args.clueGiver) {
			const participants = await ctx.db
				.query("sessionParticipants")
				.withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
				.collect();
			const taken = participants.find(
				(participant) =>
					participant.seat === seat && participant._id !== args.participantId,
			);
			if (taken) {
				throw new ConvexError(
					`${args.team === "red" ? "Red" : "Blue"} already has a clue-giver`,
				);
			}
		}
		await ctx.db.patch(args.participantId, { seat });
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
		for (const team of ["red", "blue"] as const) {
			const clueGiver = participants.some(
				(participant) => participant.seat === `${team}-clue`,
			);
			const guesser = participants.some(
				(participant) => participant.seat === team,
			);
			if (!clueGiver || !guesser) {
				throw new ConvexError(
					`Each team needs a clue-giver and at least one guesser (${team} team is not ready)`,
				);
			}
		}
		const board = generateSignalBoard(SIGNAL_WORDS_DEFAULT_PACK);
		const gameState = createSignalGameState(board);
		const now = Date.now();
		await ctx.db.patch(state._id, {
			phase: "clue",
			words: gameState.words,
			assignments: gameState.assignments,
			revealed: gameState.revealed,
			startingTeam: gameState.startingTeam,
			currentTeam: gameState.currentTeam,
			clueWord: undefined,
			clueCount: undefined,
			guessesLeft: undefined,
			winnerTeam: undefined,
			trapHitBy: undefined,
			updatedAt: now,
		});
		await ctx.db.patch(args.sessionId, {
			status: "active",
			startedAt: session.startedAt ?? now,
			endedAt: undefined,
		});
	},
});

export const submitClue = mutation({
	args: {
		sessionId: v.id("gameSessions"),
		participantId: v.id("sessionParticipants"),
		clue: v.string(),
		count: v.number(),
	},
	handler: async (ctx, args) => {
		const { state } = await getState(ctx, args.sessionId);
		if (state.phase !== "clue") {
			throw new ConvexError("Not expecting a clue right now");
		}
		const participant = await requireParticipant(
			ctx,
			args.sessionId,
			args.participantId,
		);
		if (participant.seat !== `${state.currentTeam}-clue`) {
			throw new ConvexError("Only the active team's clue-giver can send a clue");
		}
		let next: SignalGameState;
		try {
			next = applySignalClue(toGameState(state), args.clue, args.count);
		} catch (caught) {
			throw new ConvexError(
				caught instanceof Error ? caught.message : "Invalid clue",
			);
		}
		await patchGameState(ctx, state, next, Date.now());
	},
});

export const submitGuess = mutation({
	args: {
		sessionId: v.id("gameSessions"),
		participantId: v.id("sessionParticipants"),
		cardIndex: v.number(),
	},
	handler: async (ctx, args) => {
		const { state } = await getState(ctx, args.sessionId);
		if (state.phase !== "guess") {
			throw new ConvexError("Not expecting a guess right now");
		}
		const participant = await requireParticipant(
			ctx,
			args.sessionId,
			args.participantId,
		);
		if (participant.seat !== state.currentTeam) {
			throw new ConvexError("Only the active team's guessers can pick a card");
		}
		let outcome: ReturnType<typeof applySignalGuess>;
		try {
			outcome = applySignalGuess(toGameState(state), args.cardIndex);
		} catch (caught) {
			throw new ConvexError(
				caught instanceof Error ? caught.message : "Invalid guess",
			);
		}
		await patchGameState(ctx, state, outcome.state, Date.now());
	},
});

export const pass = mutation({
	args: {
		sessionId: v.id("gameSessions"),
		participantId: v.id("sessionParticipants"),
	},
	handler: async (ctx, args) => {
		const { state } = await getState(ctx, args.sessionId);
		if (state.phase !== "guess") {
			throw new ConvexError("You can only pass during a guess phase");
		}
		const participant = await requireParticipant(
			ctx,
			args.sessionId,
			args.participantId,
		);
		if (participant.seat !== state.currentTeam) {
			throw new ConvexError("Only the active team's guessers can pass");
		}
		await patchGameState(
			ctx,
			state,
			applySignalPass(toGameState(state)),
			Date.now(),
		);
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
		const board = generateSignalBoard(SIGNAL_WORDS_DEFAULT_PACK);
		const gameState = createSignalGameState(board);
		const now = Date.now();
		await ctx.db.patch(state._id, {
			phase: "clue",
			words: gameState.words,
			assignments: gameState.assignments,
			revealed: gameState.revealed,
			startingTeam: gameState.startingTeam,
			currentTeam: gameState.currentTeam,
			clueWord: undefined,
			clueCount: undefined,
			guessesLeft: undefined,
			winnerTeam: undefined,
			trapHitBy: undefined,
			updatedAt: now,
		});
		await reopenSession(ctx, args.sessionId);
	},
});

/**
 * Public bundle. The hidden key is stripped: clients only see roles of
 * revealed cards, plus the full key once the game is finished.
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
			.query("signalWordsStates")
			.withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
			.unique();
		if (!state) {
			return { session, participants, state: null };
		}
		const { assignments, ...publicState } = state;
		return {
			session,
			participants,
			state: {
				...publicState,
				revealedRoles: state.revealed.map((flag, index) =>
					flag || state.phase === "finished" ? assignments[index] : null,
				),
			},
		};
	},
});

/** The hidden key, for clue-givers only. */
export const getKey = query({
	args: {
		sessionId: v.id("gameSessions"),
		participantId: v.id("sessionParticipants"),
	},
	handler: async (ctx, args) => {
		const participant = await requireParticipant(
			ctx,
			args.sessionId,
			args.participantId,
		);
		if (!isClueGiver(participant.seat)) {
			return null;
		}
		const state = await ctx.db
			.query("signalWordsStates")
			.withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
			.unique();
		return state ? state.assignments : null;
	},
});
