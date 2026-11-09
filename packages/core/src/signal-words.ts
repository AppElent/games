import { opponent } from "./duel";
import { type GameErrorCode, GameRuleError } from "./errors";
import { type Rng, shuffle } from "./random";

export const SIGNAL_TEAMS = ["red", "blue"] as const;
export type SignalTeam = (typeof SIGNAL_TEAMS)[number];

/** A participant's seat: their team, with this suffix when they give the clues. */
export function signalSeat(team: SignalTeam, clueGiver: boolean) {
	return clueGiver ? (`${team}-clue` as const) : team;
}

export function signalSeatTeam(seat: string | undefined) {
	return SIGNAL_TEAMS.find(
		(team) =>
			seat === signalSeat(team, false) || seat === signalSeat(team, true),
	);
}

export function isSignalClueGiver(seat: string | undefined) {
	return SIGNAL_TEAMS.some((team) => seat === signalSeat(team, true));
}

export const SIGNAL_CARD_ROLES = ["red", "blue", "neutral", "trap"] as const;
export type SignalCardRole = (typeof SIGNAL_CARD_ROLES)[number];

/** Phases a stored game can be in; rules run from `clue` on, never in `lobby`. */
export const SIGNAL_PHASES = ["lobby", "clue", "guess", "finished"] as const;
type SignalPhase = Exclude<(typeof SIGNAL_PHASES)[number], "lobby">;

export const SIGNAL_BOARD_SIZE = 25;
const SIGNAL_STARTING_CARDS = 9;
const SIGNAL_SECOND_CARDS = 8;
const SIGNAL_NEUTRAL_CARDS = 7;
const SIGNAL_TRAP_CARDS = 1;

type SignalBoard = {
	words: string[];
	/** Hidden key — must never reach non-clue-giver clients. */
	assignments: SignalCardRole[];
	startingTeam: SignalTeam;
};

export type SignalGameState = {
	phase: SignalPhase;
	words: string[];
	assignments: SignalCardRole[];
	revealed: boolean[];
	startingTeam: SignalTeam;
	currentTeam: SignalTeam;
	clueWord?: string;
	clueCount?: number;
	guessesLeft?: number;
	winnerTeam?: SignalTeam;
	/** Set when the game ended because a team picked the trap tile. */
	trapHitBy?: SignalTeam;
};

/**
 * Build a 25-card board from a word pack: 9 for the starting team,
 * 8 for the other team, 7 decoys, 1 trap tile.
 */
export function generateSignalBoard(
	pack: readonly string[],
	random: Rng = Math.random,
): SignalBoard {
	const unique = [...new Set(pack.map((word) => word.trim().toUpperCase()))];
	if (unique.length < SIGNAL_BOARD_SIZE) {
		throw new Error("Word pack needs at least 25 unique words");
	}
	const words = shuffle(unique, random).slice(0, SIGNAL_BOARD_SIZE);
	const startingTeam: SignalTeam = random() < 0.5 ? "red" : "blue";
	const roles: SignalCardRole[] = [
		...Array<SignalCardRole>(SIGNAL_STARTING_CARDS).fill(startingTeam),
		...Array<SignalCardRole>(SIGNAL_SECOND_CARDS).fill(
			opponent(SIGNAL_TEAMS, startingTeam),
		),
		...Array<SignalCardRole>(SIGNAL_NEUTRAL_CARDS).fill("neutral"),
		...Array<SignalCardRole>(SIGNAL_TRAP_CARDS).fill("trap"),
	];
	return {
		words,
		assignments: shuffle(roles, random),
		startingTeam,
	};
}

export function createSignalGameState(board: SignalBoard): SignalGameState {
	return {
		phase: "clue",
		words: board.words,
		assignments: board.assignments,
		revealed: Array(SIGNAL_BOARD_SIZE).fill(false),
		startingTeam: board.startingTeam,
		currentTeam: board.startingTeam,
	};
}

type SignalClueError =
	| "emptyClue"
	| "multiWordClue"
	| "invalidCount"
	| "matchesBoardWord";

const CLUE_ERROR_CODES = {
	emptyClue: "clueEmpty",
	multiWordClue: "clueMultiWord",
	invalidCount: "clueInvalidCount",
	matchesBoardWord: "clueMatchesBoardWord",
} as const satisfies Record<SignalClueError, GameErrorCode>;

function validateSignalClue(
	state: SignalGameState,
	clue: string,
	count: number,
): SignalClueError | undefined {
	const trimmed = clue.trim();
	if (!trimmed) {
		return "emptyClue";
	}
	if (/\s/.test(trimmed)) {
		return "multiWordClue";
	}
	if (!Number.isInteger(count) || count < 1 || count > 9) {
		return "invalidCount";
	}
	const upper = trimmed.toUpperCase();
	const visible = state.words.filter((_, index) => !state.revealed[index]);
	if (visible.some((word) => word.toUpperCase() === upper)) {
		return "matchesBoardWord";
	}
	return undefined;
}

export function applySignalClue(
	state: SignalGameState,
	clue: string,
	count: number,
): SignalGameState {
	if (state.phase !== "clue") {
		throw new GameRuleError("notExpectingClue");
	}
	const error = validateSignalClue(state, clue, count);
	if (error) {
		throw new GameRuleError(CLUE_ERROR_CODES[error]);
	}
	return {
		...state,
		phase: "guess",
		clueWord: clue.trim(),
		clueCount: count,
		guessesLeft: count + 1,
	};
}

type SignalGuessResult =
	| { type: "correct"; won: boolean }
	| { type: "neutral" }
	| { type: "opponent"; opponentWon: boolean }
	| { type: "trap" };

function teamCleared(state: SignalGameState, team: SignalTeam) {
	return state.assignments.every(
		(role, index) => role !== team || state.revealed[index],
	);
}

function endTurn(state: SignalGameState): SignalGameState {
	return {
		...state,
		phase: "clue",
		currentTeam: opponent(SIGNAL_TEAMS, state.currentTeam),
		clueWord: undefined,
		clueCount: undefined,
		guessesLeft: undefined,
	};
}

/**
 * Reveal a card for the current team. Throws on out-of-phase or
 * already-revealed picks; never mutates the input state.
 */
export function applySignalGuess(
	state: SignalGameState,
	cardIndex: number,
): { state: SignalGameState; result: SignalGuessResult } {
	if (state.phase !== "guess") {
		throw new GameRuleError("notExpectingGuess");
	}
	if (
		!Number.isInteger(cardIndex) ||
		cardIndex < 0 ||
		cardIndex >= SIGNAL_BOARD_SIZE
	) {
		throw new GameRuleError("invalidCard");
	}
	if (state.revealed[cardIndex]) {
		throw new GameRuleError("cardAlreadyRevealed");
	}
	const revealed = state.revealed.map((flag, index) =>
		index === cardIndex ? true : flag,
	);
	const role = state.assignments[cardIndex];
	const base: SignalGameState = { ...state, revealed };

	if (role === "trap") {
		return {
			state: {
				...base,
				phase: "finished",
				winnerTeam: opponent(SIGNAL_TEAMS, state.currentTeam),
				trapHitBy: state.currentTeam,
			},
			result: { type: "trap" },
		};
	}
	if (role === state.currentTeam) {
		if (teamCleared(base, state.currentTeam)) {
			return {
				state: {
					...base,
					phase: "finished",
					winnerTeam: state.currentTeam,
				},
				result: { type: "correct", won: true },
			};
		}
		const guessesLeft = (state.guessesLeft ?? 1) - 1;
		if (guessesLeft <= 0) {
			return {
				state: endTurn(base),
				result: { type: "correct", won: false },
			};
		}
		return {
			state: { ...base, guessesLeft },
			result: { type: "correct", won: false },
		};
	}
	if (role === "neutral") {
		return { state: endTurn(base), result: { type: "neutral" } };
	}
	// Opponent card: helps the other team, may even finish their board.
	const other = opponent(SIGNAL_TEAMS, state.currentTeam);
	if (teamCleared(base, other)) {
		return {
			state: { ...base, phase: "finished", winnerTeam: other },
			result: { type: "opponent", opponentWon: true },
		};
	}
	return {
		state: endTurn(base),
		result: { type: "opponent", opponentWon: false },
	};
}

export function applySignalPass(state: SignalGameState): SignalGameState {
	if (state.phase !== "guess") {
		throw new GameRuleError("passOnlyDuringGuess");
	}
	return endTurn(state);
}
