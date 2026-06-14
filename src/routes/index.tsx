import { createFileRoute } from "@tanstack/react-router";
import { GameCatalog } from "#/components/games/GameCatalog";
import { JoinGamePanel } from "#/components/games/JoinGamePanel";

export const Route = createFileRoute("/")({ component: HomePage });

function HomePage() {
	return (
		<main className="club-wrap pb-12 pt-10">
			<section className="grid gap-6 pb-8 lg:grid-cols-[1fr_360px] lg:items-end">
				<div>
					<p className="club-kicker mb-3">Arcade Club</p>
					<h1 className="club-title max-w-4xl text-5xl font-bold leading-none text-white sm:text-7xl">
						Start a room, share a link, play together.
					</h1>
					<p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
						Live quiz nights, direct board-game challenges, and a growing shelf
						of party games for the next call, classroom, or couch session.
					</p>
					<div className="mt-7 flex flex-wrap gap-3">
						<a
							href="/quiz/new"
							className="rounded-md bg-cyan-300 px-5 py-3 text-sm font-bold text-slate-950 no-underline hover:-translate-y-0.5 hover:bg-cyan-200"
						>
							Host quiz
						</a>
						<a
							href="/backgammon/new"
							className="rounded-md border border-white/15 bg-white/10 px-5 py-3 text-sm font-bold text-white no-underline hover:-translate-y-0.5 hover:bg-white/15"
						>
							Start backgammon
						</a>
					</div>
				</div>
				<JoinGamePanel />
			</section>
			<GameCatalog />
		</main>
	);
}
