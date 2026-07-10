import { describe, expect, it } from "vitest";
import {
	calculateAnswerScore,
	getNextQuizPhase,
	isCorrectAnswer,
	parseQuizQuestionsTsv,
	summarizeScores,
} from "../quiz";

describe("quiz logic", () => {
	it("checks single-choice answers", () => {
		expect(isCorrectAnswer(["a"], ["a"])).toBe(true);
		expect(isCorrectAnswer(["a"], ["b"])).toBe(false);
	});

	it("checks multi-choice answers without depending on order", () => {
		expect(isCorrectAnswer(["a", "c"], ["c", "a"])).toBe(true);
		expect(isCorrectAnswer(["a", "b"], ["a", "c"])).toBe(false);
	});

	it("awards points for correct answers and zero for incorrect answers", () => {
		expect(calculateAnswerScore({ correct: true, basePoints: 1000 })).toBe(
			1000,
		);
		expect(calculateAnswerScore({ correct: false, basePoints: 1000 })).toBe(0);
	});

	it("applies a time bonus when timing data exists", () => {
		expect(
			calculateAnswerScore({
				correct: true,
				basePoints: 1000,
				answeredInMs: 5_000,
				questionDurationMs: 20_000,
			}),
		).toBe(1250);
	});

	it("summarizes scores by participant", () => {
		expect(
			summarizeScores([
				{ participantId: "p1", score: 100 },
				{ participantId: "p2", score: 300 },
				{ participantId: "p1", score: 50 },
			]),
		).toEqual([
			{ participantId: "p2", score: 300 },
			{ participantId: "p1", score: 150 },
		]);
	});

	it("moves quiz phases in host-controlled order", () => {
		expect(getNextQuizPhase("lobby")).toBe("question");
		expect(getNextQuizPhase("question")).toBe("reveal");
		expect(getNextQuizPhase("reveal")).toBe("scoreboard");
		expect(getNextQuizPhase("scoreboard")).toBe("question");
		expect(getNextQuizPhase("finished")).toBe("finished");
	});

	it("parses pasted TSV rows into questions", () => {
		const { questions, errors } = parseQuizQuestionsTsv(
			[
				"What is 2+2?\t3\t4\t5\t22\t2",
				"Pick primes\t2\t4\t7\t9\t1,3\t30\t500",
				"True or false: the sky is blue\tTrue\tFalse\t1",
			].join("\n"),
		);
		expect(errors).toEqual([]);
		expect(questions).toHaveLength(3);
		expect(questions[0]).toMatchObject({
			prompt: "What is 2+2?",
			correctChoiceIds: ["b"],
			durationSeconds: 20,
			points: 1000,
		});
		expect(questions[0].choices.map((choice) => choice.label)).toEqual([
			"3",
			"4",
			"5",
			"22",
		]);
		expect(questions[1]).toMatchObject({
			correctChoiceIds: ["a", "c"],
			durationSeconds: 30,
			points: 500,
		});
		expect(questions[2].choices).toHaveLength(2);
		expect(questions[2].correctChoiceIds).toEqual(["a"]);
	});

	it("reports row-level errors for bad TSV input", () => {
		const { questions, errors } = parseQuizQuestionsTsv(
			["\t3\t4\t1", "Only one choice\tA\t1", "No correct\tA\tB\tC\tD"].join(
				"\n",
			),
		);
		expect(questions).toEqual([]);
		expect(errors).toHaveLength(3);
		expect(errors[0]).toContain("Row 1");
		expect(errors[1]).toContain("two choices");
		expect(errors[2]).toContain("correct column");
	});

	it("skips blank lines when parsing TSV", () => {
		const { questions, errors } = parseQuizQuestionsTsv("\nQ?\tA\tB\t1\n\n");
		expect(errors).toEqual([]);
		expect(questions).toHaveLength(1);
	});
});
