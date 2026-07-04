export type WordLinkDifficulty = "easy" | "medium" | "hard" | "tricky";

export type WordLinkGroup = {
	id: string;
	label: string;
	terms: string[];
	difficulty: WordLinkDifficulty;
	explanation?: string;
};

export type WordLinkPuzzle = {
	id: string;
	title?: string;
	terms: string[];
	groups: WordLinkGroup[];
};

export type WordLinkAttempt = {
	puzzleId: string;
	guesses: string[][];
	solvedGroupIds: string[];
	mistakes: number;
	mistakeLimit: number;
	status: "playing" | "won" | "lost";
	startedAt: number;
	finishedAt?: number;
};

export type WordLinkGuessResult =
	| { type: "correct"; groupId: string; won: boolean }
	| { type: "oneAway"; lost: boolean }
	| { type: "wrong"; lost: boolean }
	| { type: "duplicateGuess" }
	| { type: "invalidSelection"; reason: string };

export const WORD_LINK_MISTAKE_LIMIT = 4;
export const WORD_LINK_GROUP_SIZE = 4;
export const WORD_LINK_GROUP_COUNT = 4;

const DIFFICULTY_ORDER: readonly WordLinkDifficulty[] = [
	"easy",
	"medium",
	"hard",
	"tricky",
];

const DIFFICULTY_EMOJI: Record<WordLinkDifficulty, string> = {
	easy: "🟩",
	medium: "🟨",
	hard: "🟦",
	tricky: "🟪",
};

export type WordLinkValidationError = { path: string; message: string };

export function validateWordLinkPuzzle(
	puzzle: WordLinkPuzzle,
): WordLinkValidationError[] {
	const errors: WordLinkValidationError[] = [];
	if (!puzzle.id) {
		errors.push({ path: "id", message: "Puzzle id is required" });
	}
	if (puzzle.groups.length !== WORD_LINK_GROUP_COUNT) {
		errors.push({
			path: "groups",
			message: `Puzzle must have exactly ${WORD_LINK_GROUP_COUNT} groups`,
		});
	}
	const groupTerms = puzzle.groups.flatMap((group) => group.terms);
	if (
		puzzle.terms.length !== WORD_LINK_GROUP_SIZE * WORD_LINK_GROUP_COUNT ||
		groupTerms.length !== puzzle.terms.length
	) {
		errors.push({
			path: "terms",
			message: "Puzzle must have exactly 16 terms across 4 groups of 4",
		});
	}
	const seen = new Set<string>();
	for (const term of groupTerms) {
		const normalized = term.trim().toUpperCase();
		if (!normalized) {
			errors.push({ path: "terms", message: "Empty term" });
		}
		if (seen.has(normalized)) {
			errors.push({ path: "terms", message: `Duplicate term: ${term}` });
		}
		seen.add(normalized);
	}
	const termSet = new Set(puzzle.terms.map((term) => term.toUpperCase()));
	for (const [index, group] of puzzle.groups.entries()) {
		if (!group.label.trim()) {
			errors.push({
				path: `groups[${index}].label`,
				message: "Group label is required",
			});
		}
		if (group.terms.length !== WORD_LINK_GROUP_SIZE) {
			errors.push({
				path: `groups[${index}].terms`,
				message: "Each group needs exactly 4 terms",
			});
		}
		for (const term of group.terms) {
			if (!termSet.has(term.toUpperCase())) {
				errors.push({
					path: `groups[${index}].terms`,
					message: `Group term missing from puzzle terms: ${term}`,
				});
			}
		}
	}
	const difficulties = new Set(puzzle.groups.map((group) => group.difficulty));
	if (difficulties.size !== puzzle.groups.length) {
		errors.push({
			path: "groups",
			message: "Each group must have a distinct difficulty",
		});
	}
	return errors;
}

export function createWordLinkAttempt(
	puzzle: WordLinkPuzzle,
	now = Date.now(),
): WordLinkAttempt {
	return {
		puzzleId: puzzle.id,
		guesses: [],
		solvedGroupIds: [],
		mistakes: 0,
		mistakeLimit: WORD_LINK_MISTAKE_LIMIT,
		status: "playing",
		startedAt: now,
	};
}

function normalizeGuess(terms: string[]) {
	return terms
		.map((term) => term.toUpperCase())
		.sort()
		.join("|");
}

export function getSolvedTerms(
	puzzle: WordLinkPuzzle,
	attempt: WordLinkAttempt,
) {
	const solved = new Set<string>();
	for (const groupId of attempt.solvedGroupIds) {
		const group = puzzle.groups.find((candidate) => candidate.id === groupId);
		for (const term of group?.terms ?? []) {
			solved.add(term.toUpperCase());
		}
	}
	return solved;
}

/**
 * Apply a guess of exactly 4 unsolved terms. Returns the result and the next
 * attempt state; the input attempt is never mutated. Duplicate wrong guesses
 * and invalid selections do not consume a mistake.
 */
export function submitWordLinkGuess(
	puzzle: WordLinkPuzzle,
	attempt: WordLinkAttempt,
	terms: string[],
	now = Date.now(),
): { result: WordLinkGuessResult; attempt: WordLinkAttempt } {
	if (attempt.status !== "playing") {
		return {
			result: { type: "invalidSelection", reason: "Puzzle already finished" },
			attempt,
		};
	}
	if (terms.length !== WORD_LINK_GROUP_SIZE) {
		return {
			result: { type: "invalidSelection", reason: "Select exactly 4 words" },
			attempt,
		};
	}
	const upper = terms.map((term) => term.toUpperCase());
	if (new Set(upper).size !== WORD_LINK_GROUP_SIZE) {
		return {
			result: { type: "invalidSelection", reason: "Duplicate words selected" },
			attempt,
		};
	}
	const puzzleTerms = new Set(puzzle.terms.map((term) => term.toUpperCase()));
	const solvedTerms = getSolvedTerms(puzzle, attempt);
	for (const term of upper) {
		if (!puzzleTerms.has(term)) {
			return {
				result: {
					type: "invalidSelection",
					reason: `Not in this puzzle: ${term}`,
				},
				attempt,
			};
		}
		if (solvedTerms.has(term)) {
			return {
				result: {
					type: "invalidSelection",
					reason: "That word is already solved",
				},
				attempt,
			};
		}
	}

	const key = normalizeGuess(terms);
	if (attempt.guesses.some((guess) => normalizeGuess(guess) === key)) {
		return { result: { type: "duplicateGuess" }, attempt };
	}

	const guesses = [...attempt.guesses, [...terms]];
	const matched = puzzle.groups.find(
		(group) =>
			!attempt.solvedGroupIds.includes(group.id) &&
			group.terms.every((term) => upper.includes(term.toUpperCase())),
	);
	if (matched) {
		const solvedGroupIds = [...attempt.solvedGroupIds, matched.id];
		const won = solvedGroupIds.length === puzzle.groups.length;
		return {
			result: { type: "correct", groupId: matched.id, won },
			attempt: {
				...attempt,
				guesses,
				solvedGroupIds,
				status: won ? "won" : "playing",
				finishedAt: won ? now : undefined,
			},
		};
	}

	const bestOverlap = Math.max(
		...puzzle.groups
			.filter((group) => !attempt.solvedGroupIds.includes(group.id))
			.map(
				(group) =>
					group.terms.filter((term) => upper.includes(term.toUpperCase()))
						.length,
			),
	);
	const mistakes = attempt.mistakes + 1;
	const lost = mistakes >= attempt.mistakeLimit;
	const next: WordLinkAttempt = {
		...attempt,
		guesses,
		mistakes,
		status: lost ? "lost" : "playing",
		finishedAt: lost ? now : undefined,
	};
	if (bestOverlap === WORD_LINK_GROUP_SIZE - 1) {
		return { result: { type: "oneAway", lost }, attempt: next };
	}
	return { result: { type: "wrong", lost }, attempt: next };
}

function groupForGuess(puzzle: WordLinkPuzzle, guessTerm: string) {
	const upper = guessTerm.toUpperCase();
	return puzzle.groups.find((group) =>
		group.terms.some((term) => term.toUpperCase() === upper),
	);
}

/**
 * Spoiler-free share text: one emoji row per guess showing which group each
 * guessed term belonged to. No terms or labels are revealed.
 */
export function buildWordLinkShareText(
	puzzle: WordLinkPuzzle,
	attempt: WordLinkAttempt,
	label = puzzle.title ?? puzzle.id,
) {
	const rows = attempt.guesses.map((guess) =>
		guess
			.map((term) => {
				const group = groupForGuess(puzzle, term);
				return group ? DIFFICULTY_EMOJI[group.difficulty] : "⬜";
			})
			.join(""),
	);
	const outcome =
		attempt.status === "won"
			? `Solved with ${attempt.mistakes}/${attempt.mistakeLimit} mistakes`
			: attempt.status === "lost"
				? "Out of guesses"
				: "In progress";
	return [`Word Links — ${label}`, outcome, ...rows].join("\n");
}

export function sortGroupsByDifficulty(groups: WordLinkGroup[]) {
	return [...groups].sort(
		(a, b) =>
			DIFFICULTY_ORDER.indexOf(a.difficulty) -
			DIFFICULTY_ORDER.indexOf(b.difficulty),
	);
}

export function getWordLinkGroupEmoji(difficulty: WordLinkDifficulty) {
	return DIFFICULTY_EMOJI[difficulty];
}

/** Deterministic daily puzzle: same UTC date resolves to the same puzzle id. */
export function getDailyPuzzleId(
	puzzles: readonly WordLinkPuzzle[],
	date = new Date(),
) {
	if (puzzles.length === 0) {
		throw new Error("No puzzles available");
	}
	const epochDay = Math.floor(date.getTime() / 86_400_000);
	return puzzles[epochDay % puzzles.length].id;
}

export function shuffleTerms(
	terms: readonly string[],
	random: () => number = Math.random,
) {
	const copy = [...terms];
	for (let index = copy.length - 1; index > 0; index -= 1) {
		const swap = Math.floor(random() * (index + 1));
		[copy[index], copy[swap]] = [copy[swap], copy[index]];
	}
	return copy;
}
