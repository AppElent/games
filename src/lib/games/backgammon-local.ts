import {
	type LocalMatch,
	parseLocalMatch,
} from "@arcadeclub/core/backgammon-local";
import { readStored, writeJson } from "#/lib/games/local-store";

/**
 * Local (same device) backgammon matches live entirely in localStorage:
 * no Convex session is created and no reads/writes are spent on them.
 */
const KEY = "arcade-club.backgammon.local";

export function loadLocalBackgammonGame(): LocalMatch | null {
	return readStored(KEY, parseLocalMatch, null);
}

export function saveLocalBackgammonGame(game: LocalMatch) {
	writeJson(KEY, game);
}
