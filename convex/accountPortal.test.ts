import { collectAccountExport } from "@arcadeclub/core/account-export";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import type { TableNames } from "./_generated/dataModel";
import { COUNT_KEYS } from "./accountPortal";
import { ownerRows } from "./lib/accountExport";
import schema from "./schema";
import {
	advance,
	expectCode,
	freezeClock,
	guestIdOf,
	HOST_USER,
	hostSession,
	joinWithCode,
	setup,
	type T,
} from "./test.helpers";

freezeClock();

const OTHER_USER = "user_other";
const TABLES = Object.keys(schema.tables) as TableNames[];

/** Every page the portal asks for, merged per table, and how many it took. */
async function drain(t: T, subject: string) {
	const user = t.withIdentity({ subject });
	const tables: Record<string, unknown[]> = {};
	let cursor: string | null = null;
	let pages = 0;
	do {
		const page: {
			contract: 1;
			app: "arcade";
			tables: Record<string, unknown[]>;
			next: string | null;
		} = await user.query(api.accountPortal.exportPage, { cursor });
		expect(page.contract).toBe(1);
		expect(page.app).toBe("arcade");
		for (const [table, rows] of Object.entries(page.tables)) {
			tables[table] = [...(tables[table] ?? []), ...rows];
		}
		cursor = page.next;
		pages += 1;
	} while (cursor !== null);
	return { tables, pages };
}

function createDraft(t: T, subject: string, title = "Draft") {
	return t.withIdentity({ subject }).mutation(api.workbench.createDraft, {
		kind: "quiz-set",
		title,
		payload: "{}",
	});
}

function createQuizSet(t: T, subject: string) {
	return t.withIdentity({ subject }).mutation(api.quiz.createSet, {
		title: "Mine",
		questions: [],
	});
}

async function rowCount(t: T) {
	return await t.run(async (ctx) => {
		let rows = 0;
		for (const table of TABLES) {
			rows += (await ctx.db.query(table).collect()).length;
		}
		return rows;
	});
}

describe("accountPortal", () => {
	it("gives a never-used caller null, no blocker and an empty export, and writes nothing", async () => {
		const t = setup();
		const user = t.withIdentity({ subject: HOST_USER });

		expect(await user.query(api.accountPortal.summary, {})).toBeNull();
		expect(await user.query(api.accountPortal.deletionBlocker, {})).toBeNull();
		expect(
			await user.query(api.accountPortal.exportPage, { cursor: null }),
		).toEqual({ contract: 1, app: "arcade", tables: {}, next: null });
		expect(await rowCount(t)).toBe(0);
	});

	it("gives a signed-out caller the same nothing", async () => {
		const t = setup();
		await createDraft(t, HOST_USER);

		expect(await t.query(api.accountPortal.summary, {})).toBeNull();
		expect(await t.query(api.accountPortal.deletionBlocker, {})).toBeNull();
		expect(
			await t.query(api.accountPortal.exportPage, { cursor: null }),
		).toEqual({ contract: 1, app: "arcade", tables: {}, next: null });
	});

	it("counts a populated caller's data and drains the whole export to next: null", async () => {
		const t = setup();
		const sessions = [];
		for (let index = 0; index < 12; index += 1) {
			sessions.push((await hostSession(t, "live-quiz", "solo")).sessionId);
		}
		for (let index = 0; index < 55; index += 1) {
			await createDraft(t, HOST_USER, `Draft ${index}`);
		}
		await createQuizSet(t, HOST_USER);
		const before = await rowCount(t);

		expect(
			await t
				.withIdentity({ subject: HOST_USER })
				.query(api.accountPortal.summary, {}),
		).toEqual({
			contract: 1,
			lastActiveAt: null,
			counts: [
				{ key: "gameSeats", count: 12, more: false },
				{ key: "drafts", count: 55, more: false },
				{ key: "quizSets", count: 1, more: false },
			],
		});

		const { tables, pages } = await drain(t, HOST_USER);
		expect(pages).toBeGreaterThan(3);
		expect(tables.contentDrafts).toHaveLength(55);
		expect(tables.quizSets).toHaveLength(1);
		expect(tables.sessionParticipants).toHaveLength(12);
		expect(
			(tables.gameSessions as { _id: string }[]).map((row) => row._id).sort(),
		).toEqual([...sessions].sort());
		// The same rows as the in-app "Download my data".
		const user = t.withIdentity({ subject: HOST_USER });
		expect(tables).toEqual(
			await collectAccountExport((cursor) =>
				user.query(api.account.exportMyData, { cursor }),
			),
		);
		expect(await rowCount(t)).toBe(before);
	});

	it("caps each count at 1,000 reads and says there are more", async () => {
		const t = setup();
		await t.run(async (ctx) => {
			for (let index = 0; index < 1001; index += 1) {
				await ctx.db.insert("contentDrafts", {
					ownerUserId: HOST_USER,
					gameType: "live-quiz",
					kind: "quiz-set",
					title: `Draft ${index}`,
					payload: "{}",
					status: "draft",
					validationErrors: [],
				});
			}
		});

		const result = await t
			.withIdentity({ subject: HOST_USER })
			.query(api.accountPortal.summary, {});
		expect(result?.counts).toContainEqual({
			key: "drafts",
			count: 1000,
			more: true,
		});
	});

	it("reports an active game as the deletion blocker until the game goes quiet", async () => {
		const t = setup();
		const room = await hostSession(t, "live-quiz", "room");
		await joinWithCode(t, room.joinCode as string, guestIdOf("a"));

		expect(
			await room.host.query(api.accountPortal.deletionBlocker, {}),
		).toEqual({ code: "accountInActiveGame", params: { minutes: 30 } });
		await expectCode(
			room.host.mutation(api.account.deleteMyData, {
				expectedSubject: HOST_USER,
			}),
			"accountInActiveGame",
			{ minutes: 30 },
		);

		advance(31 * 60_000);
		expect(
			await room.host.query(api.accountPortal.deletionBlocker, {}),
		).toBeNull();
	});

	it("shows a second account none of the first account's rows", async () => {
		const t = setup();
		await hostSession(t, "live-quiz", "solo");
		const draftId = await createDraft(t, HOST_USER, "Host draft");
		await createQuizSet(t, HOST_USER);

		const other = t.withIdentity({ subject: OTHER_USER });
		expect(await other.query(api.accountPortal.summary, {})).toBeNull();
		expect((await drain(t, OTHER_USER)).tables).toEqual({});

		await createDraft(t, OTHER_USER, "Other draft");
		const { tables } = await drain(t, OTHER_USER);
		expect(Object.keys(tables)).toEqual(["contentDrafts"]);
		expect(tables.contentDrafts).toEqual([
			expect.objectContaining({ title: "Other draft" }),
		]);
		expect(JSON.stringify(tables)).not.toContain(draftId);
		expect(await other.query(api.accountPortal.summary, {})).toEqual({
			contract: 1,
			lastActiveAt: null,
			counts: [
				{ key: "gameSeats", count: 0, more: false },
				{ key: "drafts", count: 1, more: false },
				{ key: "quizSets", count: 0, more: false },
			],
		});
	});

	it("refuses a cursor it did not hand out", async () => {
		const t = setup();
		await createDraft(t, HOST_USER);
		const user = t.withIdentity({ subject: HOST_USER });
		for (const cursor of [
			"not json",
			"null",
			"[]",
			'{"source":-1,"page":null}',
			'{"source":99,"page":null}',
			'{"source":0.5,"page":null}',
			'{"source":0,"page":7}',
			'{"source":0,"page":null,"userId":"user_other"}',
		]) {
			await expectCode(
				user.query(api.accountPortal.exportPage, { cursor }),
				"accountExportCursorInvalid",
			);
		}
	});

	it("has a portal key for every table the export reads by owner", async () => {
		const tables = await setup().run(async (ctx) =>
			ownerRows(ctx.db, HOST_USER).map(([table]) => table),
		);
		for (const table of tables) {
			expect(COUNT_KEYS[table], table).toBeDefined();
		}
	});
});
