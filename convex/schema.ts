import {
	BACKGAMMON_COLORS,
	BACKGAMMON_MOVE_TYPES,
	BACKGAMMON_PHASES,
} from "@arcadeclub/core/backgammon";
import { BLUFF_PHASES } from "@arcadeclub/core/bluff-dice";
import {
	CONNECT_FOUR_CELLS,
	CONNECT_FOUR_COLORS,
	CONNECT_FOUR_OUTCOMES,
	CONNECT_FOUR_PHASES,
} from "@arcadeclub/core/connect-four";
import { CONTENT_DRAFT_KINDS } from "@arcadeclub/core/content-drafts";
import {
	AUTH_POLICIES,
	GAME_TYPES,
	JOIN_MODES,
} from "@arcadeclub/core/games";
import {
	HITSTER_MODES,
	HITSTER_PHASES,
	HITSTER_PLAYBACK_MODES,
} from "@arcadeclub/core/hitster";
import { QUIZ_PHASES } from "@arcadeclub/core/quiz";
import {
	COMPLETED_REASONS,
	PARTICIPANT_ROLES,
	SESSION_STATUSES,
} from "@arcadeclub/core/sessions";
import {
	SIGNAL_CARD_ROLES,
	SIGNAL_PHASES,
	SIGNAL_TEAMS,
} from "@arcadeclub/core/signal-words";
import {
	SUDOKU_DIFFICULTIES,
	SUDOKU_SOURCES,
	SUDOKU_STATUSES,
	SUDOKU_VARIANTS,
} from "@arcadeclub/core/sudoku";
import {
	CHESS_COLORS,
	CHESS_OUTCOMES,
	CHESS_PHASES,
	CHESS_TIME_CONTROL_IDS,
} from "@arcadeclub/chess/enums";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { literals } from "./lib/validators";

export const gameTypeValidator = literals(GAME_TYPES);

export const contentDraftKindValidator = literals(CONTENT_DRAFT_KINDS);

const cardSeatValidator = v.object({
	/** Empty for computer players, who only have a `botIndex`. */
	participantId: v.optional(v.id("sessionParticipants")),
	/** Proves a human owns this seat. Never returned by a query. */
	secret: v.optional(v.string()),
	botIndex: v.optional(v.number()),
	/** The computer plays this seat: always for bots, on request for humans. */
	autopilot: v.boolean(),
});

const bluffPhaseValidator = literals(BLUFF_PHASES);

const bluffClaimValidator = v.object({
	quantity: v.number(),
	face: v.number(),
	byParticipantId: v.id("sessionParticipants"),
});

export const signalTeamValidator = literals(SIGNAL_TEAMS);

const signalRoleValidator = literals(SIGNAL_CARD_ROLES);

const signalPhaseValidator = literals(SIGNAL_PHASES);

const connectFourColorValidator = literals(CONNECT_FOUR_COLORS);

const connectFourCellValidator = literals(CONNECT_FOUR_CELLS);

const connectFourPhaseValidator = literals(CONNECT_FOUR_PHASES);

const connectFourOutcomeValidator = literals(CONNECT_FOUR_OUTCOMES);

export const joinModeValidator = literals(JOIN_MODES);

export const authPolicyValidator = literals(AUTH_POLICIES);

const sessionStatusValidator = literals(SESSION_STATUSES);

const completedReasonValidator = literals(COMPLETED_REASONS);

const participantRoleValidator = literals(PARTICIPANT_ROLES);

const quizPhaseValidator = literals(QUIZ_PHASES);

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

const backgammonColorValidator = literals(BACKGAMMON_COLORS);

const backgammonPhaseValidator = literals(BACKGAMMON_PHASES);

const backgammonMoveTypeValidator = literals(BACKGAMMON_MOVE_TYPES);

const backgammonPointValidator = v.object({
	point: v.number(),
	color: v.optional(backgammonColorValidator),
	count: v.number(),
});

const backgammonCountersValidator = v.object({
	white: v.number(),
	black: v.number(),
});

export const sudokuDifficultyValidator = literals(SUDOKU_DIFFICULTIES);

export const sudokuSourceValidator = literals(SUDOKU_SOURCES);

const sudokuStatusValidator = literals(SUDOKU_STATUSES);

export const sudokuVariantValidator = literals(SUDOKU_VARIANTS);

export const sudokuCageValidator = v.object({
	sum: v.number(),
	cells: v.array(v.number()),
});

export const hitsterModeValidator = literals(HITSTER_MODES);

const hitsterPhaseValidator = literals(HITSTER_PHASES);

export const hitsterPlaybackModeValidator = literals(HITSTER_PLAYBACK_MODES);

const hitsterGuessValidator = v.object({
	participantId: v.id("sessionParticipants"),
	dropIndex: v.number(),
	artistGuess: v.optional(v.string()),
	titleGuess: v.optional(v.string()),
	yearGuess: v.optional(v.number()),
	submittedAt: v.number(),
});

const hitsterTimelineValidator = v.object({
	// Undefined participantId marks the shared cooperative timeline.
	participantId: v.optional(v.id("sessionParticipants")),
	cardIds: v.array(v.string()),
});

const hitsterTokensValidator = v.object({
	participantId: v.id("sessionParticipants"),
	tokens: v.number(),
});

const hitsterRecapValidator = v.object({
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

export const chessColorValidator = literals(CHESS_COLORS);

const chessPhaseValidator = literals(CHESS_PHASES);

export const chessTimeControlValidator = literals(CHESS_TIME_CONTROL_IDS);

const chessOutcomeValidator = literals(CHESS_OUTCOMES);

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
		completedReason: v.optional(completedReasonValidator),
		participantCount: v.optional(v.number()),
		winnerParticipantIds: v.optional(v.array(v.id("sessionParticipants"))),
		rematchOfSessionId: v.optional(v.id("gameSessions")),
		locked: v.optional(v.boolean()),
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
		kickedAt: v.optional(v.number()),
	})
		.index("by_session", ["sessionId"])
		.index("by_session_seat", ["sessionId", "seat"])
		.index("by_user", ["userId"])
		.index("by_guest", ["guestId"]),

	contentDrafts: defineTable({
		ownerUserId: v.string(),
		gameType: gameTypeValidator,
		kind: contentDraftKindValidator,
		title: v.string(),
		// JSON-encoded draft payload; validated before approval.
		payload: v.string(),
		status: v.union(
			v.literal("draft"),
			v.literal("approved"),
			v.literal("rejected"),
		),
		validationErrors: v.array(v.string()),
		reviewedAt: v.optional(v.number()),
	})
		.index("by_owner", ["ownerUserId"])
		.index("by_status", ["status"]),

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

	sudokuStates: defineTable({
		sessionId: v.id("gameSessions"),
		difficulty: v.optional(sudokuDifficultyValidator),
		source: sudokuSourceValidator,
		status: sudokuStatusValidator,
		// Absent variant = classic (pre-variant rows).
		variant: v.optional(sudokuVariantValidator),
		// Killer only: cages partitioning the board.
		cages: v.optional(v.array(sudokuCageValidator)),
		// Binary only: board side length (grids are size*size chars).
		size: v.optional(v.number()),
		// 81-char strings, "0" = empty (size*size chars for binary)
		givens: v.string(),
		digits: v.string(),
		solution: v.optional(v.string()),
		// bitmask per cell, bit 0 = digit 1
		cornerNotes: v.array(v.number()),
		centerNotes: v.array(v.number()),
		colors: v.array(v.number()),
		autoCleanup: v.boolean(),
		elapsedSeconds: v.number(),
		lastResumedAt: v.optional(v.number()),
		createdAt: v.number(),
		updatedAt: v.number(),
	}).index("by_session", ["sessionId"]),

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

	chessGameStates: defineTable({
		sessionId: v.id("gameSessions"),
		phase: chessPhaseValidator,
		whiteParticipantId: v.optional(v.id("sessionParticipants")),
		blackParticipantId: v.optional(v.id("sessionParticipants")),
		fen: v.string(),
		sanHistory: v.array(v.string()),
		activeColor: chessColorValidator,
		timeControl: chessTimeControlValidator,
		remainingWhiteMs: v.optional(v.number()),
		remainingBlackMs: v.optional(v.number()),
		turnStartedAt: v.optional(v.number()),
		drawOfferBy: v.optional(chessColorValidator),
		resultOutcome: v.optional(chessOutcomeValidator),
		resultWinner: v.optional(chessColorValidator),
		winnerParticipantId: v.optional(v.id("sessionParticipants")),
		createdAt: v.number(),
		updatedAt: v.number(),
	}).index("by_session", ["sessionId"]),

	connectFourStates: defineTable({
		sessionId: v.id("gameSessions"),
		phase: connectFourPhaseValidator,
		redParticipantId: v.optional(v.id("sessionParticipants")),
		yellowParticipantId: v.optional(v.id("sessionParticipants")),
		board: v.array(connectFourCellValidator),
		activeColor: connectFourColorValidator,
		resultOutcome: v.optional(connectFourOutcomeValidator),
		resultWinner: v.optional(connectFourColorValidator),
		winnerParticipantId: v.optional(v.id("sessionParticipants")),
		createdAt: v.number(),
		updatedAt: v.number(),
	}).index("by_session", ["sessionId"]),

	signalWordsStates: defineTable({
		sessionId: v.id("gameSessions"),
		phase: signalPhaseValidator,
		words: v.array(v.string()),
		// Hidden key — only ever returned through the clue-giver query.
		assignments: v.array(signalRoleValidator),
		revealed: v.array(v.boolean()),
		startingTeam: signalTeamValidator,
		currentTeam: signalTeamValidator,
		clueWord: v.optional(v.string()),
		clueCount: v.optional(v.number()),
		guessesLeft: v.optional(v.number()),
		winnerTeam: v.optional(signalTeamValidator),
		trapHitBy: v.optional(signalTeamValidator),
		createdAt: v.number(),
		updatedAt: v.number(),
	}).index("by_session", ["sessionId"]),

	cardGameStates: defineTable({
		sessionId: v.id("gameSessions"),
		// A key of CARD_GAMES, checked in code so that a new game is config only.
		gameId: v.string(),
		options: v.array(v.string()),
		seats: v.array(cardSeatValidator),
		status: v.union(
			v.literal("lobby"),
			v.literal("playing"),
			v.literal("finished"),
		),
		// Engine state, including every hand: read it only through viewCardGame.
		// Its shape belongs to the rule family, so Convex cannot validate it here.
		game: v.optional(v.any()),
		version: v.number(),
		createdAt: v.number(),
		updatedAt: v.number(),
	}).index("by_session", ["sessionId"]),

	bluffDiceStates: defineTable({
		sessionId: v.id("gameSessions"),
		phase: bluffPhaseValidator,
		turnOrder: v.array(v.id("sessionParticipants")),
		// Private hands — only ever returned through getMyDice.
		hands: v.array(
			v.object({
				participantId: v.id("sessionParticipants"),
				values: v.array(v.number()),
			}),
		),
		activeIndex: v.number(),
		roundNumber: v.number(),
		claimHistory: v.array(bluffClaimValidator),
		lastReveal: v.optional(
			v.object({
				claim: bluffClaimValidator,
				challengerParticipantId: v.id("sessionParticipants"),
				actualCount: v.number(),
				loserParticipantId: v.id("sessionParticipants"),
				hands: v.array(
					v.object({
						participantId: v.id("sessionParticipants"),
						values: v.array(v.number()),
					}),
				),
			}),
		),
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
