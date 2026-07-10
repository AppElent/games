import { SignedIn, SignedOut } from "@clerk/clerk-react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import {
	BarChart3,
	ChevronRight,
	FlaskConical,
	ListChecks,
} from "lucide-react";
import { useEffect } from "react";
import { GameCatalog } from "#/components/games/GameCatalog";
import { type GameType, getGameByType } from "#/lib/games/catalog";
import { buildGameStats } from "#/lib/games/results";
import { fmt, useI18n, useMessages } from "#/lib/i18n";
import { useGameLocalizer } from "#/lib/i18n/catalog";
import { api } from "../../../convex/_generated/api";
import { authConfig } from "../../lib/auth-config";

export const Route = createFileRoute("/dashboard/")({
	component: DashboardPage,
});

function DashboardPage() {
	const messages = useMessages();
	return (
		<>
			<SignedIn>
				<main className="club-wrap py-10">
					<p className="club-kicker mb-2">{messages.common.dashboard.kicker}</p>
					<h1 className="club-title mb-2 text-4xl font-bold text-[var(--club-text)]">
						{messages.common.dashboard.heading}
					</h1>
					<p className="mb-6 max-w-2xl text-[var(--club-muted)]">
						{messages.common.dashboard.intro}
					</p>
					<div className="mb-8 flex flex-wrap gap-3">
						<Link
							to="/quiz/sets"
							className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/5 px-4 py-2 text-sm font-bold text-[var(--club-text)] no-underline hover:bg-white/10"
						>
							<ListChecks className="h-4 w-4 text-cyan-300" />
							{messages.common.dashboard.quizSets}
						</Link>
						<Link
							to="/workbench"
							className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/5 px-4 py-2 text-sm font-bold text-[var(--club-text)] no-underline hover:bg-white/10"
						>
							<FlaskConical className="h-4 w-4 text-emerald-300" />
							{messages.common.dashboard.contentWorkbench}
						</Link>
					</div>
					<PlayerStats />
					<RecentGames />
					<GameCatalog />
				</main>
			</SignedIn>
			<SignedOut>
				<RedirectToSignIn />
			</SignedOut>
		</>
	);
}

function PlayerStats() {
	const rows = useQuery(api.sessions.listParticipation);
	const localize = useGameLocalizer();
	const messages = useMessages();
	if (!rows?.length) {
		return null;
	}
	const stats = buildGameStats(rows);
	return (
		<section className="mb-8">
			<h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-[var(--club-muted)]">
				<BarChart3 className="h-4 w-4 text-cyan-300" />
				{messages.common.dashboard.yourStats}
			</h2>
			<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
				{stats.slice(0, 4).map((stat) => {
					const base = getGameByType(stat.gameType as GameType);
					const game = base ? localize(base) : undefined;
					return (
						<div key={stat.gameType} className="club-panel rounded-lg p-4">
							<p className="text-sm font-bold text-[var(--club-text)]">
								{game?.title ?? stat.gameType}
							</p>
							<p className="mt-1 text-2xl font-bold text-[var(--club-text)]">
								{stat.played}
								<span className="ml-1 text-sm font-normal text-[var(--club-muted)]">
									{messages.common.dashboard.played}
								</span>
							</p>
							<p className="text-sm text-[var(--club-muted)]">
								{fmt(messages.common.dashboard.finished, {
									count: stat.completed,
								})}
								{stat.won > 0
									? ` ${fmt(messages.common.dashboard.won, { count: stat.won })}`
									: ""}
							</p>
						</div>
					);
				})}
			</div>
		</section>
	);
}

function RecentGames() {
	const rows = useQuery(api.sessions.listParticipation);
	const localize = useGameLocalizer();
	const { messages, locale } = useI18n();
	if (!rows?.length) {
		return null;
	}
	const recent = rows.slice(0, 8);
	return (
		<section className="mb-8">
			<h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-[var(--club-muted)]">
				{messages.common.dashboard.recentGames}
			</h2>
			<ul className="space-y-2">
				{recent.map(({ session, participant }) => {
					const base = getGameByType(session.gameType as GameType);
					const game = base ? localize(base) : undefined;
					const won = session.winnerParticipantIds?.includes(participant._id);
					return (
						<li key={session._id}>
							<Link
								to="/dashboard/results/$sessionId"
								params={{ sessionId: session._id }}
								className="club-panel flex items-center justify-between gap-3 rounded-lg px-4 py-3 no-underline hover:bg-white/5"
							>
								<div className="min-w-0">
									<p className="truncate font-bold text-[var(--club-text)]">
										{session.title}
									</p>
									<p className="truncate text-sm text-[var(--club-muted)]">
										{game?.title ?? session.gameType} —{" "}
										{messages.common.dashboard.status[session.status]}
										{won ? ` ${messages.common.dashboard.youWon}` : ""}
										{" — "}
										{new Date(session._creationTime).toLocaleDateString(locale)}
									</p>
								</div>
								<ChevronRight className="h-4 w-4 shrink-0 text-[var(--club-muted)]" />
							</Link>
						</li>
					);
				})}
			</ul>
		</section>
	);
}

function RedirectToSignIn() {
	const navigate = useNavigate();

	useEffect(() => {
		navigate({ to: authConfig.paths.signIn });
	}, [navigate]);

	return null;
}
