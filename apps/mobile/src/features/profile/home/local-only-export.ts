/**
 * What "Download my data" adds under `localOnly`: the data this phone keeps
 * only for itself. The guest identity is left out on purpose: its id proves
 * this phone's guest seats to the server, so a shared file must not hold it.
 * Seats leave out their seat secret for the same reason.
 */

import { readText, STORAGE_KEYS } from "../../../storage/local-store";
import { readLocalMatch } from "../../backgammon/local/local-match-store";
import { exportableSeats } from "../../sessions/session-seats";
import { readLocalOnlySudokuSaves } from "../../sudoku/saves/sudoku-save-store";

export function readLocalOnlyExport(userId: string | null) {
	return {
		/** The name typed on this phone; `null` when the player kept the default. */
		displayName: readText(STORAGE_KEYS.displayName)?.trim() || null,
		backgammon: readLocalMatch(),
		seats: exportableSeats(),
		sudoku: readLocalOnlySudokuSaves(userId),
	};
}
