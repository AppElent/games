import { newLocalMatch } from "@arcadeclub/core/backgammon-local";
import type { GameType } from "@arcadeclub/core/games";
import type { Id } from "../../../convex/api";
import { STORAGE_KEYS, writeText } from "../../../storage/local-store";
import {
	clearLocalMatch,
	readLocalMatch,
	writeLocalMatch,
} from "../../backgammon/local/local-match-store";
import { findSeat, rememberSeat } from "../../sessions/session-seats";
import {
	deleteSudokuSave,
	type GridSave,
	listSudokuSaves,
	readSudokuSave,
	writeSudokuSave,
} from "../../sudoku/saves/sudoku-save-store";
import { listContinueItems } from "./continue-items";

const DAY = 24 * 60 * 60_000;

function seat(sessionId: string, gameType: GameType, joinedAt: number) {
	return {
		sessionId: sessionId as Id<"gameSessions">,
		participantId: `${sessionId}-me` as Id<"sessionParticipants">,
		gameType,
		joinedAt,
	};
}

const save: GridSave = {
	id: "p1",
	variant: "classic",
	difficulty: "easy",
	createdAt: 1,
	updatedAt: 2_000,
	elapsedSeconds: 0,
	status: "active",
	board: {
		givens: "0".repeat(81),
		digits: "0".repeat(81),
		corner: new Array(81).fill(0),
		center: new Array(81).fill(0),
		colors: new Array(81).fill(0),
	},
	solution: "1".repeat(81),
	autoCleanup: true,
};

describe("continue items", () => {
	beforeEach(() => {
		writeText(STORAGE_KEYS.seats, "[]");
		clearLocalMatch();
		for (const item of listSudokuSaves()) deleteSudokuSave(item.id);
	});

	it("merges every game's items, newest first, under stable ids", () => {
		writeSudokuSave(save);
		writeLocalMatch({
			...newLocalMatch(3_000),
			history: [newLocalMatch(0).state],
		});
		writeText(
			STORAGE_KEYS.seats,
			JSON.stringify([
				seat("hit", "hitster", 1_000),
				seat("bg", "backgammon", 4_000),
			]),
		);
		const items = listContinueItems(5_000);
		expect(items.map((item) => item.id)).toEqual([
			"online:bg",
			"backgammon:local",
			"sudoku:p1",
			"online:hit",
		]);
		expect(items[0]).toMatchObject({
			gameType: "backgammon",
			href: {
				pathname: "/backgammon/online/[sessionId]",
				params: { sessionId: "bg" },
			},
			seat: { sessionId: "bg", participantId: "bg-me" },
		});
		expect(items[3].href).toEqual({
			pathname: "/hitster/[sessionId]",
			params: { sessionId: "hit" },
		});
		expect(items[1].seat).toBeUndefined();
		expect(items[2].seat).toBeUndefined();
	});

	it("leaves out web-only games and seats older than a week", () => {
		writeText(
			STORAGE_KEYS.seats,
			JSON.stringify([
				seat("web", "chess", 8 * DAY),
				seat("solo", "sudoku", 8 * DAY),
				seat("old", "hitster", 0),
				seat("new", "hitster", DAY),
			]),
		);
		expect(listContinueItems(8 * DAY).map((item) => item.id)).toEqual([
			"online:new",
		]);
	});

	it("lets each item remove only itself", () => {
		writeSudokuSave(save);
		writeLocalMatch({
			...newLocalMatch(3_000),
			history: [newLocalMatch(0).state],
		});
		rememberSeat(seat("bg", "backgammon", 0));
		const byId = (id: string) => {
			const item = listContinueItems().find((entry) => entry.id === id);
			if (!item) throw new Error(id);
			return item;
		};

		byId("online:bg").remove();
		expect(findSeat("bg")).toBeUndefined();
		expect(readLocalMatch()).not.toBeNull();
		expect(readSudokuSave("p1")).not.toBeNull();

		byId("backgammon:local").remove();
		expect(readLocalMatch()).toBeNull();
		expect(readSudokuSave("p1")).not.toBeNull();

		byId("sudoku:p1").remove();
		expect(readSudokuSave("p1")).toBeNull();
		expect(listContinueItems()).toEqual([]);
	});
});
