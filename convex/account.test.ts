import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { DELETED_PLAYER_NAME, deleteAccountData } from "./lib/accountDeletion";
import {
	advance,
	expectCode,
	freezeClock,
	getDoc,
	HOST_USER,
	hostSession,
	joinWithCode,
	type SessionId,
	setup,
	type T,
} from "./test.helpers";

freezeClock();

const OTHER_USER = "user_other";

/** Every call `deleteMyData` asks of a client, until it reports `done`. */
async function deleteAll(t: T, subject = HOST_USER) {
	const user = t.withIdentity({ subject });
	let calls = 0;
	let done = false;
	while (!done) {
		({ done } = await user.mutation(api.account.deleteMyData, {
			expectedSubject: subject,
		}));
		calls += 1;
	}
	return calls;
}

async function addQuizState(t: T, sessionId: SessionId) {
	await t.run((ctx) =>
		ctx.db.insert("liveQuizStates", {
			sessionId,
			phase: "finished",
			currentQuestionIndex: 0,
			showCorrectAnswer: true,
		}),
	);
}

async function answer(
	t: T,
	sessionId: SessionId,
	participantId: Id<"sessionParticipants">,
) {
	return await t.run((ctx) =>
		ctx.db.insert("liveQuizAnswers", {
			sessionId,
			participantId,
			questionId: "q1",
			selectedChoiceIds: ["a"],
			correct: true,
			score: 900,
			answeredAt: Date.now(),
		}),
	);
}

function createDraft(t: T, subject: string) {
	return t.withIdentity({ subject }).mutation(api.workbench.createDraft, {
		kind: "quiz-set",
		title: "Draft",
		payload: "{}",
	});
}

function createQuizSet(t: T, subject: string) {
	return t.withIdentity({ subject }).mutation(api.quiz.createSet, {
		title: "Mine",
		questions: [],
	});
}

/** A room the host played with a guest, then left alone for an hour. */
async function finishedRoomWithGuest(t: T) {
	const room = await hostSession(t, "live-quiz", "room");
	const joined = await joinWithCode(t, room.joinCode as string, "guest_a");
	await addQuizState(t, room.sessionId);
	const hostAnswer = await answer(t, room.sessionId, room.hostId);
	await answer(t, room.sessionId, joined.participantId);
	advance(60 * 60_000);
	return { ...room, guestId: joined.participantId, hostAnswer };
}

describe("account.deleteMyData", () => {
	it("refuses signed-out callers and a different signed-in account", async () => {
		const t = setup();
		await createDraft(t, HOST_USER);
		await expectCode(
			t.mutation(api.account.deleteMyData, { expectedSubject: HOST_USER }),
			"signInRequired",
		);
		await expectCode(
			t
				.withIdentity({ subject: OTHER_USER })
				.mutation(api.account.deleteMyData, { expectedSubject: HOST_USER }),
			"accountChanged",
		);
		const drafts = await t.run((ctx) =>
			ctx.db.query("contentDrafts").collect(),
		);
		expect(drafts).toHaveLength(1);
	});

	it("deletes the account's own content and solo sessions, and nobody else's", async () => {
		const t = setup();
		const sampleId = await t.mutation(api.quiz.ensureSampleSet, {});
		await createDraft(t, HOST_USER);
		await createQuizSet(t, HOST_USER);
		const otherDraft = await createDraft(t, OTHER_USER);
		const otherSet = await createQuizSet(t, OTHER_USER);
		const solo = await hostSession(t, "live-quiz", "solo");
		await addQuizState(t, solo.sessionId);
		await answer(t, solo.sessionId, solo.hostId);

		await deleteAll(t);

		const left = await t.run(async (ctx) => ({
			drafts: await ctx.db.query("contentDrafts").collect(),
			sets: await ctx.db.query("quizSets").collect(),
			sessions: await ctx.db.query("gameSessions").collect(),
			participants: await ctx.db.query("sessionParticipants").collect(),
			states: await ctx.db.query("liveQuizStates").collect(),
			answers: await ctx.db.query("liveQuizAnswers").collect(),
		}));
		expect(left.drafts.map((row) => row._id)).toEqual([otherDraft]);
		expect(left.sets.map((row) => row._id).sort()).toEqual(
			[sampleId, otherSet].sort(),
		);
		expect(left.sessions).toEqual([]);
		expect(left.participants).toEqual([]);
		expect(left.states).toEqual([]);
		expect(left.answers).toEqual([]);
	});

	it("anonymises the account's seat in a game others played and keeps their history", async () => {
		const t = setup();
		const room = await finishedRoomWithGuest(t);
		const guestBefore = await getDoc(t, room.guestId);

		await deleteAll(t);

		const host = await getDoc(t, room.hostId);
		expect(host).toMatchObject({
			displayName: DELETED_PLAYER_NAME,
			connected: false,
			role: "host",
		});
		expect(host?.userId).toBeUndefined();
		const session = await getDoc(t, room.sessionId);
		expect(session?.hostUserId).toBeUndefined();
		expect(session?.hostParticipantId).toBe(room.hostId);
		expect(await getDoc(t, room.guestId)).toEqual(guestBefore);
		expect(await getDoc(t, room.hostAnswer)).not.toBeNull();
		const bundle = await t.query(api.quiz.getBundle, {
			sessionId: room.sessionId,
		});
		expect(bundle?.participants).toHaveLength(2);
	});

	it("anonymises a joined seat and leaves the host's session alone", async () => {
		const t = setup();
		const room = await hostSession(t, "live-quiz", "room");
		const joined = await t
			.withIdentity({ subject: OTHER_USER })
			.mutation(api.sessions.joinByCode, {
				joinCode: room.joinCode as string,
				displayName: "Joiner",
			});
		advance(60 * 60_000);

		await deleteAll(t, OTHER_USER);

		expect(await getDoc(t, joined.participantId)).toMatchObject({
			displayName: DELETED_PLAYER_NAME,
		});
		expect((await getDoc(t, room.sessionId))?.hostUserId).toBe(HOST_USER);
		expect(await getDoc(t, room.hostId)).toMatchObject({
			userId: HOST_USER,
			displayName: "Host",
		});
	});

	it("waits while other players are in an open game, then goes ahead", async () => {
		const t = setup();
		const room = await hostSession(t, "live-quiz", "room");
		await joinWithCode(t, room.joinCode as string, "guest_a");
		await createDraft(t, HOST_USER);

		await expectCode(
			room.host.mutation(api.account.deleteMyData, {
				expectedSubject: HOST_USER,
			}),
			"accountInActiveGame",
			{ minutes: 30 },
		);
		expect(
			await t.run((ctx) => ctx.db.query("contentDrafts").collect()),
		).toHaveLength(1);

		advance(31 * 60_000);
		await deleteAll(t);
		expect((await getDoc(t, room.hostId))?.userId).toBeUndefined();
	});

	it("deletes in bounded batches that resume where they stopped", async () => {
		const t = setup();
		for (let index = 0; index < 3; index += 1) {
			await createDraft(t, HOST_USER);
			const solo = await hostSession(t, "live-quiz", "solo");
			await addQuizState(t, solo.sessionId);
			await answer(t, solo.sessionId, solo.hostId);
		}
		const results: boolean[] = [];
		let done = false;
		while (!done) {
			done = await t.run((ctx) => deleteAccountData(ctx, HOST_USER, 2));
			results.push(done);
		}
		expect(results.length).toBeGreaterThan(2);
		expect(
			await t.run((ctx) => ctx.db.query("gameSessions").collect()),
		).toEqual([]);
		expect(
			await t.run((ctx) => ctx.db.query("contentDrafts").collect()),
		).toEqual([]);
	});
});
