// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listLocalSudokuSessions } from "#/lib/games/sudoku-local";
import { createSudokuSession } from "#/lib/games/sudoku-session";
import type { Id } from "../../../../convex/_generated/dataModel";

const ARGS = {
	title: "Morning puzzle",
	displayName: "Solver",
	source: "generated" as const,
	difficulty: "easy" as const,
	givens: "0".repeat(81),
};

const created = {
	sessionId: "session_1" as Id<"gameSessions">,
	participantId: "participant_1" as Id<"sessionParticipants">,
};

/** A fresh localStorage per test; newer Node ships an empty global one that hides jsdom's. */
function memoryStorage(): Storage {
	const items = new Map<string, string>();
	return {
		get length() {
			return items.size;
		},
		clear: () => items.clear(),
		getItem: (key) => items.get(key) ?? null,
		key: (index) => [...items.keys()][index] ?? null,
		removeItem: (key) => {
			items.delete(key);
		},
		setItem: (key, value) => {
			items.set(key, value);
		},
	};
}

describe("createSudokuSession", () => {
	beforeEach(() => vi.stubGlobal("localStorage", memoryStorage()));
	afterEach(() => vi.unstubAllGlobals());

	it("lists the stored puzzle on this device so it can be resumed", async () => {
		await expect(
			createSudokuSession(async () => created, ARGS),
		).resolves.toEqual(created);
		expect(listLocalSudokuSessions()).toEqual([
			expect.objectContaining({
				sessionId: "session_1",
				title: "Morning puzzle",
				difficulty: "easy",
				source: "generated",
			}),
		]);
	});

	it("lists nothing when the server rejects the puzzle", async () => {
		await expect(
			createSudokuSession(async () => {
				throw new Error("invalidPuzzleData");
			}, ARGS),
		).rejects.toThrow("invalidPuzzleData");
		expect(listLocalSudokuSessions()).toEqual([]);
	});
});
