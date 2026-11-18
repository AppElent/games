import { collectAccountExport } from "@arcadeclub/core/account-export";
import { describe, expect, expectTypeOf, it } from "vitest";
import { api } from "./_generated/api";
import type { TableNames } from "./_generated/dataModel";
import { EXPORT } from "./lib/accountExport";
import schema from "./schema";
import {
	expectCode,
	freezeClock,
	HOST_USER,
	hostSession,
	type ParticipantId,
	type SessionId,
	setup,
	type T,
} from "./test.helpers";

freezeClock();

const OTHER_USER = "user_other";
const SOLVED =
	"534678912672195348198342567859761423426853791713924856961537284287419635345286179";
const GIVENS = "0".repeat(9) + SOLVED.slice(9);
const SEAT_SECRET = "seat-secret-0123456789abcdef";

/** Every page a client asks for, merged as `@arcadeclub/core` merges them. */
function exportAll(t: T, subject = HOST_USER) {
	const user = t.withIdentity({ subject });
	return collectAccountExport((cursor) =>
		user.query(api.account.exportMyData, { cursor }),
	);
}

function createDraft(t: T, subject: string, title = "Draft") {
	return t.withIdentity({ subject }).mutation(api.workbench.createDraft, {
		kind: "quiz-set",
		title,
		payload: "{}",
	});
}

function createQuizSet(t: T, subject: string, title = "Mine") {
	return t.withIdentity({ subject }).mutation(api.quiz.createSet, {
		title,
		questions: [],
	});
}

function answer(
	t: T,
	sessionId: SessionId,
	participantId: ParticipantId,
	questionId: string,
) {
	return t.run((ctx) =>
		ctx.db.insert("liveQuizAnswers", {
			sessionId,
			participantId,
			questionId,
			selectedChoiceIds: ["a"],
			correct: true,
			score: 900,
			answeredAt: Date.now(),
		}),
	);
}

/** A quiz room hosted by `HOST_USER` that a signed-in "Rival" joined. */
async function sharedRoom(t: T) {
	const room = await hostSession(t, "live-quiz", "room");
	const rival = await t
		.withIdentity({ subject: OTHER_USER })
		.mutation(api.sessions.joinByCode, {
			joinCode: room.joinCode as string,
			displayName: "Rival Name",
		});
	await t.run(async (ctx) => {
		await ctx.db.insert("liveQuizStates", {
			sessionId: room.sessionId,
			phase: "finished",
			currentQuestionIndex: 0,
			showCorrectAnswer: true,
		});
		await ctx.db.patch(room.sessionId, {
			winnerParticipantIds: [rival.participantId],
		});
	});
	await answer(t, room.sessionId, room.hostId, "host-q");
	await answer(t, room.sessionId, rival.participantId, "rival-q");
	return { ...room, rivalId: rival.participantId };
}

describe("account.exportMyData", () => {
	it("refuses signed-out callers", async () => {
		const t = setup();
		await createDraft(t, HOST_USER);
		await expectCode(
			t.query(api.account.exportMyData, { cursor: null }),
			"signInRequired",
		);
	});

	it("exports the account's own content without its auth subject", async () => {
		const t = setup();
		await t.mutation(api.quiz.ensureSampleSet, {});
		const draft = await createDraft(t, HOST_USER, "My draft");
		const set = await createQuizSet(t, HOST_USER, "My set");

		const tables = await exportAll(t);

		expect(tables.contentDrafts).toEqual([
			expect.objectContaining({ _id: draft, title: "My draft" }),
		]);
		expect(tables.quizSets).toEqual([
			expect.objectContaining({ _id: set, title: "My set" }),
		]);
		expect(JSON.stringify(tables)).not.toContain(HOST_USER);
	});

	it("exports the account's seat, session and answers in a shared game, and nothing of the other player", async () => {
		const t = setup();
		const room = await sharedRoom(t);

		const tables = await exportAll(t);

		expect(tables.sessionParticipants).toEqual([
			expect.objectContaining({
				_id: room.hostId,
				displayName: "Host",
				role: "host",
			}),
		]);
		expect(tables.gameSessions).toEqual([
			expect.objectContaining({
				_id: room.sessionId,
				gameType: "live-quiz",
				title: "Game",
				hosted: true,
				won: false,
			}),
		]);
		expect(tables.liveQuizAnswers).toEqual([
			expect.objectContaining({
				participantId: room.hostId,
				questionId: "host-q",
			}),
		]);
		expect(tables.liveQuizStates).toHaveLength(1);
		const text = JSON.stringify(tables);
		for (const secret of [
			"Rival Name",
			room.rivalId,
			OTHER_USER,
			"rival-q",
			room.joinCode as string,
			"guest_host",
			HOST_USER,
		]) {
			expect(text).not.toContain(secret);
		}
	});

	it("never includes another account's data", async () => {
		const t = setup();
		await createDraft(t, OTHER_USER, "Their draft");
		await createQuizSet(t, OTHER_USER, "Their set");
		const room = await sharedRoom(t);

		// The joiner sees the room from their side: their seat and answer, and
		// neither the host's name, title, answer nor content.
		const tables = await exportAll(t, OTHER_USER);

		expect(tables.contentDrafts).toEqual([
			expect.objectContaining({ title: "Their draft" }),
		]);
		expect(tables.quizSets).toEqual([
			expect.objectContaining({ title: "Their set" }),
		]);
		expect(tables.sessionParticipants).toEqual([
			expect.objectContaining({ _id: room.rivalId, displayName: "Rival Name" }),
		]);
		expect(tables.gameSessions).toEqual([
			expect.objectContaining({ hosted: false, won: true }),
		]);
		expect(tables.gameSessions?.[0]).not.toHaveProperty("title");
		expect(tables.liveQuizAnswers).toEqual([
			expect.objectContaining({ questionId: "rival-q" }),
		]);
		const text = JSON.stringify(tables);
		for (const secret of ["Host", room.hostId, HOST_USER, "host-q", "Game"]) {
			expect(text).not.toContain(secret);
		}
	});

	it("leaves game secrets out of the account's own games", async () => {
		const t = setup();
		const { sessionId } = await t
			.withIdentity({ subject: HOST_USER })
			.mutation(api.sudoku.create, {
				title: "Puzzle",
				displayName: "Solver",
				guestId: "guest_solver",
				source: "generated",
				difficulty: "easy",
				givens: GIVENS,
				solution: SOLVED,
			});
		const table = await hostSession(t, "card-games", "solo");
		await t.run((ctx) =>
			ctx.db.insert("cardGameStates", {
				sessionId: table.sessionId,
				gameId: "pesten",
				options: [],
				seats: [
					{
						participantId: table.hostId,
						secret: SEAT_SECRET,
						autopilot: false,
					},
					{ botIndex: 0, autopilot: true },
				],
				status: "playing",
				game: { hands: [["secret-hand"]] },
				version: 1,
				createdAt: Date.now(),
				updatedAt: Date.now(),
			}),
		);

		const tables = await exportAll(t);

		expect(tables.sudokuStates).toEqual([
			expect.objectContaining({ sessionId, givens: GIVENS }),
		]);
		expect(tables.cardGameStates).toEqual([
			expect.objectContaining({ gameId: "pesten", seat: 0 }),
		]);
		const text = JSON.stringify(tables);
		expect(text).not.toContain(SOLVED);
		expect(text).not.toContain(SEAT_SECRET);
		expect(text).not.toContain("secret-hand");
	});

	it("pages through every seat and owned row, each exported once", async () => {
		const t = setup();
		const sessions = [];
		for (let index = 0; index < 45; index += 1) {
			sessions.push((await hostSession(t, "live-quiz", "solo")).sessionId);
		}
		for (let index = 0; index < 55; index += 1) {
			await createDraft(t, HOST_USER, `Draft ${index}`);
		}
		const user = t.withIdentity({ subject: HOST_USER });
		let pages = 0;
		const tables = await collectAccountExport(async (cursor) => {
			pages += 1;
			return await user.query(api.account.exportMyData, { cursor });
		});

		expect(pages).toBeGreaterThan(3);
		expect(tables.contentDrafts).toHaveLength(55);
		expect(tables.sessionParticipants).toHaveLength(45);
		expect(
			(tables.gameSessions as { _id: string }[]).map((row) => row._id).sort(),
		).toEqual([...sessions].sort());
	});

	it("exports a session the account holds several seats in once", async () => {
		const t = setup();
		const room = await hostSession(t, "live-quiz", "room");
		const second = await t.run((ctx) =>
			ctx.db.insert("sessionParticipants", {
				sessionId: room.sessionId,
				userId: HOST_USER,
				displayName: "Second seat",
				role: "player",
				connected: true,
				lastSeen: Date.now(),
			}),
		);
		await answer(t, room.sessionId, second, "second-q");

		const tables = await exportAll(t);

		expect(tables.gameSessions).toHaveLength(1);
		expect(tables.liveQuizAnswers).toEqual([
			expect.objectContaining({ participantId: second }),
		]);
	});
});

describe("export registry", () => {
	it("states a treatment for every table in the schema", () => {
		expect(Object.keys(EXPORT).sort()).toEqual(
			Object.keys(schema.tables).sort(),
		);
		expectTypeOf<keyof typeof EXPORT>().toEqualTypeOf<TableNames>();
		const { bluffDiceStates: _left, ...withoutOne } = EXPORT;
		// @ts-expect-error A table without a treatment does not compile.
		const incomplete: typeof EXPORT = withoutOne;
		expect(incomplete).toBeDefined();
	});
});
