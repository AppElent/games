/**
 * The one pass-and-play match kept on this phone. Stored whole in the
 * synchronous local store, so it survives a restart and works offline.
 */

import { getBackgammonWinner } from "@arcadeclub/core/backgammon";
import {
	type LocalMatch,
	newLocalMatch,
	parseLocalMatch,
} from "@arcadeclub/core/backgammon-local";
import type { Href } from "expo-router";
import {
	readText,
	remove,
	STORAGE_KEYS,
	writeJson,
} from "../../../storage/local-store";

export const LOCAL_MATCH_HREF: Href = "/backgammon/local";

export function readLocalMatch(): LocalMatch | null {
	const raw = readText(STORAGE_KEYS.backgammonLocal);
	return raw ? parseLocalMatch(raw) : null;
}

export function writeLocalMatch(match: LocalMatch) {
	writeJson(STORAGE_KEYS.backgammonLocal, match);
}

export function clearLocalMatch() {
	remove(STORAGE_KEYS.backgammonLocal);
}

/** Replaces the saved match with a new one, back on the default options. */
export function startNewLocalMatch() {
	writeLocalMatch(newLocalMatch(Date.now()));
}

/** The backgammon hub offers Continue once anyone has rolled or moved. */
export function hubOffersContinue(match: LocalMatch) {
	return (
		getBackgammonWinner(match.state.off) === null &&
		(match.history.length > 0 || match.state.dice.length > 0)
	);
}

/** The Play tab lists the match only once someone has moved, not just rolled. */
export function playHomeListsMatch(match: LocalMatch) {
	return (
		getBackgammonWinner(match.state.off) === null && match.history.length > 0
	);
}

/** The match, if the Play tab lists it. Removing it deletes the match. */
export function resumableItems() {
	const match = readLocalMatch();
	if (!match || !playHomeListsMatch(match)) return [];
	return [
		{
			id: "backgammon:local",
			gameType: "backgammon" as const,
			href: LOCAL_MATCH_HREF,
			updatedAt: match.updatedAt,
			remove: clearLocalMatch,
		},
	];
}
