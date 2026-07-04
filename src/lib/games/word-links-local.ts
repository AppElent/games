import type { WordLinkAttempt } from "./word-links";

const ATTEMPTS_KEY = "arcade-club.word-links.attempts";
const STREAK_KEY = "arcade-club.word-links.streak";

type AttemptStore = Record<string, WordLinkAttempt>;

export type WordLinkStreak = {
	current: number;
	best: number;
	lastWonDay?: number;
};

function readJson<T>(storage: Storage, key: string, fallback: T): T {
	try {
		const raw = storage.getItem(key);
		return raw ? (JSON.parse(raw) as T) : fallback;
	} catch {
		return fallback;
	}
}

export function loadWordLinkAttempt(
	puzzleId: string,
	storage: Storage = window.localStorage,
) {
	const store = readJson<AttemptStore>(storage, ATTEMPTS_KEY, {});
	return store[puzzleId];
}

export function saveWordLinkAttempt(
	attempt: WordLinkAttempt,
	storage: Storage = window.localStorage,
) {
	const store = readJson<AttemptStore>(storage, ATTEMPTS_KEY, {});
	store[attempt.puzzleId] = attempt;
	storage.setItem(ATTEMPTS_KEY, JSON.stringify(store));
}

export function loadWordLinkStreak(
	storage: Storage = window.localStorage,
): WordLinkStreak {
	return readJson<WordLinkStreak>(storage, STREAK_KEY, {
		current: 0,
		best: 0,
	});
}

/**
 * Record a finished DAILY attempt. Practice puzzles never call this, so they
 * never affect the streak. Returns the updated streak.
 */
export function recordDailyResult(
	won: boolean,
	now = Date.now(),
	storage: Storage = window.localStorage,
): WordLinkStreak {
	const streak = loadWordLinkStreak(storage);
	const today = Math.floor(now / 86_400_000);
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
	storage.setItem(STREAK_KEY, JSON.stringify(next));
	return next;
}
