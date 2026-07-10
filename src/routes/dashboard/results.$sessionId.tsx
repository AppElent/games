import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { ArrowLeft, Download, Trophy } from "lucide-react";
import {
	buildQuestionStats,
	buildQuizResultsCsv,
	buildScoreboard,
	downloadCsv,
	toCsv,
} from "#/lib/games/results";
import { fmt, plural, useI18n } from "#/lib/i18n";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export const Route = createFileRoute("/dashboard/results/$sessionId")({
	component: SessionResultsPage,
});

function SessionResultsPage() {
	const { sessionId } = Route.useParams();
	const { messages, locale } = useI18n();
	const results = useQuery(api.sessions.getResults, {
		sessionId: sessionId as Id<"gameSessions">,
	});

	if (results === undefined) {
		return (
			<main className="club-wrap py-10 text-slate-300">
				{messages.common.results.loadingResults}
			</main>
		);
	}
	if (results === null) {
		return (
			<main className="club-wrap py-10 text-orange-200">
				{messages.common.results.sessionNotFound}
			</main>
		);
	}

	const { session, participants, quizSet, answers } = results;
	const isQuiz = session.gameType === "live-quiz" && quizSet;
	const scoreboard = buildScoreboard(participants, answers);
	const questionStats = quizSet
		? buildQuestionStats(answers, quizSet.questions)
		: [];
	const winners = participants.filter((participant) =>
		session.winnerParticipantIds?.includes(participant._id),
	);
	const durationMinutes =
		session.startedAt && session.endedAt
			? Math.max(1, Math.round((session.endedAt - session.startedAt) / 60000))
			: undefined;

	return (
		<main className="club-wrap space-y-6 py-10">
			<div>
				<Link
					to="/dashboard"
					className="mb-4 inline-flex items-center gap-2 text-sm text-slate-300 no-underline hover:text-white"
				>
					<ArrowLeft className="h-4 w-4" />
					{messages.common.results.backToDashboard}
				</Link>
				<p className="club-kicker mb-2">{messages.common.results.kicker}</p>
				<h1 className="club-title text-4xl font-bold text-[var(--club-text)]">
					{session.title}
				</h1>
				<p className="mt-2 text-[var(--club-muted)]">
					{session.gameType} — {session.status}
					{durationMinutes
						? ` — ${fmt(messages.common.results.durationMinutes, { count: durationMinutes })}`
						: ""}
					{session.participantCount
						? ` — ${plural(locale, session.participantCount, messages.common.results.participants)}`
						: ""}
				</p>
				{winners.length > 0 ? (
					<p className="mt-2 inline-flex items-center gap-2 rounded-md border border-amber-300/30 bg-amber-300/10 px-3 py-1.5 text-amber-100">
						<Trophy className="h-4 w-4" />
						{fmt(messages.common.results.winnersAnnouncement, {
							names: winners.map((winner) => winner.displayName).join(", "),
						})}
					</p>
				) : null}
			</div>

			{scoreboard.length > 0 ? (
				<section className="club-panel rounded-lg p-5">
					<div className="mb-3 flex items-center justify-between">
						<h2 className="text-sm font-bold uppercase tracking-wide text-slate-300">
							{messages.common.results.scoreboard}
						</h2>
						<button
							type="button"
							className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-sm font-bold text-white hover:bg-white/10"
							onClick={() => {
								if (isQuiz && quizSet) {
									downloadCsv(
										`quiz-results-${sessionId.slice(-6)}.csv`,
										buildQuizResultsCsv(
											participants,
											answers,
											quizSet.questions,
										),
									);
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
			) : (
				<section className="club-panel rounded-lg p-5 text-slate-400">
					{messages.common.results.noScores}
				</section>
			)}

			{questionStats.length > 0 ? (
				<section className="club-panel rounded-lg p-5">
					<h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-300">
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
		</main>
	);
}
