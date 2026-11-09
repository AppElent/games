/** The end of a Hitster round: judge the answers, hand out the card, check for a winner. */
import { GameRuleError } from "./errors";
import {
	applyHitsterTokenDelta,
	evaluateHitsterRound,
	getHitsterCoopOutcome,
	getHitsterModeConfig,
	type HitsterAnswerFlags,
	type HitsterMode,
	hitsterTimelineFor,
	matchesHitsterArtist,
	matchesHitsterTitle,
	resolveHitsterSteals,
	validateHitsterPlacement,
} from "./hitster";
import { getHitsterCard } from "./hitster-packs";

type HitsterAnswer<P extends string> = {
	participantId: P;
	dropIndex: number;
	artistGuess?: string;
	titleGuess?: string;
	yearGuess?: number;
	submittedAt: number;
};

type HitsterTimeline<P extends string> = {
	participantId?: P;
	cardIds: string[];
};

type HitsterRevealState<P extends string> = {
	mode: HitsterMode;
	packId: string;
	targetCards: number;
	roundNumber: number;
	turnOrder: P[];
	activeIndex: number;
	timelines: HitsterTimeline<P>[];
	tokens: Array<{ participantId: P; tokens: number }>;
	coopTokens?: number;
	pendingGuess?: HitsterAnswer<P>;
	stealClaims: HitsterAnswer<P>[];
};

const NO_ANSWER: HitsterAnswerFlags = {
	placementCorrect: false,
	artistCorrect: false,
	titleCorrect: false,
	yearCorrect: false,
};

/** Judges an answer against the timeline its player placed the card on. */
function evaluateAnswer<P extends string>(
	state: HitsterRevealState<P>,
	answer: HitsterAnswer<P>,
	cardId: string,
): HitsterAnswerFlags {
	const card = getHitsterCard(state.packId, cardId);
	if (!card) {
		throw new GameRuleError("cardNotFound");
	}
	const timeline = hitsterTimelineFor(state, answer.participantId);
	if (!timeline) {
		throw new GameRuleError("timelineNotFound");
	}
	const years = timeline.cardIds.map((id) => {
		const placed = getHitsterCard(state.packId, id);
		if (!placed) {
			throw new GameRuleError("unknownTimelineCard");
		}
		return placed.releaseYear;
	});
	return {
		placementCorrect: validateHitsterPlacement(
			years,
			answer.dropIndex,
			card.releaseYear,
		),
		artistCorrect: answer.artistGuess
			? matchesHitsterArtist(answer.artistGuess, card.artistNames)
			: false,
		titleCorrect: answer.titleGuess
			? matchesHitsterTitle(answer.titleGuess, card.title)
			: false,
		yearCorrect: answer.yearGuess === card.releaseYear,
	};
}

/** The state after revealing `cardId`, the card being played this round. */
export function resolveHitsterReveal<P extends string>(
	state: HitsterRevealState<P>,
	cardId: string,
) {
	const { mode } = state;
	const config = getHitsterModeConfig(mode);
	const activeParticipantId = state.turnOrder[state.activeIndex];
	const guess = state.pendingGuess;

	const flags = guess ? evaluateAnswer(state, guess, cardId) : NO_ANSWER;
	const outcome = evaluateHitsterRound(mode, flags);

	const timelines = state.timelines.map((entry) => ({
		...entry,
		cardIds: [...entry.cardIds],
	}));
	let tokens = state.tokens.map((entry) => ({ ...entry }));
	let coopTokens = state.coopTokens;
	const tokenChanges: Array<{ participantId?: P; delta: number }> = [];

	const activeTimeline = hitsterTimelineFor(
		{ mode, timelines },
		activeParticipantId,
	);
	if (!activeTimeline) {
		throw new GameRuleError("timelineNotFound");
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
		participantId: P;
		correct: boolean;
		wonCard: boolean;
	}> = [];
	let cardWonBy = outcome.cardWon ? activeParticipantId : undefined;
	if (config.stealsEnabled && state.stealClaims.length > 0) {
		for (const { claim, correct, wonCard } of resolveHitsterSteals(
			mode,
			outcome.cardWon,
			state.stealClaims,
			(claim) => evaluateAnswer(state, claim, cardId),
		)) {
			if (wonCard) {
				cardWonBy = claim.participantId;
				timelines
					.find((entry) => entry.participantId === claim.participantId)
					?.cardIds.splice(claim.dropIndex, 0, cardId);
			}
			tokenChanges.push({ participantId: claim.participantId, delta: -1 });
			stealResults.push({
				participantId: claim.participantId,
				correct,
				wonCard,
			});
		}
	}

	const lastRecap = {
		roundNumber: state.roundNumber,
		cardId,
		activeParticipantId,
		placementCorrect: flags.placementCorrect,
		artistCorrect:
			guess?.artistGuess !== undefined ? flags.artistCorrect : undefined,
		titleCorrect:
			guess?.titleGuess !== undefined ? flags.titleCorrect : undefined,
		yearCorrect: guess?.yearGuess !== undefined ? flags.yearCorrect : undefined,
		cardWonByParticipantId: config.shared ? undefined : cardWonBy,
		cardWonByTeam: config.shared ? outcome.cardWon : undefined,
		tokenChanges,
		stealResults,
	};

	let phase: "reveal" | "finished" = "reveal";
	let winnerParticipantId: P | undefined;
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

	return {
		phase,
		timelines,
		tokens,
		coopTokens,
		lastRecap,
		winnerParticipantId,
		coopResult,
	};
}
