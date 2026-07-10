import { describe, expect, it } from "vitest";
import {
	buildGameStats,
	buildQuestionStats,
	buildQuizResultsCsv,
	buildScoreboard,
	toCsv,
} from "../results";

const PARTICIPANTS = [
	{ _id: "host", displayName: "Eric", role: "host" as const },
	{ _id: "p1", displayName: "Anna", role: "player" as const },
	{ _id: "p2", displayName: 'Bob "The Quiz" Jones', role: "player" as const },
	{
		_id: "p3",
		displayName: "Kicked",
		role: "player" as const,
		kickedAt: 123,
	},
];

const QUESTIONS = [
	{
		id: "q1",
		prompt: "First, question?",
		choices: [
			{ id: "a", label: "A" },
			{ id: "b", label: "B" },
		],
		correctChoiceIds: ["a"],
	},
	{
		id: "q2",
		prompt: "Second",
		choices: [
			{ id: "a", label: "A" },
			{ id: "b", label: "B" },
		],
		correctChoiceIds: ["b"],
	},
];

const ANSWERS = [
	{
		participantId: "p1",
		questionId: "q1",
		selectedChoiceIds: ["a"],
		correct: true,
		score: 1200,
	},
	{
		participantId: "p2",
		questionId: "q1",
		selectedChoiceIds: ["b"],
		correct: false,
		score: 0,
	},
	{
		participantId: "p2",
		questionId: "q2",
		selectedChoiceIds: ["b"],
		correct: true,
		score: 1000,
	},
];

describe("results helpers", () => {
	it("escapes CSV cells with quotes and commas", () => {
		expect(toCsv([["a,b", 'say "hi"', "plain"]])).toBe(
			'"a,b","say ""hi""",plain',
		);
	});

	it("ranks players by score and excludes host and kicked players", () => {
		const board = buildScoreboard(PARTICIPANTS, ANSWERS);
		expect(board.map((entry) => entry.participantId)).toEqual(["p1", "p2"]);
		expect(board[0]).toMatchObject({ score: 1200, correct: 1 });
	});

	it("builds a CSV with one column per question", () => {
		const csv = buildQuizResultsCsv(PARTICIPANTS, ANSWERS, QUESTIONS);
		const lines = csv.split("\r\n");
		expect(lines[0]).toContain('"Q1: First, question?"');
		expect(lines[0]).toContain("Q2: Second");
		expect(lines[1].startsWith("1,Anna,1200,1")).toBe(true);
		expect(lines[2]).toContain('"Bob ""The Quiz"" Jones"');
	});

	it("computes per-question accuracy", () => {
		const stats = buildQuestionStats(ANSWERS, QUESTIONS);
		expect(stats[0]).toMatchObject({ answered: 2, correct: 1, accuracy: 50 });
		expect(stats[1]).toMatchObject({ answered: 1, correct: 1, accuracy: 100 });
	});

	it("aggregates per-game stats with wins", () => {
		const stats = buildGameStats([
			{
				session: {
					gameType: "chess",
					status: "completed",
					winnerParticipantIds: ["me1"],
				},
				participant: { _id: "me1" },
			},
			{
				session: {
					gameType: "chess",
					status: "completed",
					winnerParticipantIds: ["other"],
				},
				participant: { _id: "me2" },
			},
			{
				session: { gameType: "chess", status: "active" },
				participant: { _id: "me3" },
			},
			{
				session: { gameType: "sudoku", status: "completed" },
				participant: { _id: "me4" },
			},
		]);
		expect(stats[0]).toEqual({
			gameType: "chess",
			played: 3,
			completed: 2,
			won: 1,
		});
		expect(stats[1]).toEqual({
			gameType: "sudoku",
			played: 1,
			completed: 1,
			won: 0,
		});
	});
});
