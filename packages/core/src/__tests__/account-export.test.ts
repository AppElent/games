import { describe, expect, it, vi } from "vitest";
import {
	type AccountExportCursor,
	type AccountExportPage,
	accountExportFileName,
	buildAccountExport,
} from "../account-export";

const PAGES: AccountExportPage[] = [
	{ tables: { quizSets: [{ id: 1 }] }, next: { source: 1, page: null } },
	{
		tables: { gameSessions: [{ id: 2 }], sessionParticipants: [{ id: 3 }] },
		next: { source: 1, page: "c1" },
	},
	{ tables: { gameSessions: [{ id: 4 }] }, next: null },
];

describe("buildAccountExport", () => {
	it("follows every cursor and merges the pages per table", async () => {
		const fetchPage = vi.fn(
			async (_cursor: AccountExportCursor | null) =>
				PAGES[fetchPage.mock.calls.length - 1],
		);
		const data = await buildAccountExport({
			fetchPage,
			now: new Date("2026-11-18T09:30:00Z"),
		});
		expect(fetchPage.mock.calls.map(([cursor]) => cursor)).toEqual([
			null,
			{ source: 1, page: null },
			{ source: 1, page: "c1" },
		]);
		expect(data).toEqual({
			app: "Arcade Club",
			format: 1,
			exportedAt: "2026-11-18T09:30:00.000Z",
			tables: {
				quizSets: [{ id: 1 }],
				gameSessions: [{ id: 2 }, { id: 4 }],
				sessionParticipants: [{ id: 3 }],
			},
		});
	});

	it("adds what the phone keeps only locally under localOnly", async () => {
		const data = await buildAccountExport({
			fetchPage: async () => ({ tables: {}, next: null }),
			now: new Date(0),
			localOnly: { sudoku: [] },
		});
		expect(data.localOnly).toEqual({ sudoku: [] });
	});
});

describe("accountExportFileName", () => {
	it("dates the file in local time", () => {
		expect(accountExportFileName(new Date(2026, 0, 5, 23, 59))).toBe(
			"arcade-club-export-2026-01-05.json",
		);
	});
});
