export type QuizPhase =
	| "lobby"
	| "question"
	| "reveal"
	| "scoreboard"
	| "finished";

export type ScoredAnswer = {
	participantId: string;
	score: number;
};

export function isCorrectAnswer(selected: string[], correct: string[]) {
	if (selected.length !== correct.length) {
		return false;
	}
	const selectedSet = new Set(selected);
	return correct.every((answer) => selectedSet.has(answer));
}

export function calculateAnswerScore({
	correct,
	basePoints,
	answeredInMs,
	questionDurationMs,
}: {
	correct: boolean;
	basePoints: number;
	answeredInMs?: number;
	questionDurationMs?: number;
}) {
	if (!correct) {
		return 0;
	}
	if (!answeredInMs || !questionDurationMs || questionDurationMs <= 0) {
		return basePoints;
	}
	const remainingRatio = Math.max(
		0,
		Math.min(1, (questionDurationMs - answeredInMs) / questionDurationMs),
	);
	const speedBonusRatio = Math.min(1, remainingRatio / 0.75) * 0.25;
	return Math.round(basePoints + basePoints * speedBonusRatio);
}

export function summarizeScores(answers: ScoredAnswer[]) {
	const totals = new Map<string, number>();
	for (const answer of answers) {
		totals.set(
			answer.participantId,
			(totals.get(answer.participantId) ?? 0) + answer.score,
		);
	}
	return Array.from(totals, ([participantId, score]) => ({
		participantId,
		score,
	})).sort((a, b) => b.score - a.score);
}

export function getNextQuizPhase(phase: QuizPhase) {
	switch (phase) {
		case "lobby":
			return "question";
		case "question":
			return "reveal";
		case "reveal":
			return "scoreboard";
		case "scoreboard":
			return "question";
		case "finished":
			return "finished";
	}
}
