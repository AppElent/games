import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { ArrowLeft, Trophy } from "lucide-react";
import { SessionReport } from "#/components/results/SessionReports";
import { fmt, plural, useI18n } from "#/lib/i18n";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export const Route = createFileRoute("/dashboard/results/$sessionId")({
	component: SessionResultsPage,
});

function SessionResultsPage() {
	const { sessionId } = Route.useParams();
	const { messages, locale } = useI18n();
	const bundle = useQuery(api.sessions.getBundle, {
		sessionId: sessionId as Id<"gameSessions">,
	});

	if (bundle === undefined) {
		return (
			<main className="club-wrap py-10 text-[var(--club-muted)]">
				{messages.common.results.loadingResults}
			</main>
		);
	}
	if (bundle === null) {
		return (
			<main className="club-wrap py-10 club-error">
				{messages.common.results.sessionNotFound}
			</main>
		);
	}

	const { session, participants } = bundle;
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
					className="mb-4 inline-flex items-center gap-2 text-sm text-[var(--club-muted)] no-underline hover:text-[var(--club-text)]"
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
					<p className="mt-2 inline-flex items-center gap-2 rounded-md border border-[var(--club-amber)] bg-[var(--club-amber-dim)] px-3 py-1.5 text-[var(--club-amber)]">
						<Trophy className="h-4 w-4" />
						{fmt(messages.common.results.winnersAnnouncement, {
							names: winners.map((winner) => winner.displayName).join(", "),
						})}
					</p>
				) : null}
			</div>

			<SessionReport session={session} participants={participants} />
		</main>
	);
}
