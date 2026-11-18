import { messages } from "@arcadeclub/core/messages";
import type { Id } from "../../../convex/api";
import type { AccountSession } from "../saves/sudoku-cloud-sync";
import type { SudokuSaveSummary } from "../saves/sudoku-save-store";
import { buildSudokuList } from "./sudoku-list";

const copy = messages.en.games.sudoku;
const ME = "user_me";

const session = (
	id: string,
	createdAt: number,
	status: AccountSession["status"] = "active",
): AccountSession => ({
	sessionId: id as Id<"gameSessions">,
	title: `Web ${id}`,
	status,
	createdAt,
});

const summary = (
	id: string,
	updatedAt: number,
	cloud?: SudokuSaveSummary["cloud"],
): SudokuSaveSummary => ({
	id,
	variant: "killer",
	difficulty: "hard",
	status: "active",
	elapsedSeconds: 65,
	updatedAt,
	cloud,
});

describe("sudoku list", () => {
	it("shows a guest the phone's saves only", () => {
		const rows = buildSudokuList({
			saves: [summary("a", 1)],
			sessions: [],
			hidden: new Set(),
			signedIn: false,
			copy,
		});
		expect(rows).toMatchObject([
			{
				id: "a",
				title: "Killer · Hard",
				waitingToSync: false,
				inAccount: false,
			},
		]);
	});

	it("merges the account's sessions with the phone's copies and pending puzzles", () => {
		const rows = buildSudokuList({
			saves: [
				summary("copy", 5, { userId: ME, sessionId: "s1", synced: true }),
				summary("pending", 4, { userId: ME, synced: false }),
			],
			sessions: [
				session("s1", 1),
				session("s2", 3, "completed"),
				session("s3", 2),
			],
			hidden: new Set(["s3"]),
			signedIn: true,
			copy,
		});
		expect(rows.map((row) => row.id)).toEqual(["copy", "pending", "s2"]);
		expect(rows[0]).toMatchObject({
			title: "Web s1",
			inAccount: true,
			waitingToSync: false,
			elapsedSeconds: 65,
		});
		expect(rows[1]).toMatchObject({ waitingToSync: true, inAccount: false });
		// A session started on the web that this phone never opened.
		expect(rows[2]).toMatchObject({
			title: "Web s2",
			status: "completed",
			inAccount: true,
		});
		expect(rows[2].elapsedSeconds).toBeUndefined();
		expect(rows[2].saveId).toBeUndefined();
	});
});
