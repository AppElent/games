/**
 * Everything this phone can resume, newest first. Each game decides what it
 * offers and how removing it works; the Play tab only lists what comes back.
 */
import type { Href } from "expo-router";
import { resumableItems as resumableMatch } from "../../backgammon/local/local-match-store";
import {
	resumableItems as resumableSeats,
	type Seat,
} from "../../sessions/session-seats";
import { resumableItems as resumablePuzzles } from "../../sudoku/saves/sudoku-save-store";
import type { AppGameType } from "../app-games";

export type ContinueItem = {
	id: string;
	gameType: AppGameType;
	href: Href;
	updatedAt: number;
	remove: () => void;
	/** This phone's seat when the game is online; saved games have none. */
	seat?: Seat;
};

/** Newest first. Online items may still turn out finished; see `online-status`. */
export function listContinueItems(now = Date.now()): ContinueItem[] {
	return [
		...resumablePuzzles(),
		...resumableMatch(),
		...resumableSeats(now),
	].sort((a, b) => b.updatedAt - a.updatedAt);
}
