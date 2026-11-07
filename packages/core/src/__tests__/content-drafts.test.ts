import { describe, expect, it } from "vitest";
import {
	getDraftGameType,
	validateContentDraft,
	validateQuizSetDraft,
	validateSignalWordsPack,
} from "../content-drafts";

const VALID_PUZZLE = {
	id: "draft-1",
	terms: [
		"ALPHA",
		"BRAVO",
		"CHARLIE",
		"DELTA",
		"ONE",
		"TWO",
		"THREE",
		"FOUR",
		"RED",
		"BLUE",
		"GREEN",
		"YELLOW",
		"CAT",
		"DOG",
		"BIRD",
		"FISH",
	],
	groups: [
		{
			id: "g1",
			label: "NATO letters",
			terms: ["ALPHA", "BRAVO", "CHARLIE", "DELTA"],
			difficulty: "easy",
		},
		{
			id: "g2",
			label: "Numbers",
			terms: ["ONE", "TWO", "THREE", "FOUR"],
			difficulty: "medium",
		},
		{
			id: "g3",
			label: "Colors",
			terms: ["RED", "BLUE", "GREEN", "YELLOW"],
			difficulty: "hard",
		},
		{
			id: "g4",
			label: "Pets",
			terms: ["CAT", "DOG", "BIRD", "FISH"],
			difficulty: "tricky",
		},
	],
};

const VALID_QUIZ = {
	title: "Team quiz",
	questions: [
		{
			id: "q1",
			prompt: "Pick A",
			choices: [
				{ id: "a", label: "A" },
				{ id: "b", label: "B" },
			],
			correctChoiceIds: ["a"],
			durationSeconds: 20,
			points: 1000,
		},
	],
};

describe("content draft validation", () => {
	it("maps draft kinds to game types", () => {
		expect(getDraftGameType("word-links-puzzle")).toBe("word-links");
		expect(getDraftGameType("signal-words-pack")).toBe("signal-words");
		expect(getDraftGameType("quiz-set")).toBe("live-quiz");
	});

	it("rejects payloads that are not JSON", () => {
		const errors = validateContentDraft("quiz-set", "{nope");
		expect(errors).toEqual([
			{ path: "", message: "Payload is not valid JSON" },
		]);
	});

	it("accepts a valid word links puzzle draft", () => {
		expect(
			validateContentDraft("word-links-puzzle", JSON.stringify(VALID_PUZZLE)),
		).toEqual([]);
	});

	it("rejects a structurally broken word links draft without crashing", () => {
		const errors = validateContentDraft(
			"word-links-puzzle",
			JSON.stringify({ id: 1, terms: "nope" }),
		);
		expect(errors.length).toBe(1);
		expect(errors[0].message).toContain("Puzzle must be");
	});

	it("accepts a valid quiz set draft and rejects broken questions", () => {
		expect(validateQuizSetDraft(VALID_QUIZ)).toEqual([]);
		const broken = validateQuizSetDraft({
			title: "",
			questions: [
				{
					id: "q1",
					prompt: "",
					choices: [{ id: "a", label: "A" }],
					correctChoiceIds: ["z"],
					durationSeconds: 0,
					points: -5,
				},
			],
		});
		const paths = broken.map((error) => error.path);
		expect(paths).toContain("title");
		expect(paths).toContain("questions[0].prompt");
		expect(paths).toContain("questions[0].choices");
		expect(paths).toContain("questions[0].correctChoiceIds");
		expect(paths).toContain("questions[0].durationSeconds");
		expect(paths).toContain("questions[0].points");
	});

	it("flags duplicate question ids", () => {
		const errors = validateQuizSetDraft({
			title: "Quiz",
			questions: [VALID_QUIZ.questions[0], VALID_QUIZ.questions[0]],
		});
		expect(
			errors.some((error) => error.message.includes("Duplicate question id")),
		).toBe(true);
	});

	it("validates signal words packs for size and duplicates", () => {
		const words = Array.from({ length: 25 }, (_, index) => `WORD${index}`);
		expect(validateSignalWordsPack({ words })).toEqual([]);
		expect(
			validateSignalWordsPack({ words: words.slice(0, 10) }).length,
		).toBeGreaterThan(0);
		const withDuplicate = [...words.slice(0, 24), "word0"];
		expect(
			validateSignalWordsPack({ words: withDuplicate }).some((error) =>
				error.message.includes("Duplicate"),
			),
		).toBe(true);
	});
});
