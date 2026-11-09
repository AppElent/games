import { describe, expect, it } from "vitest";
import { opponent } from "../duel";
import {
	applySignalClue,
	applySignalGuess,
	applySignalPass,
	createSignalGameState,
	generateSignalBoard,
	isSignalClueGiver,
	SIGNAL_BOARD_SIZE,
	SIGNAL_TEAMS,
	type SignalCardRole,
	type SignalGameState,
	signalSeat,
	signalSeatTeam,
} from "../signal-words";
import { SIGNAL_WORDS_DEFAULT_PACK } from "../signal-words-packs";

function seededRandom(seed: number) {
	let value = seed;
	return () => {
		value = (value * 16807) % 2147483647;
		return (value - 1) / 2147483646;
	};
}

function findIndex(state: SignalGameState, role: SignalCardRole) {
	return state.assignments.findIndex(
		(candidate, index) => candidate === role && !state.revealed[index],
	);
}

function stateWithClue(seed = 42) {
	const board = generateSignalBoard(
		SIGNAL_WORDS_DEFAULT_PACK,
		seededRandom(seed),
	);
	let state = createSignalGameState(board);
	state = applySignalClue(state, "galaxy", 2);
	return state;
}

describe("word pack", () => {
	it("has at least 100 unique, single-word, family-length entries", () => {
		expect(SIGNAL_WORDS_DEFAULT_PACK.length).toBeGreaterThanOrEqual(100);
		const unique = new Set(
			SIGNAL_WORDS_DEFAULT_PACK.map((word) => word.toUpperCase()),
		);
		expect(unique.size).toBe(SIGNAL_WORDS_DEFAULT_PACK.length);
		for (const word of SIGNAL_WORDS_DEFAULT_PACK) {
			expect(word).toMatch(/^[A-Z]{3,12}$/);
		}
	});
});

describe("generateSignalBoard", () => {
	it("creates 25 unique words with a 9/8/7/1 role split", () => {
		const board = generateSignalBoard(
			SIGNAL_WORDS_DEFAULT_PACK,
			seededRandom(1),
		);
		expect(board.words.length).toBe(SIGNAL_BOARD_SIZE);
		expect(new Set(board.words).size).toBe(SIGNAL_BOARD_SIZE);
		const counts = { red: 0, blue: 0, neutral: 0, trap: 0 };
		for (const role of board.assignments) {
			counts[role] += 1;
		}
		expect(counts[board.startingTeam]).toBe(9);
		expect(counts[opponent(SIGNAL_TEAMS, board.startingTeam)]).toBe(8);
		expect(counts.neutral).toBe(7);
		expect(counts.trap).toBe(1);
	});

	it("never duplicates words across 100 generated boards", () => {
		for (let seed = 1; seed <= 100; seed += 1) {
			const board = generateSignalBoard(
				SIGNAL_WORDS_DEFAULT_PACK,
				seededRandom(seed),
			);
			expect(new Set(board.words).size).toBe(SIGNAL_BOARD_SIZE);
		}
	});

	it("rejects packs smaller than the board", () => {
		expect(() =>
			generateSignalBoard(["ONE", "TWO"], seededRandom(1)),
		).toThrow();
	});
});

describe("clue validation", () => {
	it("rejects empty, multi-word, bad counts and board words", () => {
		const board = generateSignalBoard(
			SIGNAL_WORDS_DEFAULT_PACK,
			seededRandom(7),
		);
		const state = createSignalGameState(board);
		const clue = (word: string, count: number) => () =>
			applySignalClue(state, word, count);
		expect(clue("  ", 2)).toThrow("clueEmpty");
		expect(clue("two words", 2)).toThrow("clueMultiWord");
		expect(clue("fine", 0)).toThrow("clueInvalidCount");
		expect(clue("fine", 10)).toThrow("clueInvalidCount");
		expect(clue("fine", 2.5)).toThrow("clueInvalidCount");
		expect(clue(state.words[0].toLowerCase(), 2)).toThrow(
			"clueMatchesBoardWord",
		);
		expect(clue("galaxy", 3)).not.toThrow();
	});

	it("moves to guess phase with count + 1 guesses", () => {
		const state = stateWithClue();
		expect(state.phase).toBe("guess");
		expect(state.clueWord).toBe("galaxy");
		expect(state.guessesLeft).toBe(3);
	});

	it("rejects clues outside the clue phase", () => {
		const state = stateWithClue();
		expect(() => applySignalClue(state, "again", 1)).toThrow();
	});
});

describe("applySignalGuess", () => {
	it("keeps the turn on a correct guess and decrements guesses", () => {
		const state = stateWithClue();
		const index = findIndex(state, state.currentTeam);
		const { state: next, result } = applySignalGuess(state, index);
		expect(result).toEqual({ type: "correct", won: false });
		expect(next.currentTeam).toBe(state.currentTeam);
		expect(next.guessesLeft).toBe(2);
		expect(next.revealed[index]).toBe(true);
	});

	it("ends the turn after using all guesses", () => {
		let state = stateWithClue();
		const team = state.currentTeam;
		for (let i = 0; i < 3; i += 1) {
			const index = findIndex(state, team);
			({ state } = applySignalGuess(state, index));
		}
		expect(state.phase).toBe("clue");
		expect(state.currentTeam).toBe(opponent(SIGNAL_TEAMS, team));
		expect(state.guessesLeft).toBeUndefined();
		expect(state.clueWord).toBeUndefined();
		expect(state.clueCount).toBeUndefined();
	});

	it("ends the turn on a neutral card", () => {
		const state = stateWithClue();
		const index = findIndex(state, "neutral");
		const { state: next, result } = applySignalGuess(state, index);
		expect(result).toEqual({ type: "neutral" });
		expect(next.phase).toBe("clue");
		expect(next.currentTeam).toBe(opponent(SIGNAL_TEAMS, state.currentTeam));
	});

	it("ends the turn on an opponent card", () => {
		const state = stateWithClue();
		const index = findIndex(state, opponent(SIGNAL_TEAMS, state.currentTeam));
		const { state: next, result } = applySignalGuess(state, index);
		expect(result).toEqual({ type: "opponent", opponentWon: false });
		expect(next.currentTeam).toBe(opponent(SIGNAL_TEAMS, state.currentTeam));
	});

	it("finishes the game when the trap is picked", () => {
		const state = stateWithClue();
		const index = findIndex(state, "trap");
		const { state: next, result } = applySignalGuess(state, index);
		expect(result).toEqual({ type: "trap" });
		expect(next.phase).toBe("finished");
		expect(next.winnerTeam).toBe(opponent(SIGNAL_TEAMS, state.currentTeam));
		expect(next.trapHitBy).toBe(state.currentTeam);
	});

	it("wins when the last team card is revealed", () => {
		let state = stateWithClue();
		const team = state.currentTeam;
		// Reveal all but one of the team's cards directly.
		const teamIndexes = state.assignments
			.map((role, index) => (role === team ? index : -1))
			.filter((index) => index >= 0);
		state = {
			...state,
			guessesLeft: 9,
			revealed: state.revealed.map(
				(flag, index) =>
					flag || teamIndexes.slice(0, teamIndexes.length - 1).includes(index),
			),
		};
		const last = teamIndexes[teamIndexes.length - 1];
		const { state: next, result } = applySignalGuess(state, last);
		expect(result).toEqual({ type: "correct", won: true });
		expect(next.phase).toBe("finished");
		expect(next.winnerTeam).toBe(team);
	});

	it("hands the opponent the win when their last card is picked", () => {
		let state = stateWithClue();
		const other = opponent(SIGNAL_TEAMS, state.currentTeam);
		const opponentIndexes = state.assignments
			.map((role, index) => (role === other ? index : -1))
			.filter((index) => index >= 0);
		state = {
			...state,
			revealed: state.revealed.map(
				(flag, index) =>
					flag ||
					opponentIndexes.slice(0, opponentIndexes.length - 1).includes(index),
			),
		};
		const last = opponentIndexes[opponentIndexes.length - 1];
		const { state: next, result } = applySignalGuess(state, last);
		expect(result).toEqual({ type: "opponent", opponentWon: true });
		expect(next.phase).toBe("finished");
		expect(next.winnerTeam).toBe(other);
	});

	it("rejects revealed cards, bad indexes and out-of-phase guesses", () => {
		const state = stateWithClue();
		const index = findIndex(state, state.currentTeam);
		const { state: next } = applySignalGuess(state, index);
		expect(() => applySignalGuess(next, index)).toThrow("cardAlreadyRevealed");
		expect(() => applySignalGuess(state, -1)).toThrow("invalidCard");
		expect(() => applySignalGuess(state, 25)).toThrow("invalidCard");
		const board = generateSignalBoard(
			SIGNAL_WORDS_DEFAULT_PACK,
			seededRandom(3),
		);
		const cluePhase = createSignalGameState(board);
		expect(() => applySignalGuess(cluePhase, 0)).toThrow();
	});
});

describe("pass and counters", () => {
	it("passes the turn to the other team", () => {
		const state = stateWithClue();
		const next = applySignalPass(state);
		expect(next.phase).toBe("clue");
		expect(next.currentTeam).toBe(opponent(SIGNAL_TEAMS, state.currentTeam));
	});

	it("rejects passing outside the guess phase", () => {
		const board = generateSignalBoard(
			SIGNAL_WORDS_DEFAULT_PACK,
			seededRandom(5),
		);
		expect(() => applySignalPass(createSignalGameState(board))).toThrow();
	});
});

describe("signal seats", () => {
	it("names a team's guesser and clue giver seats", () => {
		expect(signalSeat("red", false)).toBe("red");
		expect(signalSeat("blue", true)).toBe("blue-clue");
	});

	it("reads the team and role back from a seat", () => {
		expect(signalSeatTeam("red")).toBe("red");
		expect(signalSeatTeam("red-clue")).toBe("red");
		expect(signalSeatTeam("blue")).toBe("blue");
		expect(signalSeatTeam("blue-clue")).toBe("blue");
		expect(signalSeatTeam("green")).toBeUndefined();
		expect(signalSeatTeam(undefined)).toBeUndefined();
		expect(isSignalClueGiver("red-clue")).toBe(true);
		expect(isSignalClueGiver("blue-clue")).toBe(true);
		expect(isSignalClueGiver("red")).toBe(false);
		expect(isSignalClueGiver(undefined)).toBe(false);
	});
});
