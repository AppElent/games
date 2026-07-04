import { describe, expect, it } from "vitest";
import {
	buildWordLinkShareText,
	createWordLinkAttempt,
	getDailyPuzzleId,
	getSolvedTerms,
	shuffleTerms,
	sortGroupsByDifficulty,
	submitWordLinkGuess,
	validateWordLinkPuzzle,
	WORD_LINK_MISTAKE_LIMIT,
	type WordLinkPuzzle,
} from "../word-links";
import {
	getWordLinkPuzzleById,
	WORD_LINK_PUZZLES,
} from "../word-links-puzzles";

const TEST_PUZZLE: WordLinkPuzzle = {
	id: "test-1",
	title: "Test",
	terms: [
		"DOG",
		"CAT",
		"FOX",
		"OWL",
		"RED",
		"BLUE",
		"GREEN",
		"PINK",
		"ONE",
		"TWO",
		"SIX",
		"TEN",
		"OAK",
		"ELM",
		"ASH",
		"FIR",
	],
	groups: [
		{
			id: "g-animals",
			label: "Animals",
			difficulty: "easy",
			terms: ["DOG", "CAT", "FOX", "OWL"],
		},
		{
			id: "g-colors",
			label: "Colors",
			difficulty: "medium",
			terms: ["RED", "BLUE", "GREEN", "PINK"],
		},
		{
			id: "g-numbers",
			label: "Numbers",
			difficulty: "hard",
			terms: ["ONE", "TWO", "SIX", "TEN"],
		},
		{
			id: "g-trees",
			label: "Trees",
			difficulty: "tricky",
			terms: ["OAK", "ELM", "ASH", "FIR"],
		},
	],
};

describe("validateWordLinkPuzzle", () => {
	it("accepts a valid puzzle", () => {
		expect(validateWordLinkPuzzle(TEST_PUZZLE)).toEqual([]);
	});

	it("rejects duplicate terms", () => {
		const bad = {
			...TEST_PUZZLE,
			terms: TEST_PUZZLE.terms.map((term) => (term === "CAT" ? "DOG" : term)),
			groups: TEST_PUZZLE.groups.map((group) =>
				group.id === "g-animals"
					? { ...group, terms: ["DOG", "DOG", "FOX", "OWL"] }
					: group,
			),
		};
		expect(validateWordLinkPuzzle(bad).length).toBeGreaterThan(0);
	});

	it("rejects wrong group sizes", () => {
		const bad = {
			...TEST_PUZZLE,
			groups: TEST_PUZZLE.groups.map((group) =>
				group.id === "g-animals"
					? { ...group, terms: ["DOG", "CAT", "FOX"] }
					: group,
			),
		};
		expect(
			validateWordLinkPuzzle(bad).some((error) =>
				error.message.includes("exactly 4 terms"),
			),
		).toBe(true);
	});

	it("rejects missing labels", () => {
		const bad = {
			...TEST_PUZZLE,
			groups: TEST_PUZZLE.groups.map((group) =>
				group.id === "g-trees" ? { ...group, label: " " } : group,
			),
		};
		expect(
			validateWordLinkPuzzle(bad).some((error) =>
				error.message.includes("label"),
			),
		).toBe(true);
	});

	it("rejects group terms missing from the term list", () => {
		const bad = {
			...TEST_PUZZLE,
			groups: TEST_PUZZLE.groups.map((group) =>
				group.id === "g-trees"
					? { ...group, terms: ["OAK", "ELM", "ASH", "PINE"] }
					: group,
			),
		};
		expect(validateWordLinkPuzzle(bad).length).toBeGreaterThan(0);
	});

	it("validates every seed puzzle", () => {
		expect(WORD_LINK_PUZZLES.length).toBeGreaterThanOrEqual(20);
		for (const puzzle of WORD_LINK_PUZZLES) {
			expect(validateWordLinkPuzzle(puzzle), puzzle.id).toEqual([]);
		}
	});
});

describe("submitWordLinkGuess", () => {
	it("solves a correct group and locks it", () => {
		const attempt = createWordLinkAttempt(TEST_PUZZLE);
		const { result, attempt: next } = submitWordLinkGuess(
			TEST_PUZZLE,
			attempt,
			["DOG", "CAT", "FOX", "OWL"],
		);
		expect(result).toEqual({
			type: "correct",
			groupId: "g-animals",
			won: false,
		});
		expect(next.solvedGroupIds).toEqual(["g-animals"]);
		expect(next.mistakes).toBe(0);
		expect(getSolvedTerms(TEST_PUZZLE, next).has("DOG")).toBe(true);
	});

	it("matches groups case-insensitively and order-independently", () => {
		const attempt = createWordLinkAttempt(TEST_PUZZLE);
		const { result } = submitWordLinkGuess(TEST_PUZZLE, attempt, [
			"owl",
			"fox",
			"cat",
			"dog",
		]);
		expect(result.type).toBe("correct");
	});

	it("reports one-away without revealing which term is off", () => {
		const attempt = createWordLinkAttempt(TEST_PUZZLE);
		const { result, attempt: next } = submitWordLinkGuess(
			TEST_PUZZLE,
			attempt,
			["DOG", "CAT", "FOX", "RED"],
		);
		expect(result).toEqual({ type: "oneAway", lost: false });
		expect(next.mistakes).toBe(1);
	});

	it("reports plain wrong for scattered guesses", () => {
		const attempt = createWordLinkAttempt(TEST_PUZZLE);
		const { result, attempt: next } = submitWordLinkGuess(
			TEST_PUZZLE,
			attempt,
			["DOG", "RED", "ONE", "OAK"],
		);
		expect(result).toEqual({ type: "wrong", lost: false });
		expect(next.mistakes).toBe(1);
	});

	it("rejects duplicate wrong guesses without consuming a mistake", () => {
		let attempt = createWordLinkAttempt(TEST_PUZZLE);
		({ attempt } = submitWordLinkGuess(TEST_PUZZLE, attempt, [
			"DOG",
			"RED",
			"ONE",
			"OAK",
		]));
		const { result, attempt: next } = submitWordLinkGuess(
			TEST_PUZZLE,
			attempt,
			["OAK", "ONE", "RED", "DOG"],
		);
		expect(result).toEqual({ type: "duplicateGuess" });
		expect(next.mistakes).toBe(1);
	});

	it("rejects selections that are not exactly 4 terms", () => {
		const attempt = createWordLinkAttempt(TEST_PUZZLE);
		const { result } = submitWordLinkGuess(TEST_PUZZLE, attempt, [
			"DOG",
			"CAT",
			"FOX",
		]);
		expect(result.type).toBe("invalidSelection");
	});

	it("rejects terms that are already solved", () => {
		let attempt = createWordLinkAttempt(TEST_PUZZLE);
		({ attempt } = submitWordLinkGuess(TEST_PUZZLE, attempt, [
			"DOG",
			"CAT",
			"FOX",
			"OWL",
		]));
		const { result, attempt: next } = submitWordLinkGuess(
			TEST_PUZZLE,
			attempt,
			["DOG", "RED", "ONE", "OAK"],
		);
		expect(result.type).toBe("invalidSelection");
		expect(next.mistakes).toBe(0);
	});

	it("rejects terms outside the puzzle", () => {
		const attempt = createWordLinkAttempt(TEST_PUZZLE);
		const { result } = submitWordLinkGuess(TEST_PUZZLE, attempt, [
			"DOG",
			"CAT",
			"FOX",
			"ZEBRA",
		]);
		expect(result.type).toBe("invalidSelection");
	});

	it("wins after all four groups are solved", () => {
		let attempt = createWordLinkAttempt(TEST_PUZZLE);
		for (const group of TEST_PUZZLE.groups.slice(0, 3)) {
			({ attempt } = submitWordLinkGuess(TEST_PUZZLE, attempt, group.terms));
		}
		const { result, attempt: done } = submitWordLinkGuess(
			TEST_PUZZLE,
			attempt,
			TEST_PUZZLE.groups[3].terms,
		);
		expect(result).toEqual({ type: "correct", groupId: "g-trees", won: true });
		expect(done.status).toBe("won");
		expect(done.finishedAt).toBeDefined();
	});

	it("loses after reaching the mistake limit and blocks further guesses", () => {
		let attempt = createWordLinkAttempt(TEST_PUZZLE);
		const wrongGuesses = [
			["DOG", "RED", "ONE", "OAK"],
			["CAT", "BLUE", "TWO", "ELM"],
			["FOX", "GREEN", "SIX", "ASH"],
			["OWL", "PINK", "TEN", "FIR"],
		];
		let lastLost = false;
		for (const guess of wrongGuesses) {
			const step = submitWordLinkGuess(TEST_PUZZLE, attempt, guess);
			attempt = step.attempt;
			if (step.result.type === "wrong" || step.result.type === "oneAway") {
				lastLost = step.result.lost;
			}
		}
		expect(attempt.mistakes).toBe(WORD_LINK_MISTAKE_LIMIT);
		expect(attempt.status).toBe("lost");
		expect(lastLost).toBe(true);
		const after = submitWordLinkGuess(TEST_PUZZLE, attempt, [
			"DOG",
			"CAT",
			"FOX",
			"OWL",
		]);
		expect(after.result.type).toBe("invalidSelection");
		expect(after.attempt).toBe(attempt);
	});
});

describe("share text", () => {
	it("is spoiler-free: contains no terms or labels", () => {
		let attempt = createWordLinkAttempt(TEST_PUZZLE);
		({ attempt } = submitWordLinkGuess(TEST_PUZZLE, attempt, [
			"DOG",
			"CAT",
			"FOX",
			"RED",
		]));
		({ attempt } = submitWordLinkGuess(TEST_PUZZLE, attempt, [
			"DOG",
			"CAT",
			"FOX",
			"OWL",
		]));
		const text = buildWordLinkShareText(TEST_PUZZLE, attempt);
		for (const term of TEST_PUZZLE.terms) {
			expect(text).not.toContain(term);
		}
		for (const group of TEST_PUZZLE.groups) {
			expect(text).not.toContain(group.label);
		}
		expect(text).toContain("🟩🟩🟩🟨");
		expect(text).toContain("🟩🟩🟩🟩");
	});
});

describe("daily + helpers", () => {
	it("resolves the same daily puzzle for the same date", () => {
		const date = new Date("2026-07-04T10:00:00Z");
		const other = new Date("2026-07-04T23:59:00Z");
		expect(getDailyPuzzleId(WORD_LINK_PUZZLES, date)).toBe(
			getDailyPuzzleId(WORD_LINK_PUZZLES, other),
		);
	});

	it("rotates the daily puzzle across days", () => {
		const day1 = getDailyPuzzleId(WORD_LINK_PUZZLES, new Date("2026-07-04"));
		const day2 = getDailyPuzzleId(WORD_LINK_PUZZLES, new Date("2026-07-05"));
		expect(day1).not.toBe(day2);
	});

	it("finds puzzles by id", () => {
		expect(getWordLinkPuzzleById("wl-001")?.id).toBe("wl-001");
		expect(getWordLinkPuzzleById("missing")).toBeUndefined();
	});

	it("sorts groups by difficulty", () => {
		const sorted = sortGroupsByDifficulty([...TEST_PUZZLE.groups].reverse());
		expect(sorted.map((group) => group.difficulty)).toEqual([
			"easy",
			"medium",
			"hard",
			"tricky",
		]);
	});

	it("shuffles deterministically with an injected random", () => {
		const sequence = [0.1, 0.5, 0.9, 0.2, 0.7, 0.3];
		let index = 0;
		const random = () => sequence[index++ % sequence.length];
		const a = shuffleTerms(TEST_PUZZLE.terms, random);
		index = 0;
		const b = shuffleTerms(TEST_PUZZLE.terms, random);
		expect(a).toEqual(b);
		expect([...a].sort()).toEqual([...TEST_PUZZLE.terms].sort());
	});
});
