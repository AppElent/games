export type ResultParticipant = {
	_id: string;
	displayName: string;
	role: "host" | "player" | "watcher";
	kickedAt?: number;
};

export type ResultAnswer = {
	participantId: string;
	questionId: string;
	selectedChoiceIds: string[];
	correct: boolean;
	score: number;
};

export type ResultQuestion = {
	id: string;
	prompt: string;
	choices: { id: string; label: string }[];
	correctChoiceIds: string[];
};

/** Escapes a CSV cell per RFC 4180. */
function csvCell(value: string | number): string {
	const text = String(value);
	if (/[",\n\r]/.test(text)) {
		return `"${text.replace(/"/g, '""')}"`;
	}
	return text;
}

export function toCsv(rows: (string | number)[][]): string {
	return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

/** Ranked totals per participant (watchers and kicked players excluded). */
export function buildScoreboard(
	participants: ResultParticipant[],
	answers: ResultAnswer[],
) {
	const totals = new Map<string, { score: number; correct: number }>();
	for (const answer of answers) {
		const entry = totals.get(answer.participantId) ?? { score: 0, correct: 0 };
		entry.score += answer.score;
		entry.correct += answer.correct ? 1 : 0;
		totals.set(answer.participantId, entry);
	}
	return participants
		.filter(
			(participant) => participant.role === "player" && !participant.kickedAt,
		)
		.map((participant) => ({
			participantId: participant._id,
			displayName: participant.displayName,
			score: totals.get(participant._id)?.score ?? 0,
			correct: totals.get(participant._id)?.correct ?? 0,
		}))
		.sort((a, b) => b.score - a.score);
}

/**
 * Per-player CSV: rank, player, score, correct count, then one column per
 * question with that player's score for it.
 */
export function buildQuizResultsCsv(
	participants: ResultParticipant[],
	answers: ResultAnswer[],
	questions: ResultQuestion[],
): string {
	const scoreboard = buildScoreboard(participants, answers);
	const byParticipantAndQuestion = new Map<string, ResultAnswer>();
	for (const answer of answers) {
		byParticipantAndQuestion.set(
			`${answer.participantId}:${answer.questionId}`,
			answer,
		);
	}
	const header = [
		"Rank",
		"Player",
		"Score",
		"Correct",
		...questions.map((question, index) => `Q${index + 1}: ${question.prompt}`),
	];
	const rows = scoreboard.map((entry, index) => [
		index + 1,
		entry.displayName,
		entry.score,
		entry.correct,
		...questions.map((question) => {
			const answer = byParticipantAndQuestion.get(
				`${entry.participantId}:${question.id}`,
			);
			return answer ? answer.score : "";
		}),
	]);
	return toCsv([header, ...rows]);
}

/** Per-question accuracy stats for the host report. */
export function buildQuestionStats(
	answers: ResultAnswer[],
	questions: ResultQuestion[],
) {
	return questions.map((question, index) => {
		const questionAnswers = answers.filter(
			(answer) => answer.questionId === question.id,
		);
		const correct = questionAnswers.filter((answer) => answer.correct).length;
		return {
			questionId: question.id,
			index,
			prompt: question.prompt,
			answered: questionAnswers.length,
			correct,
			accuracy:
				questionAnswers.length === 0
					? 0
					: Math.round((correct / questionAnswers.length) * 100),
		};
	});
}

export type GameStatsRow = {
	gameType: string;
	played: number;
	completed: number;
	won: number;
};

/**
 * Aggregates a user's participation rows into per-game stats. `won` counts
 * sessions whose winnerParticipantIds include the user's participant row.
 */
export function buildGameStats(
	rows: {
		session: {
			gameType: string;
			status: string;
			winnerParticipantIds?: string[];
		};
		participant: { _id: string };
	}[],
): GameStatsRow[] {
	const byGame = new Map<string, GameStatsRow>();
	for (const row of rows) {
		const entry = byGame.get(row.session.gameType) ?? {
			gameType: row.session.gameType,
			played: 0,
			completed: 0,
			won: 0,
		};
		entry.played += 1;
		if (row.session.status === "completed") {
			entry.completed += 1;
			if (row.session.winnerParticipantIds?.includes(row.participant._id)) {
				entry.won += 1;
			}
		}
		byGame.set(row.session.gameType, entry);
	}
	return [...byGame.values()].sort((a, b) => b.played - a.played);
}

/** Triggers a client-side download of CSV content. */
export function downloadCsv(filename: string, csv: string) {
	const blob = new Blob([`﻿${csv}`], {
		type: "text/csv;charset=utf-8",
	});
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = filename;
	anchor.click();
	URL.revokeObjectURL(url);
}
