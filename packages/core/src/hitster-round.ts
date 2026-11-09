/** The start of a Hitster game and the move to its next round. */
import { GameRuleError } from "./errors";
import {
	getHitsterModeConfig,
	type HitsterMode,
	hitsterMinPlayers,
} from "./hitster";
import { type Rng, shuffle } from "./random";

/**
 * Shuffles `cardIds` into a deck, deals each timeline (one shared timeline in
 * co-op) a revealed start card, draws the first mystery card and hands out
 * the mode's tokens. The players take turns in the order given.
 */
export function startHitsterGame<P extends string>(
	mode: HitsterMode,
	cardIds: readonly string[],
	players: readonly P[],
	rng: Rng = Math.random,
) {
	const config = getHitsterModeConfig(mode);
	if (players.length < hitsterMinPlayers(config)) {
		throw new GameRuleError("notEnoughPlayers");
	}
	const deck = shuffle(cardIds, rng);
	const turnOrder = [...players];
	const timelines: Array<{ participantId: P | undefined; cardIds: string[] }> =
		config.shared
			? [{ participantId: undefined, cardIds: [deck.pop() as string] }]
			: turnOrder.map((participantId) => ({
					participantId,
					cardIds: [deck.pop() as string],
				}));
	const currentCardId = deck.pop();
	return {
		phase: "nowPlaying" as const,
		deck,
		roundNumber: 1,
		currentCardId,
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
	};
}

/**
 * After a reveal: the next player's round with a new mystery card, or, once
 * the deck is empty, the end of the game. Then the longest timeline wins (the
 * first of equals), and a co-op team loses.
 */
export function advanceHitsterRound<P extends string>(state: {
	mode: HitsterMode;
	deck: readonly string[];
	roundNumber: number;
	turnOrder: readonly P[];
	activeIndex: number;
	timelines: ReadonlyArray<{ participantId?: P; cardIds: readonly string[] }>;
}) {
	const deck = [...state.deck];
	const currentCardId = deck.pop();
	if (!currentCardId) {
		const config = getHitsterModeConfig(state.mode);
		const leader = config.shared
			? undefined
			: [...state.timelines].sort(
					(a, b) => b.cardIds.length - a.cardIds.length,
				)[0];
		return {
			phase: "finished" as const,
			deck,
			currentCardId: undefined,
			winnerParticipantId: leader?.participantId,
			coopResult: config.shared ? ("lost" as const) : undefined,
		};
	}
	return {
		phase: "nowPlaying" as const,
		deck,
		roundNumber: state.roundNumber + 1,
		currentCardId,
		activeIndex: (state.activeIndex + 1) % state.turnOrder.length,
		pendingGuess: undefined,
		stealClaims: [],
	};
}
