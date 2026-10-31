/**
 * Everything this phone can resume, newest first: online seats from the seat
 * store, local Sudoku saves and the pass-and-play backgammon match.
 */
import { getBackgammonWinner } from "@games/core/backgammon";
import type { Href } from "expo-router";
import { readLocalMatch } from "../../backgammon/local/local-match-store";
import {
	type AppGameType,
	isAppGameType,
	onlineSessionHref,
} from "../../sessions/session-links";
import { listSeats } from "../../sessions/session-seats";
import { listSudokuSaves } from "../../sudoku/saves/sudoku-save-store";

export type ContinueItem = {
	id: string;
	gameType: AppGameType;
	kind: "online" | "saved";
	href: Href;
	updatedAt: number;
};

const ONLINE_WINDOW_MS = 24 * 60 * 60_000;
const LIMIT = 5;

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
						kind: "online" as const,
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
			kind: "saved" as const,
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
			kind: "saved",
			href: "/backgammon/local",
			updatedAt: match.updatedAt,
		},
	];
}

export function listContinueItems(now = Date.now()): ContinueItem[] {
	return [...unfinishedPuzzles(), ...localBackgammon(), ...onlineSeats(now)]
		.sort((a, b) => b.updatedAt - a.updatedAt)
		.slice(0, LIMIT);
}
