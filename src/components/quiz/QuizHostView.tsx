import { summarizeScores } from "@arcadeclub/core/quiz";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ChevronRight, Eye, Trophy } from "lucide-react";
import { GameEndScreen } from "#/components/games/GameEndScreen";
import { JoinCodePanel } from "#/components/games/JoinCodePanel";
import { ModerationActions } from "#/components/games/ModerationActions";
import { ParticipantList } from "#/components/games/ParticipantList";
import { SessionHostControls } from "#/components/games/SessionHostControls";
import { useSessionModeration } from "#/components/games/useSessionModeration";
import { getGameRoute } from "#/lib/games/catalog";
import { useSeat } from "#/lib/games/seat";
import { useGameAction } from "#/lib/games/use-game-action";
import { fmt, plural, useI18n } from "#/lib/i18n";
import { api } from "../../../convex/_generated/api";
import { Scoreboard } from "./Scoreboard";

type QuizBundle = NonNullable<FunctionReturnType<typeof api.quiz.getBundle>>;

export function QuizHostView({ bundle }: { bundle: QuizBundle }) {
	const { messages, locale } = useI18n();
	const advancePhase = useMutation(api.quiz.advancePhase);
	const participantId = useSeat(bundle.session._id);
	const { error, run } = useGameAction();
	const actionFailed = messages.games.quiz.hostView.actionFailed;
	const moderation = useSessionModeration(
		bundle.session._id,
		bundle.session.hostParticipantId,
	);
	const state = bundle.quizState;
	const question = state
		? bundle.quizSet?.questions[state.currentQuestionIndex]
		: null;
	const currentAnswers = question
		? bundle.answers.filter((answer) => answer.questionId === question.id)
		: [];
	const playerCount = bundle.participants.filter(
		(participant) => participant.role !== "host" && !participant.kickedAt,
	).length;
	const isHost =
		Boolean(participantId) &&
		bundle.session.hostParticipantId === participantId;

	const finished = state?.phase === "finished";
	const leader = summarizeScores(bundle.answers).ranking[0];
	const winner = leader
		? bundle.participants.find(
				(participant) => participant._id === leader.participantId,
			)
		: undefined;
	const phaseLabel = state ? messages.games.quiz.phase[state.phase] : "";

	return (
		<div className="grid gap-5 lg:grid-cols-[1fr_320px]">
			<section className="club-panel rounded-lg p-6">
				<div className="mb-5 flex flex-wrap items-start justify-between gap-4">
					<div>
						<p className="club-kicker mb-2">
							{messages.catalog["live-quiz"].title}
						</p>
						<h1 className="club-title text-3xl font-bold text-white">
							{bundle.session.title}
						</h1>
					</div>
					<JoinCodePanel tone="quiz" joinCode={bundle.session.joinCode} />
				</div>

				{state?.phase === "lobby" ? (
					<div className="rounded-lg border border-white/10 bg-white/5 p-8 text-center">
						<p className="text-lg text-slate-300">
							{fmt(messages.games.quiz.hostView.playersInRoom, {
								players: plural(
									locale,
									playerCount,
									messages.common.session.players,
								),
							})}
						</p>
						<h2 className="club-title mt-3 text-4xl font-bold text-white">
							{messages.games.quiz.hostView.readyWhenYouAre}
						</h2>
					</div>
				) : null}

				{question ? (
					<div className="rounded-lg border border-white/10 bg-black/20 p-6">
						<div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-300">
							<span>
								{fmt(messages.games.quiz.hostView.questionProgress, {
									current: state ? state.currentQuestionIndex + 1 : 1,
									total: bundle.quizSet?.questions.length ?? 1,
								})}
							</span>
							<span className="rounded-full bg-white/10 px-3 py-1">
								{phaseLabel}
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
						{plural(
							locale,
							currentAnswers.length,
							messages.games.quiz.hostView.answersSubmitted,
						)}
					</div>
					<button
						type="button"
						className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2.5 font-bold text-slate-950"
						onClick={() =>
							run(
								() => advancePhase({ sessionId: bundle.session._id }),
								actionFailed,
							)
						}
					>
						{state?.phase === "finished" ? (
							<>
								<Trophy className="h-4 w-4" />
								{messages.games.quiz.phase.finished}
							</>
						) : (
							<>
								<ChevronRight className="h-4 w-4" />
								{messages.games.quiz.hostView.advance}
							</>
						)}
					</button>
				</div>
				{error ? <p className="mt-3 club-error">{error}</p> : null}
			</section>
			<aside className="space-y-4">
				{finished ? (
					<GameEndScreen
						heading={
							winner
								? fmt(messages.games.quiz.hostView.winnerHeading, {
										name: winner.displayName,
									})
								: messages.games.quiz.hostView.quizComplete
						}
						subtitle={
							winner
								? fmt(messages.games.quiz.hostView.pointsWon, {
										points: leader.score,
									})
								: messages.games.quiz.hostView.thanksForPlaying
						}
						shareText={
							winner
								? fmt(messages.games.quiz.hostView.shareTextWinner, {
										name: winner.displayName,
										points: leader.score,
										count: playerCount,
									})
								: fmt(messages.games.quiz.hostView.shareTextNoWinner, {
										count: playerCount,
									})
						}
						newGameRoute={getGameRoute("live-quiz")}
						newGameLabel={messages.games.quiz.hostView.hostAnotherQuiz}
					/>
				) : null}
				{isHost && moderation ? (
					<SessionHostControls
						moderation={moderation}
						title={bundle.session.title}
						locked={Boolean(bundle.session.locked)}
					/>
				) : null}
				<ParticipantList
					participants={bundle.participants}
					renderActions={
						isHost && moderation
							? (participant) => (
									<ModerationActions
										participant={participant}
										onTransferHost={() =>
											run(
												() => moderation.transferHost(participant._id),
												actionFailed,
											)
										}
										onKick={() =>
											run(() => moderation.kick(participant._id), actionFailed)
										}
									/>
								)
							: undefined
					}
				/>
				<Scoreboard
					participants={bundle.participants}
					answers={bundle.answers}
				/>
			</aside>
		</div>
	);
}
