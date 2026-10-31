/**
 * Phone-local preferences that must be readable before the first frame:
 * appearance, language and the guest identity.
 *
 * `expo-sqlite/kv-store` is the only Expo persistence module with synchronous
 * reads (`getItemSync`), which is what lets the first frame already be in the
 * right language and scheme. Every read and write is best-effort: a store that
 * will not open is a phone that forgets a preference, not an error.
 */
import Storage from "expo-sqlite/kv-store";

/** Namespaced so the store stays legible in a debugger. */
export const PREFERENCE_KEYS = {
	locale: "arcade:locale",
	appearance: "arcade:appearance",
	guest: "arcade:guest",
	displayName: "arcade:display-name",
} as const;

export type PreferenceKey =
	(typeof PREFERENCE_KEYS)[keyof typeof PREFERENCE_KEYS];

/** What was stored under this key, or `null` if nothing readable was. */
export function readPreference(key: PreferenceKey): string | null {
	try {
		return Storage.getItemSync(key);
	} catch {
		return null;
	}
}

export function writePreference(key: PreferenceKey, value: string) {
	try {
		Storage.setItemSync(key, value);
		return true;
	} catch {
		return false;
	}
}

export function clearPreference(key: PreferenceKey) {
	try {
		Storage.removeItemSync(key);
	} catch {
		// Ignored: every reader validates what it gets back anyway.
	}
}
