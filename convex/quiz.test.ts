import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import {
	advance,
	arrange,
	createdRows,
	deletedSessionId,
	expectCode,
	fields,
	HOSTED,
	hostSession,
	joinWithCode,
	otherGameSession,
	outsider,
	type ParticipantId,
	sessionCount,
	type SessionId,
	setup,
	signedInHost,
	type T,
	T0,
	useFixedClock,
} from "./test.helpers";

useFixedClock();

const QUESTIONS = [
	{
		id: "q1",
		prompt: "One?",
		choices: [
			{ id: "a", label: "A" },
			{ id: "b", label: "B" },
		],
		correctChoiceIds: ["a"],
		durationSeconds: 20,
		points: 1000,
	},
	{
		id: "q2",
		prompt: "Two?",
		choices: [
			{ id: "a", label: "A" },
			{ id: "b", label: "B" },
		],
		correctChoiceIds: ["a", "b"],
		durationSeconds: 10,
		points: 500,
	},
];

function owner(t: T, subject = "user_owner") {
	return t.withIdentity({ subject });
}

function createSet(t: T, subject?: string) {
	return owner(t, subject).mutation(api.quiz.createSet, {
		title: "Set",
		description: "About",
		questions: QUESTIONS,
	});
}

/** The client flow: room session, then `startForSession`. */
async function newQuiz(t: T) {
	const quizSetId = await createSet(t);
	const { host, sessionId, hostId, joinCode } = await hostSession(
		t,
		"live-quiz",
		"room",
		"hostChoice",
	);
	const stateId = await host.mutation(api.quiz.startForSession, {
		sessionId,
		quizSetId,
	});
	return {
		host,
		sessionId,
		hostId,
		joinCode: joinCode as string,
		quizSetId,
		stateId,
	};
}

async function quizWithPlayer(t: T) {
	const quiz = await newQuiz(t);
	const joined = await joinWithCode(t, quiz.joinCode, "guest_player");
	return { ...quiz, player: joined.participantId };
}

function advancePhase(t: T, sessionId: SessionId) {
	return t.mutation(api.quiz.advancePhase, { sessionId });
}

function answer(
	t: T,
	sessionId: SessionId,
	participantId: ParticipantId,
	selectedChoiceIds: string[],
) {
	return t.mutation(api.quiz.submitAnswer, {
		sessionId,
		participantId,
		selectedChoiceIds,
	});
}

async function bundle(t: T, sessionId: SessionId) {
	const result = await t.query(api.quiz.getBundle, { sessionId });
	if (!result) {
		throw new Error("Expected a quiz bundle");
	}
	return result;
}

describe("quiz sets", () => {
	it("creates the sample set once and lists it publicly", async () => {
		const t = setup();
		const first = await t.mutation(api.quiz.ensureSampleSet, {});
		await expect(t.mutation(api.quiz.ensureSampleSet, {})).resolves.toBe(first);
		const samples = await t.query(api.quiz.listSampleSets, {});
		expect(samples.map((set) => set._id)).toEqual([first]);
		expect(samples[0].title).toBe("Starter Quiz");
		expect(samples[0].isSample).toBe(true);
		expect(samples[0].ownerUserId).toBeUndefined();
		expect(samples[0].questions.map((question) => question.id)).toEqual([
			"q1",
			"q2",
			"q3",
		]);
		await expect(
			t.query(api.quiz.getSet, { quizSetId: first }),
		).resolves.toMatchObject({ _id: first });
	});

	it("stores an owned set privately", async () => {
		const t = setup();
		const quizSetId = await createSet(t);
		expect(
			fields(
				await owner(t).query(api.quiz.getSet, { quizSetId }),
			),
		).toEqual({
			ownerUserId: "user_owner",
			title: "Set",
			description: "About",
			questions: QUESTIONS,
			isSample: false,
		});
		await expect(t.query(api.quiz.getSet, { quizSetId })).resolves.toBeNull();
		await expect(
			owner(t, "user_other").query(api.quiz.getSet, { quizSetId }),
		).resolves.toBeNull();
		expect(
			(await owner(t).query(api.quiz.listMine, {})).map((set) => set._id),
		).toEqual([quizSetId]);
		await expect(
			owner(t, "user_other").query(api.quiz.listMine, {}),
		).resolves.toEqual([]);
	});

	it("is null for a deleted set", async () => {
		const t = setup();
		const quizSetId = await createSet(t);
		await owner(t).mutation(api.quiz.deleteSet, { quizSetId });
		await expect(
			owner(t).query(api.quiz.getSet, { quizSetId }),
		).resolves.toBeNull();
	});

	it("updates a set for its owner", async () => {
		const t = setup();
		const quizSetId = await createSet(t);
		await owner(t).mutation(api.quiz.updateSet, {
			quizSetId,
			title: "Renamed",
			questions: QUESTIONS.slice(0, 1),
		});
		const stored = await owner(t).query(api.quiz.getSet, { quizSetId });
		expect(stored?.title).toBe("Renamed");
		expect(stored?.description).toBeUndefined();
		expect(stored?.questions).toHaveLength(1);
	});

	it("answers signInRequired to a guest", async () => {
		const t = setup();
		const quizSetId = await createSet(t);
		await expectCode(
			t.mutation(api.quiz.createSet, { title: "x", questions: [] }),
			"signInRequired",
		);
		await expectCode(
			t.mutation(api.quiz.updateSet, { quizSetId, title: "x", questions: [] }),
			"signInRequired",
		);
		await expectCode(
			t.mutation(api.quiz.deleteSet, { quizSetId }),
			"signInRequired",
		);
		await expectCode(t.query(api.quiz.listMine, {}), "signInRequired");
	});

	it("answers quizSetNotFound to anyone but the owner, even for a sample", async () => {
		const t = setup();
		const quizSetId = await createSet(t);
		const sample = await t.mutation(api.quiz.ensureSampleSet, {});
		const other = owner(t, "user_other");
		for (const id of [quizSetId, sample]) {
			await expectCode(
				other.mutation(api.quiz.updateSet, {
					quizSetId: id,
					title: "x",
					questions: [],
				}),
				"quizSetNotFound",
			);
			await expectCode(
				other.mutation(api.quiz.deleteSet, { quizSetId: id }),
				"quizSetNotFound",
			);
		}
	});
});

describe("startForSession", () => {
	it("prepares a lobby state and leaves the session in the lobby", async () => {
		const t = setup();
		const { sessionId, quizSetId, stateId } = await newQuiz(t);
		const { quizState, quizSet, session, answers } = await bundle(t, sessionId);
		expect(quizState?._id).toBe(stateId);
		expect(fields(quizState)).toEqual({
			sessionId,
			quizSetId,
			phase: "lobby",
			currentQuestionIndex: 0,
			showCorrectAnswer: false,
		});
		expect(quizSet?._id).toBe(quizSetId);
		expect(session.status).toBe("lobby");
		expect(session.authPolicy).toBe("hostChoice");
		expect(answers).toEqual([]);
	});

	it("pins that anyone can reset a running quiz back to the lobby", async () => {
		const t = setup();
		const { sessionId, stateId } = await newQuiz(t);
		await advancePhase(t, sessionId);
		const sample = await t.mutation(api.quiz.ensureSampleSet, {});
		await expect(
			t.mutation(api.quiz.startForSession, { sessionId, quizSetId: sample }),
		).resolves.toBe(stateId);
		const { quizState, session } = await bundle(t, sessionId);
		expect(fields(quizState)).toEqual({
			sessionId,
			quizSetId: sample,
			phase: "lobby",
			currentQuestionIndex: 0,
			showCorrectAnswer: false,
		});
		expect(session.status).toBe("active");
	});

	it("answers sessionNotFound and quizSetNotFound", async () => {
		const t = setup();
		const quizSetId = await createSet(t);
		for (const sessionId of [
			await otherGameSession(t),
			await deletedSessionId(t),
		]) {
			await expectCode(
				t.mutation(api.quiz.startForSession, { sessionId, quizSetId }),
				"sessionNotFound",
			);
		}
		const { sessionId } = await hostSession(t, "live-quiz", "room");
		const gone = await createSet(t);
		await owner(t).mutation(api.quiz.deleteSet, { quizSetId: gone });
		await expectCode(
			t.mutation(api.quiz.startForSession, { sessionId, quizSetId: gone }),
			"quizSetNotFound",
		);
	});
});

describe("joining", () => {
	it("adds a code joiner as a player and a spectator as a watcher", async () => {
		const t = setup();
		const { sessionId, joinCode } = await newQuiz(t);
		const player = await joinWithCode(t, joinCode, "guest_two");
		expect(player).toEqual({
			sessionId,
			participantId: player.participantId,
			gameType: "live-quiz",
			seatClaimed: false,
		});
		await joinWithCode(t, joinCode, "guest_watch", { asSpectator: true });
		const { participants } = await bundle(t, sessionId);
		expect(participants.map((row) => row.role)).toEqual([
			"host",
			"player",
			"watcher",
		]);
	});
});

describe("advancePhase", () => {
	it("walks every phase, question by question, to the finish", async () => {
		const t = setup();
		const { sessionId } = await newQuiz(t);
		advance(1000);
		await expect(advancePhase(t, sessionId)).resolves.toBe("question");
		let { quizState, session } = await bundle(t, sessionId);
		expect(quizState?.questionStartedAt).toBe(T0 + 1000);
		expect(quizState?.showCorrectAnswer).toBe(false);
		expect(session.status).toBe("active");
		expect(session.startedAt).toBe(T0 + 1000);

		await expect(advancePhase(t, sessionId)).resolves.toBe("reveal");
		({ quizState } = await bundle(t, sessionId));
		expect(quizState?.phase).toBe("reveal");
		expect(quizState?.showCorrectAnswer).toBe(true);

		await expect(advancePhase(t, sessionId)).resolves.toBe("scoreboard");
		({ quizState } = await bundle(t, sessionId));
		expect(quizState?.phase).toBe("scoreboard");

		advance(1000);
		await expect(advancePhase(t, sessionId)).resolves.toBe("question");
		({ quizState } = await bundle(t, sessionId));
		expect(quizState?.phase).toBe("question");
		expect(quizState?.currentQuestionIndex).toBe(1);
		expect(quizState?.questionStartedAt).toBe(T0 + 2000);
		expect(quizState?.showCorrectAnswer).toBe(false);

		await advancePhase(t, sessionId);
		await advancePhase(t, sessionId);
		advance(1000);
		await expect(advancePhase(t, sessionId)).resolves.toBe("finished");
		({ quizState, session } = await bundle(t, sessionId));
		expect(quizState?.phase).toBe("finished");
		expect(quizState?.questionStartedAt).toBeUndefined();
		expect(quizState?.showCorrectAnswer).toBe(true);
		expect(session.status).toBe("completed");
		expect(session.completedReason).toBe("finished");
		expect(session.endedAt).toBe(T0 + 3000);
		expect(session.startedAt).toBe(T0 + 1000);
		expect(session.participantCount).toBe(1);
		expect(session.winnerParticipantIds).toEqual([]);

		await expect(advancePhase(t, sessionId)).resolves.toBe("finished");
	});

	it("pins that anyone can advance, with no identity or participant", async () => {
		const t = setup();
		const { sessionId } = await newQuiz(t);
		await expect(
			owner(t, "user_stranger").mutation(api.quiz.advancePhase, { sessionId }),
		).resolves.toBe("question");
	});

	it("names every top scorer a winner", async () => {
		const t = setup();
		const { sessionId, joinCode, player, stateId } = await quizWithPlayer(t);
		const tied = await joinWithCode(t, joinCode, "guest_tied");
		const loser = await joinWithCode(t, joinCode, "guest_loser");
		await advancePhase(t, sessionId);
		await answer(t, sessionId, player, ["a"]);
		await answer(t, sessionId, tied.participantId, ["a"]);
		await answer(t, sessionId, loser.participantId, ["b"]);
		await arrange(t, stateId, {
			phase: "scoreboard",
			currentQuestionIndex: 1,
		});
		await expect(advancePhase(t, sessionId)).resolves.toBe("finished");
		const { session } = await bundle(t, sessionId);
		expect(session.winnerParticipantIds).toEqual([
			player,
			tied.participantId,
		]);
		expect(session.participantCount).toBe(4);
	});

	it("answers quizNotPrepared without a state", async () => {
		const t = setup();
		const { sessionId } = await hostSession(t, "live-quiz", "room");
		await expectCode(advancePhase(t, sessionId), "quizNotPrepared");
	});

	it("answers quizSetNotFound once the set is gone", async () => {
		const t = setup();
		const { sessionId, quizSetId } = await newQuiz(t);
		await owner(t).mutation(api.quiz.deleteSet, { quizSetId });
		await expectCode(advancePhase(t, sessionId), "quizSetNotFound");
	});
});

describe("submitAnswer", () => {
	it("stores an answer with the speed bonus", async () => {
		const t = setup();
		const { sessionId, player } = await quizWithPlayer(t);
		await advancePhase(t, sessionId);
		advance(5000);
		const result = await answer(t, sessionId, player, ["a"]);
		expect(result).toEqual({
			answerId: result.answerId,
			correct: true,
			score: 1250,
		});
		const { answers } = await bundle(t, sessionId);
		expect(answers.map(fields)).toEqual([
			{
				sessionId,
				participantId: player,
				questionId: "q1",
				selectedChoiceIds: ["a"],
				correct: true,
				score: 1250,
				answeredAt: T0 + 5000,
			},
		]);
	});

	it("shrinks the bonus with time, down to the base points", async () => {
		const t = setup();
		const { sessionId, player, joinCode } = await quizWithPlayer(t);
		await advancePhase(t, sessionId);
		advance(10_000);
		await expect(answer(t, sessionId, player, ["a"])).resolves.toMatchObject({
			score: 1167,
		});
		const late = await joinWithCode(t, joinCode, "guest_late");
		advance(60_000);
		await expect(
			answer(t, sessionId, late.participantId, ["a"]),
		).resolves.toMatchObject({ score: 1000 });
	});

	it("pins that an answer in the same millisecond misses the bonus", async () => {
		const t = setup();
		const { sessionId, player } = await quizWithPlayer(t);
		await advancePhase(t, sessionId);
		await expect(answer(t, sessionId, player, ["a"])).resolves.toMatchObject({
			score: 1000,
		});
	});

	it("scores a wrong answer zero and needs every correct choice", async () => {
		const t = setup();
		const { sessionId, player, stateId } = await quizWithPlayer(t);
		await advancePhase(t, sessionId);
		await expect(answer(t, sessionId, player, ["b"])).resolves.toMatchObject({
			correct: false,
			score: 0,
		});
		await arrange(t, stateId, { currentQuestionIndex: 1 });
		await expect(answer(t, sessionId, player, ["a"])).resolves.toMatchObject({
			correct: false,
			score: 0,
		});
	});

	it("keeps the first answer to a question", async () => {
		const t = setup();
		const { sessionId, player } = await quizWithPlayer(t);
		await advancePhase(t, sessionId);
		const first = await answer(t, sessionId, player, ["b"]);
		await expect(answer(t, sessionId, player, ["a"])).resolves.toEqual(first);
		const { answers } = await bundle(t, sessionId);
		expect(answers).toHaveLength(1);
		expect(answers[0].selectedChoiceIds).toEqual(["b"]);
	});

	it("lets the host answer too", async () => {
		const t = setup();
		const { sessionId, hostId } = await newQuiz(t);
		await advancePhase(t, sessionId);
		advance(1);
		await expect(answer(t, sessionId, hostId, ["a"])).resolves.toMatchObject({
			correct: true,
		});
	});

	it("answers participantNotFound to an outsider and a kicked player", async () => {
		const t = setup();
		const { host, sessionId, hostId, player } = await quizWithPlayer(t);
		await advancePhase(t, sessionId);
		await expectCode(
			answer(t, sessionId, await outsider(t), ["a"]),
			"participantNotFound",
		);
		await host.mutation(api.sessions.kickParticipant, {
			sessionId,
			hostParticipantId: hostId,
			targetParticipantId: player,
		});
		await expectCode(
			answer(t, sessionId, player, ["a"]),
			"participantNotFound",
		);
	});

	it("answers spectatorsCannotAnswer to a watcher", async () => {
		const t = setup();
		const { sessionId, joinCode } = await newQuiz(t);
		const watcher = await joinWithCode(t, joinCode, "guest_watch", {
			asSpectator: true,
		});
		await advancePhase(t, sessionId);
		await expectCode(
			answer(t, sessionId, watcher.participantId, ["a"]),
			"spectatorsCannotAnswer",
		);
	});

	it("answers questionClosed outside the question phase and without a state", async () => {
		const t = setup();
		const { sessionId, player } = await quizWithPlayer(t);
		await expectCode(answer(t, sessionId, player, ["a"]), "questionClosed");
		await advancePhase(t, sessionId);
		await advancePhase(t, sessionId);
		await expectCode(answer(t, sessionId, player, ["a"]), "questionClosed");
		const bare = await hostSession(t, "live-quiz", "room");
		await expectCode(
			answer(t, bare.sessionId, bare.hostId, ["a"]),
			"questionClosed",
		);
	});

	it("answers questionNotFound for an index past the end", async () => {
		const t = setup();
		const { sessionId, player, stateId } = await quizWithPlayer(t);
		await advancePhase(t, sessionId);
		await arrange(t, stateId, { currentQuestionIndex: 9 });
		await expectCode(answer(t, sessionId, player, ["a"]), "questionNotFound");
	});
});

describe("getBundle", () => {
	it("returns the five fields clients read, nulls ahead of the state", async () => {
		const t = setup();
		const { sessionId } = await hostSession(t, "live-quiz", "room");
		const result = (await t.query(api.quiz.getBundle, {
			sessionId,
		})) as NonNullable<Awaited<ReturnType<typeof bundle>>>;
		expect(Object.keys(result).sort()).toEqual([
			"answers",
			"participants",
			"quizSet",
			"quizState",
			"session",
		]);
		expect(result.quizState).toBeNull();
		expect(result.quizSet).toBeNull();
		expect(result.answers).toEqual([]);
		expect(result.participants).toHaveLength(1);
	});

	it("is null for a missing session", async () => {
		const t = setup();
		await expect(
			t.query(api.quiz.getBundle, { sessionId: await deletedSessionId(t) }),
		).resolves.toBeNull();
	});

	it("pins that correct answers and everyone's picks ship during the question", async () => {
		const t = setup();
		const { sessionId, player } = await quizWithPlayer(t);
		await advancePhase(t, sessionId);
		await answer(t, sessionId, player, ["a"]);
		const { quizSet, answers, quizState } = await bundle(t, sessionId);
		expect(quizState?.phase).toBe("question");
		expect((quizSet as Doc<"quizSets">).questions[0].correctChoiceIds).toEqual([
			"a",
		]);
		expect(answers[0].selectedChoiceIds).toEqual(["a"]);
	});
});

describe("create", () => {
	it("stores what sessions.create and createState store together", async () => {
		const t = setup();
		const twoStep = await newQuiz(t);
		const { quizSetId } = twoStep;
		const created = await signedInHost(t).mutation(api.quiz.create, { ...HOSTED, quizSetId });
		expect(await createdRows(t, created.sessionId, "liveQuizStates")).toEqual(
			await createdRows(t, twoStep.sessionId, "liveQuizStates"),
		);
	});

	it("returns a code a guest can type, and no link", async () => {
		const t = setup();
		const quizSetId = await createSet(t);
		const created = await signedInHost(t).mutation(api.quiz.create, { ...HOSTED, quizSetId });
		expect(created.shareToken).toBeUndefined();
		const joined = await joinWithCode(
			t,
			created.joinCode as string,
			"guest_two",
		);
		expect(joined.sessionId).toBe(created.sessionId);
	});

	it("needs an account to host, and leaves nothing behind without one", async () => {
		const t = setup();
		const quizSetId = await createSet(t);
		await expectCode(t.mutation(api.quiz.create, { ...HOSTED, quizSetId }), "signInToHost");
		expect(await sessionCount(t)).toBe(0);
	});

	it("leaves no session behind when the quiz set is gone", async () => {
		const t = setup();
		const quizSetId = await createSet(t);
		await t.run((ctx) => ctx.db.delete(quizSetId));
		await expectCode(
			signedInHost(t).mutation(api.quiz.create, { ...HOSTED, quizSetId }),
			"quizSetNotFound",
		);
		expect(await sessionCount(t)).toBe(0);
	});
});
