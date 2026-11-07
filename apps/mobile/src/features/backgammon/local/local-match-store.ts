/**
 * The one pass-and-play match kept on this phone. Stored whole in the
 * synchronous key-value store, so it survives a restart and works offline.
 */

import {
	type LocalMatch,
	parseLocalMatch,
} from "@arcadeclub/core/backgammon-local";
import Storage from "expo-sqlite/kv-store";

const KEY = "arcade:backgammon:local";

export function readLocalMatch(): LocalMatch | null {
	try {
		const raw = Storage.getItemSync(KEY);
		return raw ? parseLocalMatch(raw) : null;
	} catch {
		return null;
	}
}

export function writeLocalMatch(match: LocalMatch) {
	try {
		Storage.setItemSync(KEY, JSON.stringify(match));
	} catch {
		// Best-effort: the running match keeps working in memory.
	}
}

export function clearLocalMatch() {
	try {
		Storage.removeItemSync(KEY);
	} catch {
		// Nothing stored, or the store is unavailable.
	}
}
