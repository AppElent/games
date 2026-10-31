import { createBoardState, serializeBoard } from "@games/core/sudoku-board";
import {
	deleteSudokuSave,
	type GridSave,
	listSudokuSaves,
	readSudokuSave,
	writeSudokuSave,
} from "./sudoku-save-store";

function gridSave(
	id: string,
	updatedAt: number,
	status: GridSave["status"] = "active",
): GridSave {
	return {
		id,
		variant: "classic",
		difficulty: "easy",
		createdAt: updatedAt,
		updatedAt,
		elapsedSeconds: 0,
		status,
		board: serializeBoard(createBoardState(new Array(81).fill(0))),
		solution: "1".repeat(81),
		autoCleanup: true,
	};
}

describe("sudoku save store", () => {
	beforeEach(() => {
		for (const item of listSudokuSaves()) deleteSudokuSave(item.id);
	});

	it("round-trips a save and lists it newest first", () => {
		writeSudokuSave(gridSave("a", 1));
		writeSudokuSave(gridSave("b", 2));
		expect(listSudokuSaves().map((item) => item.id)).toEqual(["b", "a"]);
		const save = readSudokuSave("a");
		expect(save?.variant === "classic" && save.board.givens).toHaveLength(81);
	});

	it("updates in place rather than duplicating", () => {
		writeSudokuSave(gridSave("a", 1));
		writeSudokuSave({ ...gridSave("a", 5), elapsedSeconds: 42 });
		expect(listSudokuSaves()).toHaveLength(1);
		expect(listSudokuSaves()[0].elapsedSeconds).toBe(42);
	});

	it("drops solved puzzles first when over the limit", () => {
		writeSudokuSave(gridSave("solved", 0, "completed"));
		for (let index = 1; index <= 30; index += 1) {
			writeSudokuSave(gridSave(`p${index}`, index));
		}
		const ids = listSudokuSaves().map((item) => item.id);
		expect(ids).toHaveLength(30);
		expect(ids).not.toContain("solved");
		expect(readSudokuSave("solved")).toBeNull();
	});

	it("deletes the entry and its summary", () => {
		writeSudokuSave(gridSave("a", 1));
		deleteSudokuSave("a");
		expect(listSudokuSaves()).toEqual([]);
		expect(readSudokuSave("a")).toBeNull();
	});
});
