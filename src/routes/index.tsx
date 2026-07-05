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
					<h1 className="club-title max-w-4xl text-5xl font-bold leading-none text-[var(--club-text)] sm:text-7xl">
						Start a room, share a link, play together.
					</h1>
					<p className="mt-5 max-w-2xl text-lg leading-8 text-[var(--club-muted)]">
						Live quiz nights, direct board-game challenges, and a growing shelf
						of party games for the next call, classroom, or couch session.
					</p>
				</div>
				<JoinGamePanel />
			</section>
			<GameCatalog />
		</main>
	);
}
