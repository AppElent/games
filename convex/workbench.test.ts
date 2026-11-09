import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
	advance,
	arrange,
	expectCode,
	fields,
	getDoc,
	setup,
	T0,
	type T,
	useFixedClock,
} from "./test.helpers";

useFixedClock();

const OWNER = "user_owner";

const SIGNAL_PACK = JSON.stringify({
	words: Array.from({ length: 25 }, (_, index) => `word${index}`),
});
const QUIZ_QUESTIONS = [
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
];
const QUIZ_SET = JSON.stringify({
	title: "From a draft",
	description: "About",
	questions: QUIZ_QUESTIONS,
});

function owner(t: T, subject = OWNER) {
	return t.withIdentity({ subject });
}

function newSignalDraft(t: T, payload = SIGNAL_PACK) {
	return owner(t).mutation(api.workbench.createDraft, {
		kind: "signal-words-pack",
		title: "Pack",
		payload,
	});
}

function newQuizDraft(t: T) {
	return owner(t).mutation(api.workbench.createDraft, {
		kind: "quiz-set",
		title: "Quiz",
		payload: QUIZ_SET,
	});
}

describe("createDraft", () => {
	it("stores a valid draft owned by the caller, under the kind's game", async () => {
		const t = setup();
		const draftId = await newSignalDraft(t);
		expect(fields(await getDoc(t, draftId))).toEqual({
			ownerUserId: OWNER,
			gameType: "signal-words",
			kind: "signal-words-pack",
			title: "Pack",
			payload: SIGNAL_PACK,
			status: "draft",
			validationErrors: [],
		});
	});

	it("names a blank title, and trims any other", async () => {
		const t = setup();
		const create = (title: string) =>
			owner(t).mutation(api.workbench.createDraft, {
				kind: "signal-words-pack",
				title,
				payload: SIGNAL_PACK,
			});
		expect((await getDoc(t, await create("   ")))?.title).toBe(
			"Untitled draft",
		);
		expect((await getDoc(t, await create("  Pack  ")))?.title).toBe("Pack");
	});

	it("stores an invalid draft with its errors, prefixed by path", async () => {
		const t = setup();
		const fewWords = await newSignalDraft(t, '{"words":["one"]}');
		expect((await getDoc(t, fewWords))?.validationErrors).toEqual([
			"words: A pack needs at least 25 words (got 1)",
		]);
		const notJson = await newSignalDraft(t, "not json");
		expect((await getDoc(t, notJson))?.validationErrors).toEqual([
			"Payload is not valid JSON",
		]);
	});
});

describe("updateDraft", () => {
	it("stores a new payload and returns its errors", async () => {
		const t = setup();
		const draftId = await newSignalDraft(t);
		await expect(
			owner(t).mutation(api.workbench.updateDraft, {
				draftId,
				title: " New ",
				payload: '{"words":["one"]}',
			}),
		).resolves.toEqual(["words: A pack needs at least 25 words (got 1)"]);
		const stored = await getDoc(t, draftId);
		expect(stored?.title).toBe("New");
		expect(stored?.payload).toBe('{"words":["one"]}');
		expect(stored?.validationErrors).toEqual([
			"words: A pack needs at least 25 words (got 1)",
		]);
	});

	it("keeps the title when none or a blank one is given", async () => {
		const t = setup();
		const draftId = await newSignalDraft(t);
		for (const title of [undefined, "   "]) {
			await owner(t).mutation(api.workbench.updateDraft, {
				draftId,
				title,
				payload: SIGNAL_PACK,
			});
			expect((await getDoc(t, draftId))?.title).toBe("Pack");
		}
	});

	it("sends a reviewed draft back to draft", async () => {
		const t = setup();
		const draftId = await newSignalDraft(t);
		await owner(t).mutation(api.workbench.approveDraft, { draftId });
		await expect(
			owner(t).mutation(api.workbench.updateDraft, {
				draftId,
				payload: SIGNAL_PACK,
			}),
		).resolves.toEqual([]);
		const stored = await getDoc(t, draftId);
		expect(stored?.status).toBe("draft");
		expect(stored?.reviewedAt).toBeUndefined();
	});
});

describe("approveDraft", () => {
	it("approves a pack, with nothing to return", async () => {
		const t = setup();
		const draftId = await newSignalDraft(t);
		advance(1000);
		await expect(
			owner(t).mutation(api.workbench.approveDraft, { draftId }),
		).resolves.toEqual({});
		const stored = await getDoc(t, draftId);
		expect(stored?.status).toBe("approved");
		expect(stored?.reviewedAt).toBe(T0 + 1000);
		expect(stored?.validationErrors).toEqual([]);
	});

	it("turns a quiz draft into a playable set for its owner", async () => {
		const t = setup();
		const draftId = await newQuizDraft(t);
		const result = await owner(t).mutation(api.workbench.approveDraft, {
			draftId,
		});
		expect(Object.keys(result)).toEqual(["quizSetId"]);
		const quizSetId = (result as { quizSetId: Id<"quizSets"> }).quizSetId;
		expect(
			fields(await owner(t).query(api.quiz.getSet, { quizSetId })),
		).toEqual({
			ownerUserId: OWNER,
			title: "From a draft",
			description: "About",
			questions: QUIZ_QUESTIONS,
			isSample: false,
		});
	});

	it("pins that approving twice creates a second quiz set", async () => {
		const t = setup();
		const draftId = await newQuizDraft(t);
		await owner(t).mutation(api.workbench.approveDraft, { draftId });
		await owner(t).mutation(api.workbench.approveDraft, { draftId });
		await expect(owner(t).query(api.quiz.listMine, {})).resolves.toHaveLength(
			2,
		);
	});

	it("pins that a rejected draft can still be approved", async () => {
		const t = setup();
		const draftId = await newSignalDraft(t);
		await owner(t).mutation(api.workbench.rejectDraft, { draftId });
		await owner(t).mutation(api.workbench.approveDraft, { draftId });
		expect((await getDoc(t, draftId))?.status).toBe("approved");
	});

	it("pins that draftInvalid rolls back its own validationErrors update", async () => {
		const t = setup();
		const draftId = await newSignalDraft(t, '{"words":["one"]}');
		await arrange(t, draftId, { validationErrors: [] });
		await expectCode(
			owner(t).mutation(api.workbench.approveDraft, { draftId }),
			"draftInvalid",
		);
		const stored = await getDoc(t, draftId);
		expect(stored?.status).toBe("draft");
		expect(stored?.validationErrors).toEqual([]);
	});
});

describe("rejectDraft", () => {
	it("marks the draft rejected and stamps the review", async () => {
		const t = setup();
		const draftId = await newSignalDraft(t);
		advance(1000);
		await expect(
			owner(t).mutation(api.workbench.rejectDraft, { draftId }),
		).resolves.toBeNull();
		const stored = await getDoc(t, draftId);
		expect(stored?.status).toBe("rejected");
		expect(stored?.reviewedAt).toBe(T0 + 1000);
	});
});

describe("deleteDraft", () => {
	it("removes the draft", async () => {
		const t = setup();
		const draftId = await newSignalDraft(t);
		await owner(t).mutation(api.workbench.deleteDraft, { draftId });
		await expect(getDoc(t, draftId)).resolves.toBeNull();
	});
});

describe("listMine", () => {
	it("lists the caller's drafts, newest first", async () => {
		const t = setup();
		const first = await newSignalDraft(t);
		const second = await newQuizDraft(t);
		await owner(t, "user_other").mutation(api.workbench.createDraft, {
			kind: "quiz-set",
			title: "Theirs",
			payload: QUIZ_SET,
		});
		const drafts = await owner(t).query(api.workbench.listMine, {});
		expect(drafts.map((draft) => draft._id)).toEqual([second, first]);
	});
});

describe("guards", () => {
	it("answers signInRequired to a guest, on every function", async () => {
		const t = setup();
		const draftId = await newSignalDraft(t);
		await expectCode(
			t.mutation(api.workbench.createDraft, {
				kind: "quiz-set",
				title: "x",
				payload: "{}",
			}),
			"signInRequired",
		);
		await expectCode(
			t.mutation(api.workbench.updateDraft, { draftId, payload: "{}" }),
			"signInRequired",
		);
		await expectCode(
			t.mutation(api.workbench.approveDraft, { draftId }),
			"signInRequired",
		);
		await expectCode(
			t.mutation(api.workbench.rejectDraft, { draftId }),
			"signInRequired",
		);
		await expectCode(
			t.mutation(api.workbench.deleteDraft, { draftId }),
			"signInRequired",
		);
		await expectCode(t.query(api.workbench.listMine, {}), "signInRequired");
	});

	it("answers draftNotFound to anyone but the owner, and for a deleted draft", async () => {
		const t = setup();
		const foreign = await newSignalDraft(t);
		const deleted = await newSignalDraft(t);
		await owner(t).mutation(api.workbench.deleteDraft, { draftId: deleted });
		const other = owner(t, "user_other");
		for (const [caller, draftId] of [
			[other, foreign],
			[owner(t), deleted],
		] as const) {
			await expectCode(
				caller.mutation(api.workbench.updateDraft, { draftId, payload: "{}" }),
				"draftNotFound",
			);
			await expectCode(
				caller.mutation(api.workbench.approveDraft, { draftId }),
				"draftNotFound",
			);
			await expectCode(
				caller.mutation(api.workbench.rejectDraft, { draftId }),
				"draftNotFound",
			);
			await expectCode(
				caller.mutation(api.workbench.deleteDraft, { draftId }),
				"draftNotFound",
			);
		}
	});
});
