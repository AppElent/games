import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const gameTypeValidator = v.union(
	v.literal("live-quiz"),
	v.literal("backgammon"),
	v.literal("sudoku"),
	v.literal("chess"),
	v.literal("hitster"),
	v.literal("word-games"),
);

export const joinModeValidator = v.union(
	v.literal("room"),
	v.literal("challenge"),
	v.literal("solo"),
);

export const authPolicyValidator = v.union(
	v.literal("guestAllowed"),
	v.literal("signedInRequired"),
	v.literal("hostChoice"),
);

export const sessionStatusValidator = v.union(
	v.literal("lobby"),
	v.literal("active"),
	v.literal("completed"),
	v.literal("cancelled"),
);

export const participantRoleValidator = v.union(
	v.literal("host"),
	v.literal("player"),
	v.literal("watcher"),
);

export const quizPhaseValidator = v.union(
	v.literal("lobby"),
	v.literal("question"),
	v.literal("reveal"),
	v.literal("scoreboard"),
	v.literal("finished"),
);

export const quizQuestionValidator = v.object({
	id: v.string(),
	prompt: v.string(),
	choices: v.array(
		v.object({
			id: v.string(),
			label: v.string(),
		}),
	),
	correctChoiceIds: v.array(v.string()),
	durationSeconds: v.number(),
	points: v.number(),
});

export const backgammonColorValidator = v.union(
	v.literal("white"),
	v.literal("black"),
);

export const backgammonPhaseValidator = v.union(
	v.literal("waiting"),
	v.literal("ready"),
	v.literal("active"),
	v.literal("finished"),
);

export const backgammonMoveTypeValidator = v.union(
	v.literal("roll"),
	v.literal("move"),
	v.literal("endTurn"),
);

export const backgammonPointValidator = v.object({
	point: v.number(),
	color: v.optional(backgammonColorValidator),
	count: v.number(),
});

export const backgammonCountersValidator = v.object({
	white: v.number(),
	black: v.number(),
});

export const hitsterModeValidator = v.union(
	v.literal("instant"),
	v.literal("original"),
	v.literal("pro"),
	v.literal("expert"),
	v.literal("coop"),
);

export const hitsterPhaseValidator = v.union(
	v.literal("lobby"),
	v.literal("nowPlaying"),
	v.literal("reveal"),
	v.literal("finished"),
);

export const hitsterPlaybackModeValidator = v.union(
	v.literal("hostDevice"),
	v.literal("preview"),
);

export const hitsterGuessValidator = v.object({
	participantId: v.id("sessionParticipants"),
	dropIndex: v.number(),
	artistGuess: v.optional(v.string()),
	titleGuess: v.optional(v.string()),
	yearGuess: v.optional(v.number()),
	submittedAt: v.number(),
});

export const hitsterTimelineValidator = v.object({
	// Undefined participantId marks the shared cooperative timeline.
	participantId: v.optional(v.id("sessionParticipants")),
	cardIds: v.array(v.string()),
});

export const hitsterTokensValidator = v.object({
	participantId: v.id("sessionParticipants"),
	tokens: v.number(),
});

export const hitsterRecapValidator = v.object({
	roundNumber: v.number(),
	cardId: v.string(),
	activeParticipantId: v.id("sessionParticipants"),
	placementCorrect: v.boolean(),
	artistCorrect: v.optional(v.boolean()),
	titleCorrect: v.optional(v.boolean()),
	yearCorrect: v.optional(v.boolean()),
	cardWonByParticipantId: v.optional(v.id("sessionParticipants")),
	cardWonByTeam: v.optional(v.boolean()),
	tokenChanges: v.array(
		v.object({
			participantId: v.optional(v.id("sessionParticipants")),
			delta: v.number(),
		}),
	),
	stealResults: v.array(
		v.object({
			participantId: v.id("sessionParticipants"),
			correct: v.boolean(),
			wonCard: v.boolean(),
		}),
	),
});

export default defineSchema({
	gameSessions: defineTable({
		gameType: gameTypeValidator,
		status: sessionStatusValidator,
		joinMode: joinModeValidator,
		authPolicy: authPolicyValidator,
		title: v.string(),
		hostUserId: v.optional(v.string()),
		hostParticipantId: v.optional(v.id("sessionParticipants")),
		joinCode: v.optional(v.string()),
		shareToken: v.optional(v.string()),
		settings: v.optional(
			v.record(v.string(), v.union(v.string(), v.number(), v.boolean())),
		),
		startedAt: v.optional(v.number()),
		endedAt: v.optional(v.number()),
	})
		.index("by_joinCode", ["joinCode"])
		.index("by_shareToken", ["shareToken"])
		.index("by_hostUser", ["hostUserId"])
		.index("by_game_status", ["gameType", "status"]),

	sessionParticipants: defineTable({
		sessionId: v.id("gameSessions"),
		userId: v.optional(v.string()),
		guestId: v.optional(v.string()),
		displayName: v.string(),
		role: participantRoleValidator,
		seat: v.optional(v.string()),
		connected: v.boolean(),
		lastSeen: v.number(),
	})
		.index("by_session", ["sessionId"])
		.index("by_session_seat", ["sessionId", "seat"])
		.index("by_user", ["userId"])
		.index("by_guest", ["guestId"]),

	quizSets: defineTable({
		ownerUserId: v.optional(v.string()),
		title: v.string(),
		description: v.optional(v.string()),
		questions: v.array(quizQuestionValidator),
		isSample: v.boolean(),
	}).index("by_owner", ["ownerUserId"]),

	liveQuizStates: defineTable({
		sessionId: v.id("gameSessions"),
		quizSetId: v.optional(v.id("quizSets")),
		phase: quizPhaseValidator,
		currentQuestionIndex: v.number(),
		questionStartedAt: v.optional(v.number()),
		showCorrectAnswer: v.boolean(),
	})
		.index("by_session", ["sessionId"])
		.index("by_quizSet", ["quizSetId"]),

	liveQuizAnswers: defineTable({
		sessionId: v.id("gameSessions"),
		participantId: v.id("sessionParticipants"),
		questionId: v.string(),
		selectedChoiceIds: v.array(v.string()),
		correct: v.boolean(),
		score: v.number(),
		answeredAt: v.number(),
	})
		.index("by_session", ["sessionId"])
		.index("by_session_question", ["sessionId", "questionId"])
		.index("by_participant", ["participantId"]),

	backgammonGameStates: defineTable({
		sessionId: v.id("gameSessions"),
		phase: backgammonPhaseValidator,
		whiteParticipantId: v.optional(v.id("sessionParticipants")),
		blackParticipantId: v.optional(v.id("sessionParticipants")),
		activeColor: backgammonColorValidator,
		points: v.array(backgammonPointValidator),
		bar: backgammonCountersValidator,
		off: backgammonCountersValidator,
		dice: v.array(v.number()),
		usedDice: v.array(v.number()),
		winnerParticipantId: v.optional(v.id("sessionParticipants")),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index("by_session", ["sessionId"])
		.index("by_white", ["whiteParticipantId"])
		.index("by_black", ["blackParticipantId"])
		.index("by_phase", ["phase"]),

	hitsterGameStates: defineTable({
		sessionId: v.id("gameSessions"),
		mode: hitsterModeValidator,
		packId: v.string(),
		targetCards: v.number(),
		turnTimerSeconds: v.optional(v.number()),
		playbackMode: hitsterPlaybackModeValidator,
		phase: hitsterPhaseValidator,
		deck: v.array(v.string()),
		roundNumber: v.number(),
		currentCardId: v.optional(v.string()),
		roundStartedAt: v.optional(v.number()),
		turnOrder: v.array(v.id("sessionParticipants")),
		activeIndex: v.number(),
		timelines: v.array(hitsterTimelineValidator),
		tokens: v.array(hitsterTokensValidator),
		coopTokens: v.optional(v.number()),
		pendingGuess: v.optional(hitsterGuessValidator),
		stealClaims: v.array(hitsterGuessValidator),
		lastRecap: v.optional(hitsterRecapValidator),
		coopResult: v.optional(v.union(v.literal("won"), v.literal("lost"))),
		winnerParticipantId: v.optional(v.id("sessionParticipants")),
		createdAt: v.number(),
		updatedAt: v.number(),
	}).index("by_session", ["sessionId"]),

	backgammonMoves: defineTable({
		sessionId: v.id("gameSessions"),
		participantId: v.id("sessionParticipants"),
		moveType: backgammonMoveTypeValidator,
		color: backgammonColorValidator,
		from: v.optional(v.union(v.number(), v.literal("bar"))),
		to: v.optional(v.union(v.number(), v.literal("off"))),
		dice: v.array(v.number()),
		createdAt: v.number(),
	})
		.index("by_session", ["sessionId"])
		.index("by_participant", ["participantId"]),
});
