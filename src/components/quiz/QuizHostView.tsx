import { useMutation } from "convex/react";
import { ChevronRight, Eye, Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import { GameEndScreen } from "#/components/games/GameEndScreen";
import { ParticipantList } from "#/components/games/ParticipantList";
import { SessionHostControls } from "#/components/games/SessionHostControls";
import { formatJoinCode } from "#/lib/games/sessions";
import { fmt, plural, useI18n } from "#/lib/i18n";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Scoreboard } from "./Scoreboard";

type QuizBundle = {
	session: {
		_id: Id<"gameSessions">;
		title: string;
		joinCode?: string;
		hostParticipantId?: Id<"sessionParticipants">;
		locked?: boolean;
	};
	participants: Array<{
		_id: string;
		displayName: string;
		role: "host" | "player" | "watcher";
		seat?: string;
		connected: boolean;
		kickedAt?: number;
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
	const { messages, locale } = useI18n();
	const advancePhase = useMutation(api.quiz.advancePhase);
	const kickParticipant = useMutation(api.sessions.kickParticipant);
	const transferHost = useMutation(api.sessions.transferHost);
	const [participantId, setParticipantId] = useState<string>();
	useEffect(() => {
		setParticipantId(
			window.sessionStorage.getItem("arcade-club.hostParticipantId") ??
				window.sessionStorage.getItem("arcade-club.participantId") ??
				undefined,
		);
	}, []);
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
	const totals = new Map<string, number>();
	for (const answer of bundle.answers) {
		totals.set(
			answer.participantId,
			(totals.get(answer.participantId) ?? 0) + answer.score,
		);
	}
	const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]);
	const winner = ranked.length
		? bundle.participants.find(
				(participant) => participant._id === ranked[0][0],
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
					<div className="rounded-md border border-cyan-300/30 bg-cyan-300/10 px-4 py-3 text-right">
						<span className="block text-xs font-bold uppercase tracking-wide text-cyan-100">
							{messages.games.quiz.hostView.joinCode}
						</span>
						<span className="club-title text-3xl font-bold text-white">
							{bundle.session.joinCode
								? formatJoinCode(bundle.session.joinCode)
								: messages.games.quiz.hostView.joinCodePlaceholder}
						</span>
					</div>
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
						onClick={() => void advancePhase({ sessionId: bundle.session._id })}
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
										points: ranked[0][1],
									})
								: messages.games.quiz.hostView.thanksForPlaying
						}
						shareText={
							winner
								? fmt(messages.games.quiz.hostView.shareTextWinner, {
										name: winner.displayName,
										points: ranked[0][1],
										count: playerCount,
									})
								: fmt(messages.games.quiz.hostView.shareTextNoWinner, {
										count: playerCount,
									})
						}
						newGameRoute="/quiz/new"
						newGameLabel={messages.games.quiz.hostView.hostAnotherQuiz}
					/>
				) : null}
				{isHost && bundle.session.hostParticipantId ? (
					<SessionHostControls
						sessionId={bundle.session._id}
						hostParticipantId={
							bundle.session.hostParticipantId as Id<"sessionParticipants">
						}
						title={bundle.session.title}
						locked={Boolean(bundle.session.locked)}
					/>
				) : null}
				<ParticipantList
					participants={bundle.participants}
					hostControls={
						isHost && bundle.session.hostParticipantId
							? {
									onKick: (targetId) =>
										void kickParticipant({
											sessionId: bundle.session._id,
											hostParticipantId: bundle.session
												.hostParticipantId as Id<"sessionParticipants">,
											targetParticipantId:
												targetId as Id<"sessionParticipants">,
										}),
									onTransferHost: (targetId) =>
										void transferHost({
											sessionId: bundle.session._id,
											hostParticipantId: bundle.session
												.hostParticipantId as Id<"sessionParticipants">,
											targetParticipantId:
												targetId as Id<"sessionParticipants">,
										}),
								}
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
