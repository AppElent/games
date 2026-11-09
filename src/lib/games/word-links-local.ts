import type { WordLinkAttempt } from "@arcadeclub/core/word-links";
import { readJson, writeJson } from "#/lib/games/local-store";

const ATTEMPTS_KEY = "arcade-club.word-links.attempts";
const STREAK_KEY = "arcade-club.word-links.streak";

type AttemptStore = Record<string, WordLinkAttempt>;

type WordLinkStreak = {
	current: number;
	best: number;
	lastWonDay?: number;
};

export function loadWordLinkAttempt(puzzleId: string) {
	return readJson<AttemptStore>(ATTEMPTS_KEY, {})[puzzleId];
}

export function saveWordLinkAttempt(attempt: WordLinkAttempt) {
	const store = readJson<AttemptStore>(ATTEMPTS_KEY, {});
	store[attempt.puzzleId] = attempt;
	writeJson(ATTEMPTS_KEY, store);
}

export function loadWordLinkStreak(): WordLinkStreak {
	return readJson<WordLinkStreak>(STREAK_KEY, { current: 0, best: 0 });
}

/**
 * Record a finished DAILY attempt. Practice puzzles never call this, so they
 * never affect the streak. Returns the updated streak.
 */
export function recordDailyResult(won: boolean): WordLinkStreak {
	const streak = loadWordLinkStreak();
	const today = Math.floor(Date.now() / 86_400_000);
	if (streak.lastWonDay === today) {
		return streak;
	}
	const next: WordLinkStreak = won
		? {
				current: streak.lastWonDay === today - 1 ? streak.current + 1 : 1,
				best: 0,
				lastWonDay: today,
			}
		: { current: 0, best: streak.best, lastWonDay: streak.lastWonDay };
	next.best = Math.max(streak.best, next.current);
	writeJson(STREAK_KEY, next);
	return next;
}
