import {
	createBoardState,
	serializeBoard,
} from "@arcadeclub/core/sudoku-board";
import {
	remove,
	STORAGE_KEYS,
	writeJson,
	writeText,
} from "../../../storage/local-store";
import {
	type BinarySave,
	deleteSudokuSave,
	type GridSave,
	listSudokuSaves,
	readSudokuSave,
	resumableItems,
	writeSudokuSave,
} from "./sudoku-save-store";

function base(
	id: string,
	updatedAt: number,
	status: GridSave["status"] = "active",
) {
	return {
		id,
		difficulty: "easy" as const,
		updatedAt,
		elapsedSeconds: 0,
		status,
	};
}

function gridSave(
	id: string,
	updatedAt: number,
	status: GridSave["status"] = "active",
): GridSave {
	return {
		...base(id, updatedAt, status),
		variant: "classic",
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

	it("loads every kind of save the app writes", () => {
		const { board, ...rest } = gridSave("killer", 1);
		const killer: GridSave = {
			...rest,
			board,
			variant: "killer",
			cages: [{ sum: 10, cells: [0, 1] }],
		};
		const binary: BinarySave = {
			...base("binary", 1),
			variant: "binary",
			size: 6,
			givens: "0".repeat(36),
			entries: "1".repeat(36),
		};
		writeSudokuSave(killer);
		writeSudokuSave(binary);
		expect(readSudokuSave("killer")).toEqual(killer);
		expect(readSudokuSave("binary")).toEqual(binary);
	});

	it("loads an older save that still has fields no screen reads", () => {
		const old = { ...gridSave("old", 1), createdAt: 1 };
		writeJson(STORAGE_KEYS.sudokuSave("old"), old);
		expect(readSudokuSave("old")).toEqual(old);
	});

	describe("a corrupt save reads as no save", () => {
		const valid = gridSave("bad", 1);
		const board = valid.board;
		const binary = {
			...base("bad", 1),
			variant: "binary",
			size: 6,
			givens: "0".repeat(36),
			entries: "0".repeat(36),
		};
		it.each<[string, unknown]>([
			["another puzzle's id", { ...valid, id: "other" }],
			["an unknown variant", { ...valid, variant: "giant" }],
			["an unknown difficulty", { ...valid, difficulty: "brutal" }],
			["a missing clock", { ...valid, elapsedSeconds: undefined }],
			["a short board", { ...valid, board: { ...board, digits: "12" } }],
			[
				"letters on the board",
				{ ...valid, board: { ...board, givens: "x".repeat(81) } },
			],
			["no board", { ...valid, board: undefined }],
			["notes that are no list", { ...valid, board: { ...board, corner: 3 } }],
			["a short solution", { ...valid, solution: "12" }],
			["no solution", { ...valid, solution: undefined }],
			["malformed cages", { ...valid, cages: [{ sum: "ten" }] }],
			["a binary grid of the wrong size", { ...binary, size: 8 }],
			["binary entries out of range", { ...binary, entries: "9".repeat(36) }],
			["a binary size that is no number", { ...binary, size: "6" }],
		])("%s", (_name, save) => {
			writeJson(STORAGE_KEYS.sudokuSave("bad"), save);
			expect(readSudokuSave("bad")).toBeNull();
		});

		it("bad JSON", () => {
			writeText(STORAGE_KEYS.sudokuSave("bad"), "{not json");
			expect(readSudokuSave("bad")).toBeNull();
		});
	});

	it("drops bad summaries and reads a corrupt index as empty", () => {
		const good = { ...base("good", 1), variant: "classic" };
		writeJson(STORAGE_KEYS.sudokuIndex, [good, { id: "bad" }, null]);
		expect(listSudokuSaves().map((item) => item.id)).toEqual(["good"]);
		writeText(STORAGE_KEYS.sudokuIndex, "{not json");
		expect(listSudokuSaves()).toEqual([]);
		remove(STORAGE_KEYS.sudokuIndex);
	});

	it("offers unfinished puzzles to resume, each removing its own save", () => {
		writeSudokuSave(gridSave("open", 2));
		writeSudokuSave(gridSave("done", 3, "completed"));
		const items = resumableItems();
		expect(items.map((item) => item.id)).toEqual(["sudoku:open"]);
		expect(items[0]).toMatchObject({
			gameType: "sudoku",
			updatedAt: 2,
			href: { pathname: "/sudoku/[id]", params: { id: "open" } },
		});
		items[0].remove();
		expect(readSudokuSave("open")).toBeNull();
		expect(readSudokuSave("done")).not.toBeNull();
	});
});
