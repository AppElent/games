import {
	calculateAnswerScore,
	getNextQuizPhase,
	isCorrectAnswer,
	summarizeScores,
} from "@arcadeclub/core/quiz";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { getOptionalUserId, requireOwned, requireUserId } from "./lib/auth";
import { gameError } from "./lib/errors";
import {
	findGameState,
	finishSession,
	loadBundle,
	loadSession,
	requireParticipant,
	startSession,
} from "./lib/gameSession";
import {
	createdSession,
	createdSessionValidator,
	hostedSessionArgs,
	hostGame,
} from "./lib/hostedSession";
import { quizQuestionValidator } from "./schema";

const SAMPLE_QUESTIONS = [
	{
		id: "q1",
		prompt: "Which planet is known as the Red Planet?",
		choices: [
			{ id: "a", label: "Mars" },
			{ id: "b", label: "Venus" },
			{ id: "c", label: "Jupiter" },
			{ id: "d", label: "Mercury" },
		],
		correctChoiceIds: ["a"],
		durationSeconds: 20,
		points: 1000,
	},
	{
		id: "q2",
		prompt: "What does CSS stand for?",
		choices: [
			{ id: "a", label: "Computer Style Sheets" },
			{ id: "b", label: "Cascading Style Sheets" },
			{ id: "c", label: "Creative Screen Syntax" },
			{ id: "d", label: "Color Script System" },
		],
		correctChoiceIds: ["b"],
		durationSeconds: 20,
		points: 1000,
	},
	{
		id: "q3",
		prompt: "How many points are on a standard backgammon board?",
		choices: [
			{ id: "a", label: "16" },
			{ id: "b", label: "20" },
			{ id: "c", label: "24" },
			{ id: "d", label: "28" },
		],
		correctChoiceIds: ["c"],
		durationSeconds: 20,
		points: 1000,
	},
];

export const ensureSampleSet = mutation({
	args: {},
	handler: async (ctx) => {
		const existing = await ctx.db
			.query("quizSets")
			.filter((q) => q.eq(q.field("isSample"), true))
			.first();
		if (existing) {
			return existing._id;
		}
		return await ctx.db.insert("quizSets", {
			title: "Starter Quiz",
			description: "A tiny sample quiz for testing the live room flow.",
			questions: SAMPLE_QUESTIONS,
			isSample: true,
		});
	},
});

export const createSet = mutation({
	args: {
		title: v.string(),
		description: v.optional(v.string()),
		questions: v.array(quizQuestionValidator),
	},
	handler: async (ctx, args) => {
		const ownerUserId = await requireUserId(ctx);
		return await ctx.db.insert("quizSets", {
			ownerUserId,
			title: args.title,
			description: args.description,
			questions: args.questions,
			isSample: false,
		});
	},
});

export const updateSet = mutation({
	args: {
		quizSetId: v.id("quizSets"),
		title: v.string(),
		description: v.optional(v.string()),
		questions: v.array(quizQuestionValidator),
	},
	handler: async (ctx, args) => {
		const ownerUserId = await requireUserId(ctx);
		requireOwned(
			await ctx.db.get(args.quizSetId),
			ownerUserId,
			"quizSetNotFound",
		);
		await ctx.db.patch(args.quizSetId, {
			title: args.title,
			description: args.description,
			questions: args.questions,
		});
	},
});

export const deleteSet = mutation({
	args: { quizSetId: v.id("quizSets") },
	handler: async (ctx, args) => {
		const ownerUserId = await requireUserId(ctx);
		requireOwned(
			await ctx.db.get(args.quizSetId),
			ownerUserId,
			"quizSetNotFound",
		);
		await ctx.db.delete(args.quizSetId);
	},
});

export const getSet = query({
	args: { quizSetId: v.id("quizSets") },
	handler: async (ctx, args) => {
		const quizSet = await ctx.db.get(args.quizSetId);
		if (!quizSet) {
			return null;
		}
		// Sample sets are public; owned sets are private to their owner.
		if (!quizSet.isSample) {
			const userId = await getOptionalUserId(ctx);
			if (!userId || quizSet.ownerUserId !== userId) {
				return null;
			}
		}
		return quizSet;
	},
});

export const listSampleSets = query({
	args: {},
	handler: async (ctx) => {
		return await ctx.db
			.query("quizSets")
			.filter((q) => q.eq(q.field("isSample"), true))
			.collect();
	},
});

export const listMine = query({
	args: {},
	handler: async (ctx) => {
		const ownerUserId = await requireUserId(ctx);
		return await ctx.db
			.query("quizSets")
			.withIndex("by_owner", (q) => q.eq("ownerUserId", ownerUserId))
			.collect();
	},
});

async function insertLobbyState(
	ctx: MutationCtx,
	sessionId: Id<"gameSessions">,
	quizSetId: Id<"quizSets">,
) {
	return await ctx.db.insert("liveQuizStates", {
		sessionId,
		quizSetId,
		phase: "lobby",
		currentQuestionIndex: 0,
		showCorrectAnswer: false,
	});
}

export const create = mutation({
	args: { ...hostedSessionArgs, quizSetId: v.id("quizSets") },
	returns: createdSessionValidator,
	handler: async (ctx, args) => {
		const hosted = await hostGame(ctx, "live-quiz", args);
		if (!(await ctx.db.get(args.quizSetId))) {
			throw gameError("quizSetNotFound");
		}
		await insertLobbyState(ctx, hosted.session._id, args.quizSetId);
		return createdSession(hosted);
	},
});

export const advancePhase = mutation({
	args: { sessionId: v.id("gameSessions") },
	handler: async (ctx, args) => {
		const quizState = await findGameState(ctx, "live-quiz", args.sessionId);
		if (!quizState) {
			throw gameError("quizNotPrepared");
		}
		const quizSet = quizState.quizSetId
			? await ctx.db.get(quizState.quizSetId)
			: null;
		if (!quizSet) {
			throw gameError("quizSetNotFound");
		}

		const now = Date.now();
		const next = getNextQuizPhase(quizState, quizSet.questions.length, now);
		if (!next) {
			return "finished";
		}
		if (quizState.phase === "lobby") {
			await startSession(
				ctx,
				await loadSession(ctx, "live-quiz", args.sessionId),
				now,
			);
		}
		if (next.phase === "finished") {
			const answers = await ctx.db
				.query("liveQuizAnswers")
				.withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
				.collect();
			await finishSession(ctx, quizState, next, {
				now,
				winners: summarizeScores(answers).winners,
			});
		} else {
			await ctx.db.patch(quizState._id, next);
		}
		return next.phase;
	},
});

export const submitAnswer = mutation({
	args: {
		sessionId: v.id("gameSessions"),
		participantId: v.id("sessionParticipants"),
		selectedChoiceIds: v.array(v.string()),
	},
	handler: async (ctx, args) => {
		const participant = await requireParticipant(
			ctx,
			args.sessionId,
			args.participantId,
			"participantNotFound",
		);
		if (participant.role === "watcher") {
			throw gameError("spectatorsCannotAnswer");
		}
		const quizState = await findGameState(ctx, "live-quiz", args.sessionId);
		if (quizState?.phase !== "question" || !quizState.quizSetId) {
			throw gameError("questionClosed");
		}
		const quizSet = await ctx.db.get(quizState.quizSetId);
		const question = quizSet?.questions[quizState.currentQuestionIndex];
		if (!question) {
			throw gameError("questionNotFound");
		}

		const existingAnswers = await ctx.db
			.query("liveQuizAnswers")
			.withIndex("by_participant", (q) =>
				q.eq("participantId", args.participantId),
			)
			.collect();
		const existing = existingAnswers.find(
			(answer) =>
				answer.sessionId === args.sessionId &&
				answer.questionId === question.id,
		);
		if (existing) {
			return {
				answerId: existing._id,
				correct: existing.correct,
				score: existing.score,
			};
		}

		const answeredAt = Date.now();
		const correct = isCorrectAnswer(
			args.selectedChoiceIds,
			question.correctChoiceIds,
		);
		const score = calculateAnswerScore({
			correct,
			basePoints: question.points,
			answeredInMs: quizState.questionStartedAt
				? answeredAt - quizState.questionStartedAt
				: undefined,
			questionDurationMs: question.durationSeconds * 1000,
		});
		const answerId = await ctx.db.insert("liveQuizAnswers", {
			sessionId: args.sessionId,
			participantId: args.participantId,
			questionId: question.id,
			selectedChoiceIds: args.selectedChoiceIds,
			correct,
			score,
			answeredAt,
		});
		return { answerId, correct, score };
	},
});

export const getBundle = query({
	args: { sessionId: v.id("gameSessions") },
	handler: async (ctx, args) => {
		const bundle = await loadBundle(ctx, "live-quiz", args.sessionId);
		if (!bundle) {
			return null;
		}
		const { session, participants, state: quizState } = bundle;
		const quizSet = quizState?.quizSetId
			? await ctx.db.get(quizState.quizSetId)
			: null;
		const answers = await ctx.db
			.query("liveQuizAnswers")
			.withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
			.collect();
		return { session, participants, quizState, quizSet, answers };
	},
});
