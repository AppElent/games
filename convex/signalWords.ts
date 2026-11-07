import { v } from "convex/values";
import {
	applySignalClue,
	applySignalGuess,
	applySignalPass,
	createSignalGameState,
	generateSignalBoard,
	isSignalClueGiver,
	type SignalGameState,
	signalSeat,
	signalSeatTeam,
} from "@arcadeclub/core/signal-words";
import { SIGNAL_WORDS_DEFAULT_PACK } from "@arcadeclub/core/signal-words-packs";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { signalTeamValidator } from "./schema";
import { gameError, rules } from "./lib/errors";
import {
	findGameState,
	finishSession,
	listParticipants,
	loadGame,
	loadSession,
	reopenSession,
	requireHostByParticipantId,
	requireParticipant,
	startSession,
} from "./lib/gameSession";
import {
	createdSessionValidator,
	createHostedSession,
	hostedSessionArgs,
} from "./lib/hostedSession";

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
	const patch = {
		phase: next.phase,
		revealed: next.revealed,
		currentTeam: next.currentTeam,
		clueWord: next.clueWord,
		clueCount: next.clueCount,
		guessesLeft: next.guessesLeft,
		winnerTeam: next.winnerTeam,
		trapHitBy: next.trapHitBy,
		updatedAt: now,
	};
	if (next.phase !== "finished") {
		await ctx.db.patch(state._id, patch);
		return;
	}
	const participants = await listParticipants(ctx, state.sessionId);
	const { winnerTeam } = next;
	const winners = winnerTeam
		? participants
				.filter((participant) => signalSeatTeam(participant.seat) === winnerTeam)
				.map((participant) => participant._id)
		: [];
	await finishSession(ctx, state, patch, { now, winners });
}

/** A new board, with everything from the previous game cleared. */
function freshBoardPatch(now: number) {
	const gameState = createSignalGameState(
		generateSignalBoard(SIGNAL_WORDS_DEFAULT_PACK),
	);
	return {
		phase: "clue" as const,
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
	};
}

async function insertState(ctx: MutationCtx, sessionId: Id<"gameSessions">) {
	const now = Date.now();
	return await ctx.db.insert("signalWordsStates", {
		sessionId,
		phase: "lobby",
		words: [],
		assignments: [],
		revealed: [],
		startingTeam: "red",
		currentTeam: "red",
		createdAt: now,
		updatedAt: now,
	});
}

export const create = mutation({
	args: hostedSessionArgs,
	returns: createdSessionValidator,
	handler: async (ctx, args) => {
		const hosted = await createHostedSession(ctx, {
			...args,
			gameType: "signal-words",
			joinMode: "room",
			authPolicy: "guestAllowed",
		});
		await insertState(ctx, hosted.sessionId);
		return hosted;
	},
});

/** @deprecated Use signalWords.create. */
export const createState = mutation({
	args: {
		sessionId: v.id("gameSessions"),
		hostParticipantId: v.id("sessionParticipants"),
	},
	handler: async (ctx, args) => {
		await loadSession(ctx, "signal-words", args.sessionId, "sessionNotFound");
		const existing = await findGameState(ctx, "signal-words", args.sessionId);
		if (existing) {
			return existing._id;
		}
		return await insertState(ctx, args.sessionId);
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
		const { state } = await loadGame(ctx, "signal-words", args.sessionId);
		if (state.phase !== "lobby") {
			throw gameError("gameAlreadyStarted");
		}
		await requireParticipant(ctx, args.sessionId, args.participantId);
		const seat = signalSeat(args.team, args.clueGiver);
		if (args.clueGiver) {
			const participants = await listParticipants(ctx, args.sessionId);
			const taken = participants.find(
				(participant) =>
					participant.seat === seat && participant._id !== args.participantId,
			);
			if (taken) {
				throw gameError(args.team === "red" ? "redHasClueGiver" : "blueHasClueGiver");
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
		const { session, state } = await loadGame(ctx, "signal-words", args.sessionId);
		if (state.phase !== "lobby") {
			throw gameError("gameAlreadyStarted");
		}
		requireHostByParticipantId(session, args.participantId, "hostOnlyStart");
		const participants = await listParticipants(ctx, args.sessionId);
		for (const team of ["red", "blue"] as const) {
			const clueGiver = participants.some(
				(participant) => participant.seat === signalSeat(team, true),
			);
			const guesser = participants.some(
				(participant) => participant.seat === signalSeat(team, false),
			);
			if (!clueGiver || !guesser) {
				throw gameError(team === "red" ? "redTeamNotReady" : "blueTeamNotReady");
			}
		}
		const now = Date.now();
		await ctx.db.patch(state._id, freshBoardPatch(now));
		await startSession(ctx, session, now);
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
		const { state } = await loadGame(ctx, "signal-words", args.sessionId);
		if (state.phase !== "clue") {
			throw gameError("notExpectingClue");
		}
		const participant = await requireParticipant(
			ctx,
			args.sessionId,
			args.participantId,
		);
		if (participant.seat !== signalSeat(state.currentTeam, true)) {
			throw gameError("clueGiverOnly");
		}
		const next = rules(() =>
			applySignalClue(toGameState(state), args.clue, args.count),
		);
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
		const { state } = await loadGame(ctx, "signal-words", args.sessionId);
		if (state.phase !== "guess") {
			throw gameError("notExpectingGuess");
		}
		const participant = await requireParticipant(
			ctx,
			args.sessionId,
			args.participantId,
		);
		if (participant.seat !== state.currentTeam) {
			throw gameError("guessersOnlyPick");
		}
		const outcome = rules(() =>
			applySignalGuess(toGameState(state), args.cardIndex),
		);
		await patchGameState(ctx, state, outcome.state, Date.now());
	},
});

export const pass = mutation({
	args: {
		sessionId: v.id("gameSessions"),
		participantId: v.id("sessionParticipants"),
	},
	handler: async (ctx, args) => {
		const { state } = await loadGame(ctx, "signal-words", args.sessionId);
		if (state.phase !== "guess") {
			throw gameError("passOnlyDuringGuess");
		}
		const participant = await requireParticipant(
			ctx,
			args.sessionId,
			args.participantId,
		);
		if (participant.seat !== state.currentTeam) {
			throw gameError("guessersOnlyPass");
		}
		await patchGameState(
			ctx,
			state,
			rules(() => applySignalPass(toGameState(state))),
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
		const { session, state } = await loadGame(ctx, "signal-words", args.sessionId);
		if (state.phase !== "finished") {
			throw gameError("currentGameNotFinished");
		}
		requireHostByParticipantId(session, args.participantId, "hostOnlyRematch");
		const now = Date.now();
		await ctx.db.patch(state._id, freshBoardPatch(now));
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
		const participants = await listParticipants(ctx, args.sessionId);
		const state = await findGameState(ctx, "signal-words", args.sessionId);
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
		if (!isSignalClueGiver(participant.seat)) {
			return null;
		}
		const state = await findGameState(ctx, "signal-words", args.sessionId);
		return state ? state.assignments : null;
	},
});
