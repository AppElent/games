/**
 * Guarded browser storage access. Storage can be missing (SSR), blocked
 * (private mode) or full, and a stored value can be corrupt: reads fall back
 * and writes become no-ops, so a game keeps working in memory. What a value
 * must look like stays with each store. Players' browsers hold these keys, so
 * renaming one forgets what was saved under it.
 */
function storageArea(
	area: "localStorage" | "sessionStorage",
): Storage | undefined {
	try {
		return window[area];
	} catch {
		return undefined;
	}
}

function localStore(): Storage | undefined {
	return storageArea("localStorage");
}

/** The stored value, or `fallback` when it is absent or `parse` throws. */
export function readStored<T>(
	key: string,
	parse: (raw: string) => T,
	fallback: T,
): T {
	try {
		const raw = localStore()?.getItem(key);
		return raw ? parse(raw) : fallback;
	} catch {
		return fallback;
	}
}

export function readJson<T>(key: string, fallback: T): T {
	return readStored(key, (raw) => JSON.parse(raw) as T, fallback);
}

export function writeJson(key: string, value: unknown) {
	try {
		localStore()?.setItem(key, JSON.stringify(value));
	} catch {
		// Quota or private mode.
	}
}

export function removeStored(key: string) {
	try {
		localStore()?.removeItem(key);
	} catch {
		// Private mode.
	}
}

/** This tab's sessionStorage value, or null when absent or unreadable. */
export function readTabValue(key: string): string | null {
	try {
		return storageArea("sessionStorage")?.getItem(key) ?? null;
	} catch {
		return null;
	}
}

export function writeTabValue(key: string, value: string) {
	try {
		storageArea("sessionStorage")?.setItem(key, value);
	} catch {
		// Quota or private mode.
	}
}

export function removeTabValue(key: string) {
	try {
		storageArea("sessionStorage")?.removeItem(key);
	} catch {
		// Private mode.
	}
}
