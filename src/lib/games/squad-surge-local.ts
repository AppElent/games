import { readJson, writeJson } from "#/lib/games/local-store";

const PROGRESS_KEY = "arcade-club.squad-surge.progress";
const SETTINGS_KEY = "arcade-club.squad-surge.settings";

export type SquadSurgeProgress = {
	/** Furthest distance travelled in any run. */
	bestDistance: number;
	/** Highest difficulty won. 0 = no wins yet. */
	highestCleared: number;
	wins: number;
	runs: number;
};

type SquadSurgeSettings = {
	soundOn: boolean;
};

const DEFAULT_PROGRESS: SquadSurgeProgress = {
	bestDistance: 0,
	highestCleared: 0,
	wins: 0,
	runs: 0,
};

const DEFAULT_SETTINGS: SquadSurgeSettings = { soundOn: true };

export function loadSquadSurgeProgress(): SquadSurgeProgress {
	return { ...DEFAULT_PROGRESS, ...readJson(PROGRESS_KEY, DEFAULT_PROGRESS) };
}

export function recordSquadSurgeRun(result: {
	distance: number;
	difficulty: number;
	won: boolean;
}): SquadSurgeProgress {
	const progress = loadSquadSurgeProgress();
	const next: SquadSurgeProgress = {
		bestDistance: Math.max(progress.bestDistance, Math.floor(result.distance)),
		highestCleared: result.won
			? Math.max(progress.highestCleared, result.difficulty)
			: progress.highestCleared,
		wins: progress.wins + (result.won ? 1 : 0),
		runs: progress.runs + 1,
	};
	writeJson(PROGRESS_KEY, next);
	return next;
}

export function loadSquadSurgeSettings(): SquadSurgeSettings {
	return {
		...DEFAULT_SETTINGS,
		...readJson(SETTINGS_KEY, DEFAULT_SETTINGS),
	};
}

export function saveSquadSurgeSettings(settings: SquadSurgeSettings): void {
	writeJson(SETTINGS_KEY, settings);
}
