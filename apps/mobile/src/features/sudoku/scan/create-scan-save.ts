/**
 * A checked scan as a classic puzzle on this phone: the printed digits are
 * its givens, the handwritten ones and the notes the player's progress. A
 * scan has no difficulty and no known solution; hints work by rule.
 */

import { serializeBoard } from "@arcadeclub/core/sudoku-board";
import type { ScanCell } from "@arcadeclub/core/sudoku-scan";
import { scanResultToBoardState } from "@arcadeclub/core/sudoku-scan";
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
