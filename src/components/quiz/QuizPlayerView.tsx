import { useMutation } from "convex/react";
import { CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { getUserErrorMessage } from "#/lib/games/errors";
import { fmt, useMessages } from "#/lib/i18n";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

type QuizBundle = {
	session: { _id: Id<"gameSessions">; title: string };
	quizState: {
		phase: "lobby" | "question" | "reveal" | "scoreboard" | "finished";
		currentQuestionIndex: number;
		showCorrectAnswer: boolean;
	} | null;
	quizSet: {
		questions: Array<{
			id: string;
			prompt: string;
			choices: Array<{ id: string; label: string }>;
			correctChoiceIds: string[];
		}>;
	} | null;
	answers: Array<{
		participantId: string;
		questionId: string;
		selectedChoiceIds: string[];
		correct: boolean;
		score: number;
	}>;
};

export function QuizPlayerView({
	bundle,
	participantId,
}: {
	bundle: QuizBundle;
	participantId?: string;
}) {
	const messages = useMessages();
	const submitAnswer = useMutation(api.quiz.submitAnswer);
	const [pendingChoice, setPendingChoice] = useState("");
	const [error, setError] = useState("");
	const state = bundle.quizState;
	const question = state
		? bundle.quizSet?.questions[state.currentQuestionIndex]
		: null;
	const existingAnswer = question
		? bundle.answers.find(
				(answer) =>
					answer.participantId === participantId &&
					answer.questionId === question.id,
			)
		: null;

	if (!participantId) {
		return (
			<section className="club-panel max-w-md rounded-lg p-6 text-center">
				<p className="club-kicker mb-3">
					{messages.games.quiz.playerView.joinNeeded}
				</p>
				<h1 className="club-title text-3xl font-bold text-white">
					{messages.games.quiz.playerView.useRoomCodeFirst}
				</h1>
				<p className="mt-3 text-slate-300">
					{messages.games.quiz.playerView.joinFromHomeNotice}
				</p>
			</section>
		);
	}

	if (!state || !question || state.phase === "lobby") {
		return (
			<section className="club-panel max-w-md rounded-lg p-6 text-center">
				<p className="club-kicker mb-3">
					{messages.games.quiz.playerView.youAreIn}
				</p>
				<h1 className="club-title text-3xl font-bold text-white">
					{messages.games.quiz.playerView.waitingForHost}
				</h1>
				<p className="mt-3 text-slate-300">
					{messages.games.quiz.playerView.firstQuestionNotice}
				</p>
			</section>
		);
	}

	return (
		<section className="club-panel w-full max-w-2xl rounded-lg p-5">
			<p className="club-kicker mb-2">{bundle.session.title}</p>
			<div className="mb-4 flex items-center justify-between gap-3 text-sm text-slate-300">
				<span>
					{fmt(messages.games.quiz.questionNumber, {
						number: state.currentQuestionIndex + 1,
					})}
				</span>
				<span className="rounded-full bg-white/10 px-3 py-1">
					{messages.games.quiz.phase[state.phase]}
				</span>
			</div>
			<h1 className="club-title mb-5 text-3xl font-bold text-white">
				{question.prompt}
			</h1>
			<div className="grid gap-3">
				{question.choices.map((choice) => {
					const selected =
						pendingChoice === choice.id ||
						existingAnswer?.selectedChoiceIds.includes(choice.id);
					const correct = question.correctChoiceIds.includes(choice.id);
					const reveal = state.showCorrectAnswer && correct;
					return (
						<button
							key={choice.id}
							type="button"
							disabled={!!existingAnswer || state.phase !== "question"}
							onClick={async () => {
								setPendingChoice(choice.id);
								setError("");
								try {
									await submitAnswer({
										sessionId: bundle.session._id,
										participantId: participantId as Id<"sessionParticipants">,
										selectedChoiceIds: [choice.id],
									});
								} catch (caught) {
									setError(
										getUserErrorMessage(
											caught,
											messages.games.quiz.playerView.submitError,
										),
									);
								}
							}}
							className={`flex min-h-14 items-center justify-between rounded-md border px-4 py-3 text-left font-bold ${
								reveal
									? "border-emerald-300 bg-emerald-300/20 text-emerald-50"
									: selected
										? "border-cyan-300 bg-cyan-300/20 text-cyan-50"
										: "border-white/10 bg-white/5 text-white"
							}`}
						>
							<span>{choice.label}</span>
							{selected ? <CheckCircle2 className="h-5 w-5" /> : null}
						</button>
					);
				})}
			</div>
			{existingAnswer ? (
				<p className="mt-4 rounded-md bg-white/5 p-3 text-sm text-slate-200">
					{fmt(messages.games.quiz.playerView.answerLocked, {
						score: existingAnswer.score,
					})}
				</p>
			) : null}
			{error ? <p className="mt-4 text-sm text-orange-200">{error}</p> : null}
		</section>
	);
}
