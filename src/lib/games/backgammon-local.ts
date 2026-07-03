import type { BackgammonBoardOptions } from "#/components/backgammon/BackgammonBoard";
import type { BackgammonTurnState } from "./backgammon";

/**
 * Local (same device) backgammon matches live entirely in localStorage:
 * no Convex session is created and no reads/writes are spent on them.
 */
export type LocalBackgammonGame = {
	state: BackgammonTurnState;
	history: BackgammonTurnState[];
	future: BackgammonTurnState[];
	options: BackgammonBoardOptions;
	updatedAt: number;
};

const KEY = "arcade-club.backgammon.local";
export const LOCAL_BACKGAMMON_HISTORY_LIMIT = 60;

export const DEFAULT_LOCAL_BACKGAMMON_OPTIONS: BackgammonBoardOptions = {
	showNumbers: true,
	autoRoll: false,
	autoSwitchTurn: true,
	autoCombine: true,
};

export function loadLocalBackgammonGame(
	storage: Storage = window.localStorage,
): LocalBackgammonGame | null {
	try {
		const raw = storage.getItem(KEY);
		if (!raw) {
			return null;
		}
		const parsed = JSON.parse(raw) as LocalBackgammonGame;
		if (!parsed?.state?.points || parsed.state.points.length !== 24) {
			return null;
		}
		return {
			...parsed,
			options: { ...DEFAULT_LOCAL_BACKGAMMON_OPTIONS, ...parsed.options },
		};
	} catch {
		return null;
	}
}

export function saveLocalBackgammonGame(
	game: LocalBackgammonGame,
	storage: Storage = window.localStorage,
) {
	try {
		storage.setItem(
			KEY,
			JSON.stringify({
				...game,
				history: game.history.slice(-LOCAL_BACKGAMMON_HISTORY_LIMIT),
			}),
		);
	} catch {
		// Quota or private mode — the running game keeps working in memory.
	}
}

export function clearLocalBackgammonGame(
	storage: Storage = window.localStorage,
) {
	try {
		storage.removeItem(KEY);
	} catch {
		// ignore
	}
}
