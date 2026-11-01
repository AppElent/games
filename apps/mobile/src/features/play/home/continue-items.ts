/**
 * Everything this phone can resume, newest first: online seats from the seat
 * store, local Sudoku saves and the pass-and-play backgammon match.
 */
import { getBackgammonWinner } from "@arcadeclub/core/backgammon";
import type { Href } from "expo-router";
import {
	clearLocalMatch,
	readLocalMatch,
} from "../../backgammon/local/local-match-store";
import {
	type AppGameType,
	isAppGameType,
	onlineSessionHref,
} from "../../sessions/session-links";
import { forgetSeat, listSeats } from "../../sessions/session-seats";
import {
	deleteSudokuSave,
	listSudokuSaves,
} from "../../sudoku/saves/sudoku-save-store";

/** Where an item lives, which is also what removing it deletes. */
export type ContinueSource =
	| { kind: "online"; sessionId: string; participantId: string }
	| { kind: "sudoku"; saveId: string }
	| { kind: "backgammon" };

export type ContinueItem = {
	id: string;
	gameType: AppGameType;
	source: ContinueSource;
	href: Href;
	updatedAt: number;
};

/** Finished online games drop out once the screen sees their status. */
const ONLINE_WINDOW_MS = 7 * 24 * 60 * 60_000;

function onlineSeats(now: number): ContinueItem[] {
	return listSeats().flatMap((seat) => {
		if (now - seat.joinedAt > ONLINE_WINDOW_MS) return [];
		if (!isAppGameType(seat.gameType)) return [];
		const href = onlineSessionHref(seat.gameType, seat.sessionId);
		return href
			? [
					{
						id: `online:${seat.sessionId}`,
						gameType: seat.gameType,
						source: {
							kind: "online" as const,
							sessionId: seat.sessionId,
							participantId: seat.participantId,
						},
						href,
						updatedAt: seat.joinedAt,
					},
				]
			: [];
	});
}

function unfinishedPuzzles(): ContinueItem[] {
	return listSudokuSaves()
		.filter((save) => save.status !== "completed")
		.map((save) => ({
			id: `sudoku:${save.id}`,
			gameType: "sudoku" as const,
			source: { kind: "sudoku" as const, saveId: save.id },
			href: { pathname: "/sudoku/[id]", params: { id: save.id } },
			updatedAt: save.updatedAt,
		}));
}

function localBackgammon(): ContinueItem[] {
	const match = readLocalMatch();
	if (!match || match.history.length === 0) return [];
	if (getBackgammonWinner(match.state.off)) return [];
	return [
		{
			id: "backgammon:local",
			gameType: "backgammon",
			source: { kind: "backgammon" },
			href: "/backgammon/local",
			updatedAt: match.updatedAt,
		},
	];
}

/** Newest first. Online items may still turn out finished; see `online-status`. */
export function listContinueItems(now = Date.now()): ContinueItem[] {
	return [
		...unfinishedPuzzles(),
		...localBackgammon(),
		...onlineSeats(now),
	].sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Online: forgets this phone's seat (the game goes on). Saved: deletes it. */
export function removeContinueItem(source: ContinueSource) {
	if (source.kind === "online") forgetSeat(source.sessionId);
	else if (source.kind === "sudoku") deleteSudokuSave(source.saveId);
	else clearLocalMatch();
}
