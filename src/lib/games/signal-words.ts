export type SignalTeam = "red" | "blue";
export type SignalCardRole = "red" | "blue" | "neutral" | "trap";
export type SignalPhase = "clue" | "guess" | "finished";

export const SIGNAL_BOARD_SIZE = 25;
export const SIGNAL_STARTING_CARDS = 9;
export const SIGNAL_SECOND_CARDS = 8;
export const SIGNAL_NEUTRAL_CARDS = 7;
export const SIGNAL_TRAP_CARDS = 1;

export type SignalBoard = {
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

export function otherTeam(team: SignalTeam): SignalTeam {
	return team === "red" ? "blue" : "red";
}

function shuffle<T>(items: readonly T[], random: () => number) {
	const copy = [...items];
	for (let index = copy.length - 1; index > 0; index -= 1) {
		const swap = Math.floor(random() * (index + 1));
		[copy[index], copy[swap]] = [copy[swap], copy[index]];
	}
	return copy;
}

/**
 * Build a 25-card board from a word pack: 9 for the starting team,
 * 8 for the other team, 7 decoys, 1 trap tile.
 */
export function generateSignalBoard(
	pack: readonly string[],
	random: () => number = Math.random,
): SignalBoard {
	const unique = [...new Set(pack.map((word) => word.trim().toUpperCase()))];
	if (unique.length < SIGNAL_BOARD_SIZE) {
		throw new Error("Word pack needs at least 25 unique words");
	}
	const words = shuffle(unique, random).slice(0, SIGNAL_BOARD_SIZE);
	const startingTeam: SignalTeam = random() < 0.5 ? "red" : "blue";
	const roles: SignalCardRole[] = [
		...Array<SignalCardRole>(SIGNAL_STARTING_CARDS).fill(startingTeam),
		...Array<SignalCardRole>(SIGNAL_SECOND_CARDS).fill(otherTeam(startingTeam)),
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

export type SignalClueError =
	| "emptyClue"
	| "multiWordClue"
	| "invalidCount"
	| "matchesBoardWord";

export function validateSignalClue(
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
		throw new Error("Not expecting a clue right now");
	}
	const error = validateSignalClue(state, clue, count);
	if (error) {
		throw new Error(`Invalid clue: ${error}`);
	}
	return {
		...state,
		phase: "guess",
		clueWord: clue.trim(),
		clueCount: count,
		guessesLeft: count + 1,
	};
}

export type SignalGuessResult =
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
		currentTeam: otherTeam(state.currentTeam),
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
		throw new Error("Not expecting a guess right now");
	}
	if (
		!Number.isInteger(cardIndex) ||
		cardIndex < 0 ||
		cardIndex >= SIGNAL_BOARD_SIZE
	) {
		throw new Error("Invalid card");
	}
	if (state.revealed[cardIndex]) {
		throw new Error("That card is already revealed");
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
				winnerTeam: otherTeam(state.currentTeam),
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
	const opponent = otherTeam(state.currentTeam);
	if (teamCleared(base, opponent)) {
		return {
			state: { ...base, phase: "finished", winnerTeam: opponent },
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
		throw new Error("You can only pass during a guess phase");
	}
	return endTurn(state);
}

export function countRemaining(state: SignalGameState, team: SignalTeam) {
	return state.assignments.filter(
		(role, index) => role === team && !state.revealed[index],
	).length;
}
