/**
 * Guarded localStorage access. Storage can be missing (SSR), blocked (private
 * mode) or full, and a stored value can be corrupt: reads fall back and writes
 * become no-ops, so a game keeps working in memory. What a value must look like
 * stays with each store. Players' browsers hold these keys, so renaming one
 * forgets what was saved under it.
 */
function localStore(): Storage | undefined {
	try {
		return window.localStorage;
	} catch {
		return undefined;
	}
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
