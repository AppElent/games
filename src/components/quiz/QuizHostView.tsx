import { useMutation } from "convex/react";
import { ChevronRight, Eye, Trophy } from "lucide-react";
import { ParticipantList } from "#/components/games/ParticipantList";
import { formatJoinCode } from "#/lib/games/sessions";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Scoreboard } from "./Scoreboard";

type QuizBundle = {
	session: {
		_id: Id<"gameSessions">;
		title: string;
		joinCode?: string;
	};
	participants: Array<{
		_id: string;
		displayName: string;
		role: "host" | "player" | "watcher";
		seat?: string;
		connected: boolean;
	}>;
	quizState: {
		phase: "lobby" | "question" | "reveal" | "scoreboard" | "finished";
		currentQuestionIndex: number;
		showCorrectAnswer: boolean;
	} | null;
	quizSet: {
		title: string;
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
		score: number;
		correct: boolean;
	}>;
};

export function QuizHostView({ bundle }: { bundle: QuizBundle }) {
	const advancePhase = useMutation(api.quiz.advancePhase);
	const state = bundle.quizState;
	const question = state
		? bundle.quizSet?.questions[state.currentQuestionIndex]
		: null;
	const currentAnswers = question
		? bundle.answers.filter((answer) => answer.questionId === question.id)
		: [];
	const playerCount = bundle.participants.filter(
		(participant) => participant.role !== "host",
	).length;

	return (
		<div className="grid gap-5 lg:grid-cols-[1fr_320px]">
			<section className="club-panel rounded-lg p-6">
				<div className="mb-5 flex flex-wrap items-start justify-between gap-4">
					<div>
						<p className="club-kicker mb-2">Live Quiz</p>
						<h1 className="club-title text-3xl font-bold text-white">
							{bundle.session.title}
						</h1>
					</div>
					<div className="rounded-md border border-cyan-300/30 bg-cyan-300/10 px-4 py-3 text-right">
						<span className="block text-xs font-bold uppercase tracking-wide text-cyan-100">
							Join code
						</span>
						<span className="club-title text-3xl font-bold text-white">
							{bundle.session.joinCode
								? formatJoinCode(bundle.session.joinCode)
								: "------"}
						</span>
					</div>
				</div>

				{state?.phase === "lobby" ? (
					<div className="rounded-lg border border-white/10 bg-white/5 p-8 text-center">
						<p className="text-lg text-slate-300">
							{playerCount} player{playerCount === 1 ? "" : "s"} in the room
						</p>
						<h2 className="club-title mt-3 text-4xl font-bold text-white">
							Ready when you are
						</h2>
					</div>
				) : null}

				{question ? (
					<div className="rounded-lg border border-white/10 bg-black/20 p-6">
						<div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-300">
							<span>
								Question {state ? state.currentQuestionIndex + 1 : 1} of{" "}
								{bundle.quizSet?.questions.length ?? 1}
							</span>
							<span className="rounded-full bg-white/10 px-3 py-1">
								{state?.phase}
							</span>
						</div>
						<h2 className="club-title mb-5 text-4xl font-bold text-white">
							{question.prompt}
						</h2>
						<div className="grid gap-3 sm:grid-cols-2">
							{question.choices.map((choice) => {
								const correct = question.correctChoiceIds.includes(choice.id);
								const reveal = state?.showCorrectAnswer && correct;
								return (
									<div
										key={choice.id}
										className={`rounded-md border px-4 py-3 text-lg font-bold ${
											reveal
												? "border-emerald-300 bg-emerald-300/20 text-emerald-50"
												: "border-white/10 bg-white/5 text-white"
										}`}
									>
										{choice.label}
									</div>
								);
							})}
						</div>
					</div>
				) : null}

				<div className="mt-5 flex flex-wrap items-center justify-between gap-3">
					<div className="flex items-center gap-2 text-sm text-slate-300">
						<Eye className="h-4 w-4 text-cyan-300" />
						{currentAnswers.length} answer
						{currentAnswers.length === 1 ? "" : "s"} submitted
					</div>
					<button
						type="button"
						className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2.5 font-bold text-slate-950"
						onClick={() => void advancePhase({ sessionId: bundle.session._id })}
					>
						{state?.phase === "finished" ? (
							<>
								<Trophy className="h-4 w-4" />
								Finished
							</>
						) : (
							<>
								<ChevronRight className="h-4 w-4" />
								Advance
							</>
						)}
					</button>
				</div>
			</section>
			<aside className="space-y-4">
				<ParticipantList participants={bundle.participants} />
				<Scoreboard
					participants={bundle.participants}
					answers={bundle.answers}
				/>
			</aside>
		</div>
	);
}
