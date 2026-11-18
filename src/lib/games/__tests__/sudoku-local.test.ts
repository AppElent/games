// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	forgetLocalSudokuSession,
	listLocalSudokuSessions,
	rememberLocalSudokuSession,
	withAccountSudokuSessions,
} from "#/lib/games/sudoku-local";

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

const row = (
	id: string,
	createdAt: number,
	gameType = "sudoku",
	status = "active",
) => ({
	session: { _id: id, _creationTime: createdAt, gameType, title: id, status },
});

describe("withAccountSudokuSessions", () => {
	beforeEach(() => vi.stubGlobal("localStorage", memoryStorage()));
	afterEach(() => vi.unstubAllGlobals());

	it("adds the account's sudoku sessions this browser does not list, newest first", () => {
		rememberLocalSudokuSession({
			sessionId: "here",
			title: "Here",
			source: "generated",
			createdAt: 2,
		});
		const merged = withAccountSudokuSessions(listLocalSudokuSessions(), [
			row("here", 2),
			row("from-app", 3),
			row("chess", 4, "chess"),
			row("cancelled", 5, "sudoku", "cancelled"),
		]);
		expect(merged.map((entry) => entry.sessionId)).toEqual([
			"from-app",
			"here",
		]);
	});

	it("keeps a removed account puzzle off this browser's list", () => {
		forgetLocalSudokuSession("from-app");
		expect(withAccountSudokuSessions([], [row("from-app", 3)])).toEqual([]);
	});
});
