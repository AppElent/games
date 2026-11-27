/**
 * A checked scan as a classic puzzle on this phone: the printed digits are
 * its givens, the handwritten ones and the notes the player's progress. A
 * scan has no difficulty and no known solution; hints work by rule.
 */

import {
	createBoardState,
	serializeBoard,
} from "@arcadeclub/core/sudoku-board";
import type { ScanCell } from "@arcadeclub/core/sudoku-scan";
import { scanResultToBoardState } from "@arcadeclub/core/sudoku-scan";
import {
	type KillerScan,
	killerScanCages,
} from "@arcadeclub/core/sudoku-scan-cages";
import { type GridSave, newSaveId } from "../saves/sudoku-save-store";

export function createScanSave(
	cells: ScanCell[],
	userId: string | null,
	now = Date.now(),
): GridSave {
	return {
		id: newSaveId(now),
		source: "scan",
		variant: "classic",
		board: serializeBoard(scanResultToBoardState(cells)),
		autoCleanup: true,
		updatedAt: now,
		elapsedSeconds: 0,
		status: "active",
		...(userId ? { cloud: { userId, synced: false } } : {}),
	};
}

/**
 * A checked Killer scan as a Killer on this phone: its cages and sums, and an
 * empty grid. Call it once `checkKillerScan` finds nothing wrong.
 */
export function createKillerScanSave(
	scan: KillerScan,
	userId: string | null,
	now = Date.now(),
): GridSave {
	return {
		id: newSaveId(now),
		source: "scan",
		variant: "killer",
		board: serializeBoard(createBoardState(new Array<number>(81).fill(0))),
		cages: killerScanCages(scan).map((cage) => ({
			cells: cage.cells,
			sum: cage.sum ?? 0,
		})),
		autoCleanup: true,
		updatedAt: now,
		elapsedSeconds: 0,
		status: "active",
		...(userId ? { cloud: { userId, synced: false } } : {}),
	};
}
