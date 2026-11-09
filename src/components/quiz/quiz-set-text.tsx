import { fmt, plural, useI18n } from "#/lib/i18n";

type QuizSetSummary = {
	_id: string;
	title: string;
	description?: string;
	questions: readonly unknown[];
};

/**
 * How a quiz set is described in lists: its question count, and in the set
 * manager also its description.
 */
export function useQuizSetText() {
	const { messages, locale } = useI18n();
	const questionCount = (set: QuizSetSummary) =>
		plural(locale, set.questions.length, messages.games.quiz.questionsCount);
	return {
		questionCount,
		summary: (set: QuizSetSummary) =>
			`${questionCount(set)}${
				set.description
					? fmt(messages.games.quiz.sets.descriptionSuffix, {
							description: set.description,
						})
					: ""
			}`,
	};
}

/** One `<option>` per set: "Title (n questions)". */
export function QuizSetOptions({ sets }: { sets: QuizSetSummary[] }) {
	const { questionCount } = useQuizSetText();
	return sets.map((set) => (
		<option key={set._id} value={set._id}>
			{set.title} ({questionCount(set)})
		</option>
	));
}
