/**
 * Everything this phone keeps between launches, and the only importer of
 * `expo-sqlite/kv-store`: the one Expo persistence module with synchronous
 * reads, which is what lets the first frame already be in the right language
 * and scheme and a game screen open its save without a loading state.
 *
 * Every read and write is best-effort. A store that will not open is a phone
 * that forgets something, not an error, and a value that does not parse reads
 * as nothing was saved: `readJson` returns `null` when the parser rejects the
 * value or throws, so a parser can lean on the decoders the game itself uses.
 */
import Storage from "expo-sqlite/kv-store";

/** Every key this app stores. Installed apps hold these, so they never change. */
export const STORAGE_KEYS = {
	locale: "arcade:locale",
	appearance: "arcade:appearance",
	guest: "arcade:guest",
	displayName: "arcade:display-name",
	seats: "arcade:seats",
	backgammonLocal: "arcade:backgammon:local",
	sudokuIndex: "arcade:sudoku:index",
	sudokuSave: (id: string) => `arcade:sudoku:save:${id}`,
} as const;

/** What was stored under this key, or `null` if nothing readable was. */
export function readText(key: string): string | null {
	try {
		return Storage.getItemSync(key);
	} catch {
		return null;
	}
}

export function writeText(key: string, value: string) {
	try {
		Storage.setItemSync(key, value);
	} catch {
		// A full or locked store loses this write; the running game keeps working.
	}
}

export function readJson<T>(
	key: string,
	parse: (value: unknown) => T | null,
): T | null {
	try {
		const raw = Storage.getItemSync(key);
		return raw ? parse(JSON.parse(raw)) : null;
	} catch {
		return null;
	}
}

export function writeJson(key: string, value: unknown) {
	writeText(key, JSON.stringify(value));
}

export function remove(key: string) {
	try {
		Storage.removeItemSync(key);
	} catch {
		// Readers validate what they get back, so a leftover value is harmless.
	}
}
