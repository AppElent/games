export type QuizPhase =
	| "lobby"
	| "question"
	| "reveal"
	| "scoreboard"
	| "finished";

export type QuizQuestionDraft = {
	id: string;
	prompt: string;
	choices: { id: string; label: string }[];
	correctChoiceIds: string[];
	durationSeconds: number;
	points: number;
};

const CHOICE_IDS = ["a", "b", "c", "d"] as const;

/**
 * Parses spreadsheet rows pasted as TSV into quiz questions.
 * Columns: prompt, choice 1, choice 2, [choice 3], [choice 4],
 * correct (1-based, comma-separated for multi), [seconds], [points].
 */
export function parseQuizQuestionsTsv(input: string): {
	questions: QuizQuestionDraft[];
	errors: string[];
} {
	const questions: QuizQuestionDraft[] = [];
	const errors: string[] = [];
	const lines = input
		.split(/\r?\n/)
		.map((line) => line.trimEnd())
		.filter((line) => line.trim().length > 0);
	lines.forEach((line, index) => {
		const rowLabel = `Row ${index + 1}`;
		const cells = line.split("\t").map((cell) => cell.trim());
		const [prompt, ...rest] = cells;
		if (!prompt) {
			errors.push(`${rowLabel}: missing prompt`);
			return;
		}
		if (rest.length < 3) {
			errors.push(`${rowLabel}: needs at least two choices`);
			return;
		}
		// The trailing columns are [correct] or [correct, seconds] or
		// [correct, seconds, points]; everything before them is choices.
		// Choice labels may be numeric too, so try the smallest trailing
		// width that yields a valid interpretation.
		let parsed:
			| { choiceLabels: string[]; correctIndexes: number[]; meta: string[] }
			| undefined;
		for (
			let metaSize = 1;
			metaSize <= Math.min(3, rest.length - 2);
			metaSize += 1
		) {
			const choiceLabels = rest.slice(0, rest.length - metaSize);
			if (choiceLabels.length > 4 || choiceLabels.some((label) => !label)) {
				continue;
			}
			const meta = rest.slice(rest.length - metaSize);
			const correctParts = meta[0].split(",").map((value) => value.trim());
			const correctIndexes = correctParts.map((value) =>
				/^\d+$/.test(value) ? Number.parseInt(value, 10) : Number.NaN,
			);
			if (
				correctIndexes.length === 0 ||
				correctIndexes.some(
					(value) =>
						!Number.isFinite(value) || value < 1 || value > choiceLabels.length,
				)
			) {
				continue;
			}
			parsed = { choiceLabels, correctIndexes, meta };
			break;
		}
		if (!parsed) {
			const maxChoices = Math.min(4, rest.length - 1);
			errors.push(
				`${rowLabel}: correct column must list choice numbers 1-${maxChoices}`,
			);
			return;
		}
		const durationSeconds = Number.parseInt(parsed.meta[1] ?? "", 10);
		const points = Number.parseInt(parsed.meta[2] ?? "", 10);
		questions.push({
			id: `q${index + 1}`,
			prompt,
			choices: parsed.choiceLabels.map((label, choiceIndex) => ({
				id: CHOICE_IDS[choiceIndex],
				label,
			})),
			correctChoiceIds: parsed.correctIndexes.map(
				(value) => CHOICE_IDS[value - 1],
			),
			durationSeconds:
				Number.isFinite(durationSeconds) && durationSeconds > 0
					? durationSeconds
					: 20,
			points: Number.isFinite(points) && points > 0 ? points : 1000,
		});
	});
	return { questions, errors };
}

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
