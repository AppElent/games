import { describe, expect, it } from "vitest";
import {
	applySignalClue,
	applySignalGuess,
	applySignalPass,
	countRemaining,
	createSignalGameState,
	generateSignalBoard,
	otherTeam,
	SIGNAL_BOARD_SIZE,
	type SignalCardRole,
	type SignalGameState,
	validateSignalClue,
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
		expect(counts[otherTeam(board.startingTeam)]).toBe(8);
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
		expect(validateSignalClue(state, "  ", 2)).toBe("emptyClue");
		expect(validateSignalClue(state, "two words", 2)).toBe("multiWordClue");
		expect(validateSignalClue(state, "fine", 0)).toBe("invalidCount");
		expect(validateSignalClue(state, "fine", 10)).toBe("invalidCount");
		expect(validateSignalClue(state, "fine", 2.5)).toBe("invalidCount");
		expect(validateSignalClue(state, state.words[0].toLowerCase(), 2)).toBe(
			"matchesBoardWord",
		);
		expect(validateSignalClue(state, "galaxy", 3)).toBeUndefined();
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
		expect(state.currentTeam).toBe(otherTeam(team));
		expect(state.guessesLeft).toBeUndefined();
	});

	it("ends the turn on a neutral card", () => {
		const state = stateWithClue();
		const index = findIndex(state, "neutral");
		const { state: next, result } = applySignalGuess(state, index);
		expect(result).toEqual({ type: "neutral" });
		expect(next.phase).toBe("clue");
		expect(next.currentTeam).toBe(otherTeam(state.currentTeam));
	});

	it("ends the turn on an opponent card", () => {
		const state = stateWithClue();
		const index = findIndex(state, otherTeam(state.currentTeam));
		const { state: next, result } = applySignalGuess(state, index);
		expect(result).toEqual({ type: "opponent", opponentWon: false });
		expect(next.currentTeam).toBe(otherTeam(state.currentTeam));
	});

	it("finishes the game when the trap is picked", () => {
		const state = stateWithClue();
		const index = findIndex(state, "trap");
		const { state: next, result } = applySignalGuess(state, index);
		expect(result).toEqual({ type: "trap" });
		expect(next.phase).toBe("finished");
		expect(next.winnerTeam).toBe(otherTeam(state.currentTeam));
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
		const opponent = otherTeam(state.currentTeam);
		const opponentIndexes = state.assignments
			.map((role, index) => (role === opponent ? index : -1))
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
		expect(next.winnerTeam).toBe(opponent);
	});

	it("rejects revealed cards, bad indexes and out-of-phase guesses", () => {
		const state = stateWithClue();
		const index = findIndex(state, state.currentTeam);
		const { state: next } = applySignalGuess(state, index);
		expect(() => applySignalGuess(next, index)).toThrow("already revealed");
		expect(() => applySignalGuess(state, -1)).toThrow("Invalid card");
		expect(() => applySignalGuess(state, 25)).toThrow("Invalid card");
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
		expect(next.currentTeam).toBe(otherTeam(state.currentTeam));
	});

	it("rejects passing outside the guess phase", () => {
		const board = generateSignalBoard(
			SIGNAL_WORDS_DEFAULT_PACK,
			seededRandom(5),
		);
		expect(() => applySignalPass(createSignalGameState(board))).toThrow();
	});

	it("counts remaining cards per team", () => {
		const state = stateWithClue();
		expect(countRemaining(state, state.startingTeam)).toBe(9);
		const index = findIndex(state, state.startingTeam);
		const { state: next } = applySignalGuess(state, index);
		expect(countRemaining(next, state.startingTeam)).toBe(8);
	});
});
