import {
	type LocalMatch,
	parseLocalMatch,
} from "@arcadeclub/core/backgammon-local";

/**
 * Local (same device) backgammon matches live entirely in localStorage:
 * no Convex session is created and no reads/writes are spent on them.
 */
const KEY = "arcade-club.backgammon.local";

export function loadLocalBackgammonGame(
	storage: Storage = window.localStorage,
): LocalMatch | null {
	try {
		const raw = storage.getItem(KEY);
		return raw ? parseLocalMatch(raw) : null;
	} catch {
		return null;
	}
}

export function saveLocalBackgammonGame(
	game: LocalMatch,
	storage: Storage = window.localStorage,
) {
	try {
		storage.setItem(KEY, JSON.stringify(game));
	} catch {
		// Quota or private mode — the running game keeps working in memory.
	}
}
