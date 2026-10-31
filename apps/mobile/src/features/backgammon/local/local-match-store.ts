/**
 * The one pass-and-play match kept on this phone. Stored whole in the
 * synchronous key-value store, so it survives a restart and works offline.
 */
import Storage from "expo-sqlite/kv-store";
import {
	DEFAULT_BACKGAMMON_OPTIONS,
	HISTORY_LIMIT,
	type LocalMatch,
} from "./local-match";

const KEY = "arcade:backgammon:local";

function isMatch(value: unknown): value is LocalMatch {
	const match = value as LocalMatch | null;
	return (
		typeof match === "object" &&
		match !== null &&
		Array.isArray(match.state?.points) &&
		match.state.points.length === 24 &&
		Array.isArray(match.history) &&
		Array.isArray(match.future)
	);
}

export function readLocalMatch(): LocalMatch | null {
	try {
		const raw = Storage.getItemSync(KEY);
		if (!raw) return null;
		const parsed: unknown = JSON.parse(raw);
		if (!isMatch(parsed)) return null;
		return {
			...parsed,
			options: { ...DEFAULT_BACKGAMMON_OPTIONS, ...parsed.options },
		};
	} catch {
		return null;
	}
}

export function writeLocalMatch(match: LocalMatch) {
	try {
		Storage.setItemSync(
			KEY,
			JSON.stringify({
				...match,
				history: match.history.slice(-HISTORY_LIMIT),
			}),
		);
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
