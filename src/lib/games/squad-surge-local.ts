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

export type SquadSurgeSettings = {
	soundOn: boolean;
};

const DEFAULT_PROGRESS: SquadSurgeProgress = {
	bestDistance: 0,
	highestCleared: 0,
	wins: 0,
	runs: 0,
};

function getStorage(storage?: Storage): Storage | undefined {
	if (storage) {
		return storage;
	}
	if (typeof window === "undefined") {
		return undefined;
	}
	try {
		return window.localStorage;
	} catch {
		return undefined;
	}
}

function readJson<T>(
	storage: Storage | undefined,
	key: string,
	fallback: T,
): T {
	if (!storage) {
		return fallback;
	}
	try {
		const raw = storage.getItem(key);
		return raw ? { ...fallback, ...(JSON.parse(raw) as T) } : fallback;
	} catch {
		return fallback;
	}
}

export function loadSquadSurgeProgress(storage?: Storage): SquadSurgeProgress {
	return readJson(getStorage(storage), PROGRESS_KEY, DEFAULT_PROGRESS);
}

export function recordSquadSurgeRun(
	result: { distance: number; difficulty: number; won: boolean },
	storage?: Storage,
): SquadSurgeProgress {
	const target = getStorage(storage);
	const progress = readJson(target, PROGRESS_KEY, DEFAULT_PROGRESS);
	const next: SquadSurgeProgress = {
		bestDistance: Math.max(progress.bestDistance, Math.floor(result.distance)),
		highestCleared: result.won
			? Math.max(progress.highestCleared, result.difficulty)
			: progress.highestCleared,
		wins: progress.wins + (result.won ? 1 : 0),
		runs: progress.runs + 1,
	};
	target?.setItem(PROGRESS_KEY, JSON.stringify(next));
	return next;
}

export function loadSquadSurgeSettings(storage?: Storage): SquadSurgeSettings {
	return readJson(getStorage(storage), SETTINGS_KEY, { soundOn: true });
}

export function saveSquadSurgeSettings(
	settings: SquadSurgeSettings,
	storage?: Storage,
): void {
	getStorage(storage)?.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
