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
	adoptGuestSaves,
	type BinarySave,
	deleteSudokuSave,
	findSudokuSaveBySession,
	forgetAccountSaves,
	type GridSave,
	hiddenSudokuSessions,
	listSudokuSaves,
	markSynced,
	readLocalOnlySudokuSaves,
	readSudokuSave,
	removeSudokuSave,
	resumableItems,
	storeSyncedSave,
	updateCloudLink,
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

const ME = "user_me";

function clearAll() {
	for (const owner of [null, ME, "user_other"]) {
		for (const item of listSudokuSaves(owner)) deleteSudokuSave(item.id);
	}
}

describe("sudoku save store", () => {
	beforeEach(clearAll);

	it("round-trips a save and lists it newest first", () => {
		writeSudokuSave(gridSave("a", 1));
		writeSudokuSave(gridSave("b", 2));
		expect(listSudokuSaves().map((item) => item.id)).toEqual(["b", "a"]);
		const save = readSudokuSave("a");
		expect(save?.variant === "classic" && save.board.givens).toHaveLength(81);
	});

	it("reads every playable save, newest first, for the export", () => {
		writeSudokuSave(gridSave("a", 1));
		writeSudokuSave(gridSave("b", 2));
		writeText(STORAGE_KEYS.sudokuSave("a"), "not json");
		expect(readLocalOnlySudokuSaves(null).map((save) => save.id)).toEqual([
			"b",
		]);
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
			["an unknown source", { ...valid, source: "camera" }],
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

	describe("account puzzles", () => {
		const mine = (id: string, updatedAt: number, sessionId?: string) => ({
			...gridSave(id, updatedAt),
			cloud: { userId: ME, sessionId, synced: true },
		});

		it("shows each viewer only their own puzzles", () => {
			writeSudokuSave(gridSave("guest", 1));
			writeSudokuSave(mine("mine", 2, "s1"));
			writeSudokuSave({
				...gridSave("theirs", 3),
				cloud: { userId: "user_other", synced: true },
			});
			expect(listSudokuSaves(null).map((item) => item.id)).toEqual(["guest"]);
			// Signed in, the guest saves about to become the account's show too.
			expect(listSudokuSaves(ME).map((item) => item.id)).toEqual([
				"mine",
				"guest",
			]);
			expect(resumableItems(null).map((item) => item.id)).toEqual([
				"sudoku:guest",
			]);
		});

		it("keeps the stored link on a game write and marks it unsent", () => {
			writeSudokuSave({
				...gridSave("a", 1),
				cloud: { userId: ME, synced: false },
			});
			// The sync links the session while the screen holds the old copy.
			updateCloudLink("a", (link) => ({ ...link, sessionId: "s1" }));
			markSynced("a", readSudokuSave("a")?.updatedAt ?? 0);
			writeSudokuSave({ ...gridSave("a", 2), elapsedSeconds: 5 });
			expect(readSudokuSave("a")?.cloud).toEqual({
				userId: ME,
				sessionId: "s1",
				synced: false,
			});
			expect(findSudokuSaveBySession("s1")?.elapsedSeconds).toBe(5);
		});

		it("marks a save synced only when nothing was written after the sent one", () => {
			writeSudokuSave({
				...gridSave("a", 10),
				cloud: { userId: ME, synced: false },
			});
			const sent = readSudokuSave("a")?.updatedAt ?? 0;
			// Same clock reading: the write still moves `updatedAt` on.
			writeSudokuSave(gridSave("a", 10));
			markSynced("a", sent);
			expect(readSudokuSave("a")?.cloud?.synced).toBe(false);
			markSynced("a", readSudokuSave("a")?.updatedAt ?? 0);
			expect(readSudokuSave("a")?.cloud?.synced).toBe(true);
		});

		it("never drops a puzzle with unsent changes to make room", () => {
			writeSudokuSave({
				...gridSave("unsent", 0, "completed"),
				cloud: { userId: ME, synced: false },
			});
			storeSyncedSave(mine("synced", 0, "s0"));
			for (let index = 1; index <= 30; index += 1) {
				writeSudokuSave(gridSave(`p${index}`, index));
			}
			expect(readSudokuSave("unsent")).not.toBeNull();
			expect(readSudokuSave("synced")).toBeNull();
		});

		it("hands the guest saves to the account that signs in, removing none", () => {
			writeSudokuSave(gridSave("guest", 1));
			adoptGuestSaves(ME);
			expect(readSudokuSave("guest")?.cloud).toEqual({
				userId: ME,
				synced: false,
			});
			expect(listSudokuSaves(null)).toEqual([]);
		});

		it("removes an account puzzle from this phone's list only", () => {
			writeSudokuSave(mine("a", 1, "s1"));
			removeSudokuSave("a");
			expect(readSudokuSave("a")).toBeNull();
			expect(hiddenSudokuSessions().has("s1")).toBe(true);
		});

		it("exports what the account does not hold yet", () => {
			writeSudokuSave(gridSave("guest", 1));
			writeSudokuSave(mine("synced", 2, "s1"));
			writeSudokuSave({
				...gridSave("pending", 3),
				cloud: { userId: ME, synced: false },
			});
			writeSudokuSave({
				...gridSave("theirs", 4),
				cloud: { userId: "user_other", synced: false },
			});
			expect(readLocalOnlySudokuSaves(ME).map((save) => save.id)).toEqual([
				"pending",
				"guest",
			]);
		});

		it("forgets a deleted account's puzzles and keeps the rest", () => {
			writeSudokuSave(gridSave("guest", 1));
			writeSudokuSave(mine("mine", 2, "s1"));
			forgetAccountSaves(ME);
			expect(readSudokuSave("mine")).toBeNull();
			expect(readSudokuSave("guest")).not.toBeNull();
		});

		it("opens a puzzle from the account, which has no solution or difficulty", () => {
			const {
				solution: _solution,
				difficulty: _difficulty,
				...rest
			} = mine("web", 1, "s1");
			writeSudokuSave(rest);
			expect(readSudokuSave("web")).not.toBeNull();
			// Only a save from the account may lack them.
			const { cloud: _cloud, ...guest } = rest;
			writeJson(STORAGE_KEYS.sudokuSave("bare"), { ...guest, id: "bare" });
			expect(readSudokuSave("bare")).toBeNull();
		});
	});

	it("opens a scanned puzzle, which has no solution or difficulty", () => {
		const {
			solution: _solution,
			difficulty: _difficulty,
			...rest
		} = gridSave("scan", 1);
		writeSudokuSave({ ...rest, source: "scan" });
		expect(readSudokuSave("scan")).toMatchObject({ source: "scan" });
		expect(listSudokuSaves()).toEqual([
			expect.objectContaining({ id: "scan", source: "scan" }),
		]);
	});
});
