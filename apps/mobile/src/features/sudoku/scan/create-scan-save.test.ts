import { digitMask } from "@arcadeclub/core/sudoku";
import { emptyScanResult } from "@arcadeclub/core/sudoku-scan";
import { readSudokuSave, writeSudokuSave } from "../saves/sudoku-save-store";
import { createScanSave } from "./create-scan-save";

function scannedCells() {
	const cells = emptyScanResult();
	cells[0] = { ...cells[0], type: "given", digit: 5 };
	cells[1] = { ...cells[1], type: "userDigit", digit: 3 };
	cells[2] = { ...cells[2], type: "cornerNotes", cornerMask: digitMask(4) };
	return cells;
}

describe("createScanSave", () => {
	it("keeps printed digits as givens and the rest as progress", () => {
		const save = createScanSave(scannedCells(), null, 1000);
		expect(save).toMatchObject({
			source: "scan",
			variant: "classic",
			status: "active",
			elapsedSeconds: 0,
			updatedAt: 1000,
		});
		expect(save.difficulty).toBeUndefined();
		expect(save.solution).toBeUndefined();
		expect(save.cloud).toBeUndefined();
		expect(save.board.givens.slice(0, 3)).toBe("500");
		expect(save.board.digits.slice(0, 3)).toBe("030");
		expect(save.board.corner[2]).toBe(digitMask(4));
	});

	it("links a signed-in player's scan to their account", () => {
		const save = createScanSave(scannedCells(), "user_me", 1000);
		expect(save.cloud).toEqual({ userId: "user_me", synced: false });
	});

	it("stores as a puzzle the game screen can open", () => {
		const save = createScanSave(scannedCells(), null, 1000);
		writeSudokuSave(save);
		expect(readSudokuSave(save.id)).toMatchObject({ source: "scan" });
	});
});
