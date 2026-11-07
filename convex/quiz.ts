import {
	calculateAnswerScore,
	getNextQuizPhase,
	isCorrectAnswer,
	summarizeScores,
} from "@arcadeclub/core/quiz";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUserId } from "./lib/auth";
import { completeSession } from "./lib/completion";
import { quizQuestionValidator } from "./schema";
import { gameError } from "./lib/errors";

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
		const quizSet = await ctx.db.get(args.quizSetId);
		if (!quizSet || quizSet.ownerUserId !== ownerUserId) {
			throw gameError("quizSetNotFound");
		}
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
		const quizSet = await ctx.db.get(args.quizSetId);
		if (!quizSet || quizSet.ownerUserId !== ownerUserId) {
			throw gameError("quizSetNotFound");
		}
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
			const identity = await ctx.auth.getUserIdentity();
			if (!identity || quizSet.ownerUserId !== identity.subject) {
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

export const startForSession = mutation({
	args: {
		sessionId: v.id("gameSessions"),
		quizSetId: v.id("quizSets"),
	},
	handler: async (ctx, args) => {
		const session = await ctx.db.get(args.sessionId);
		if (!session || session.gameType !== "live-quiz") {
			throw gameError("sessionNotFound");
		}
		const quizSet = await ctx.db.get(args.quizSetId);
		if (!quizSet) {
			throw gameError("quizSetNotFound");
		}

		const existing = await ctx.db
			.query("liveQuizStates")
			.withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
			.unique();
		if (existing) {
			await ctx.db.patch(existing._id, {
				quizSetId: args.quizSetId,
				phase: "lobby",
				currentQuestionIndex: 0,
				questionStartedAt: undefined,
				showCorrectAnswer: false,
			});
			return existing._id;
		}
		return await ctx.db.insert("liveQuizStates", {
			sessionId: args.sessionId,
			quizSetId: args.quizSetId,
			phase: "lobby",
			currentQuestionIndex: 0,
			showCorrectAnswer: false,
		});
	},
});

export const advancePhase = mutation({
	args: { sessionId: v.id("gameSessions") },
	handler: async (ctx, args) => {
		const quizState = await ctx.db
			.query("liveQuizStates")
			.withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
			.unique();
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
		await ctx.db.patch(quizState._id, next);
		if (quizState.phase === "lobby") {
			await ctx.db.patch(args.sessionId, {
				status: "active",
				startedAt: now,
			});
		}
		if (next.phase === "finished") {
			const answers = await ctx.db
				.query("liveQuizAnswers")
				.withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
				.collect();
			await completeSession(ctx, args.sessionId, {
				endedAt: now,
				winnerParticipantIds: summarizeScores(answers).winners,
			});
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
		const participant = await ctx.db.get(args.participantId);
		if (
			!participant ||
			participant.sessionId !== args.sessionId ||
			participant.kickedAt
		) {
			throw gameError("participantNotFound");
		}
		if (participant.role === "watcher") {
			throw gameError("spectatorsCannotAnswer");
		}
		const quizState = await ctx.db
			.query("liveQuizStates")
			.withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
			.unique();
		if (!quizState || quizState.phase !== "question" || !quizState.quizSetId) {
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
				answer.sessionId === args.sessionId && answer.questionId === question.id,
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
		const session = await ctx.db.get(args.sessionId);
		if (!session) {
			return null;
		}
		const participants = await ctx.db
			.query("sessionParticipants")
			.withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
			.collect();
		const quizState = await ctx.db
			.query("liveQuizStates")
			.withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
			.unique();
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
