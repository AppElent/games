import { useQuery } from "convex/react";
import { Download } from "lucide-react";
import { downloadCsv, toCsv } from "#/lib/games/csv";
import {
	buildQuestionStats,
	buildQuizResultsCsv,
	buildScoreboard,
	type ResultParticipant,
} from "#/lib/games/quiz-report";
import { fmt, useMessages } from "#/lib/i18n";
import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";

/**
 * A finished session's report under the results header. Only the live quiz
 * keeps scores; every other game lists its players at zero points.
 */
export function SessionReport({
	session,
	participants,
}: {
	session: Pick<Doc<"gameSessions">, "_id" | "gameType">;
	participants: ResultParticipant[];
}) {
	return session.gameType === "live-quiz" ? (
		<QuizReport sessionId={session._id} participants={participants} />
	) : (
		<ScoreboardSection
			sessionId={session._id}
			scoreboard={buildScoreboard(participants, [])}
		/>
	);
}

/** The quiz's scores from its answers, then each question's accuracy. */
function QuizReport({
	sessionId,
	participants,
}: {
	sessionId: Id<"gameSessions">;
	participants: ResultParticipant[];
}) {
	const messages = useMessages();
	const quizBundle = useQuery(api.quiz.getBundle, { sessionId });
	if (quizBundle === undefined) {
		return null;
	}
	const quizSet = quizBundle?.quizSet ?? null;
	const answers = quizBundle?.answers ?? [];
	const questionStats = quizSet
		? buildQuestionStats(answers, quizSet.questions)
		: [];
	return (
		<>
			<ScoreboardSection
				sessionId={sessionId}
				scoreboard={buildScoreboard(participants, answers)}
				quizCsv={
					quizSet
						? () =>
								buildQuizResultsCsv(participants, answers, quizSet.questions)
						: undefined
				}
			/>
			{questionStats.length > 0 ? (
				<section className="club-panel rounded-lg p-5">
					<h2 className="mb-3 club-panel-heading">
						{messages.common.results.questionAccuracy}
					</h2>
					<ul className="space-y-2">
						{questionStats.map((stat) => (
							<li
								key={stat.questionId}
								className="rounded-md bg-white/5 px-4 py-2.5"
							>
								<div className="flex items-center justify-between gap-3">
									<span className="min-w-0 truncate text-white">
										Q{stat.index + 1}. {stat.prompt}
									</span>
									<span className="shrink-0 tabular-nums text-slate-300">
										{fmt(messages.common.results.correctOf, {
											correct: stat.correct,
											answered: stat.answered,
											accuracy: stat.accuracy,
										})}
									</span>
								</div>
								<div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
									<div
										className="h-full rounded-full bg-emerald-400"
										style={{ width: `${stat.accuracy}%` }}
									/>
								</div>
							</li>
						))}
					</ul>
				</section>
			) : null}
		</>
	);
}

/**
 * The ranked board with its CSV export: the quiz's per-question file when
 * `quizCsv` is given, else rank, player and score under the viewer's headers.
 */
function ScoreboardSection({
	sessionId,
	scoreboard,
	quizCsv,
}: {
	sessionId: string;
	scoreboard: ReturnType<typeof buildScoreboard>;
	quizCsv?: () => string;
}) {
	const messages = useMessages();
	if (scoreboard.length === 0) {
		return (
			<section className="club-panel rounded-lg p-5 text-slate-400">
				{messages.common.results.noScores}
			</section>
		);
	}
	return (
		<section className="club-panel rounded-lg p-5">
			<div className="mb-3 flex items-center justify-between">
				<h2 className="club-panel-heading">
					{messages.common.results.scoreboard}
				</h2>
				<button
					type="button"
					className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-sm font-bold text-white hover:bg-white/10"
					onClick={() => {
						if (quizCsv) {
							downloadCsv(`quiz-results-${sessionId.slice(-6)}.csv`, quizCsv());
						} else {
							downloadCsv(
								`results-${sessionId.slice(-6)}.csv`,
								toCsv([
									[
										messages.common.results.rank,
										messages.common.participants.player,
										messages.common.results.score,
									],
									...scoreboard.map((entry, index) => [
										index + 1,
										entry.displayName,
										entry.score,
									]),
								]),
							);
						}
					}}
				>
					<Download className="h-4 w-4" />
					{messages.common.results.exportCsv}
				</button>
			</div>
			<ol className="space-y-2">
				{scoreboard.map((entry, index) => (
					<li
						key={entry.participantId}
						className="flex items-center justify-between rounded-md bg-white/5 px-4 py-2.5"
					>
						<span className="font-bold text-white">
							{index + 1}. {entry.displayName}
						</span>
						<span className="tabular-nums text-slate-300">
							{fmt(messages.common.results.points, { count: entry.score })}
						</span>
					</li>
				))}
			</ol>
		</section>
	);
}
