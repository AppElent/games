import { describe, expect, it } from "vitest";
import {
	calculateAnswerScore,
	getNextQuizPhase,
	isCorrectAnswer,
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
});
