import { createFileRoute } from "@tanstack/react-router";
import { type GameType, getGameByType } from "#/lib/games/catalog";

export const Route = createFileRoute("/games/$gameType")({
	component: GameDetailPage,
});

function GameDetailPage() {
	const { gameType } = Route.useParams();
	const game = getGameByType(gameType as GameType);

	if (!game) {
		return (
			<main className="club-wrap py-10 text-orange-200">Game not found.</main>
		);
	}

	const Icon = game.icon;
	return (
		<main className="club-wrap py-10">
			<section className="club-panel max-w-3xl rounded-lg p-6">
				<div
					className={`mb-5 flex h-14 w-14 items-center justify-center rounded-lg bg-gradient-to-br ${game.accent} text-slate-950`}
				>
					<Icon className="h-7 w-7" />
				</div>
				<p className="club-kicker mb-2">{game.tagline}</p>
				<h1 className="club-title mb-4 text-4xl font-bold text-white">
					{game.title}
				</h1>
				<p className="text-lg leading-8 text-slate-300">{game.description}</p>
				<p className="mt-5 rounded-md border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
					This game is on the Arcade Club shelf and will use the same live
					session system when it becomes playable.
				</p>
				<a
					href="/"
					className="mt-6 inline-flex rounded-md bg-white px-4 py-2 text-sm font-bold text-slate-950 no-underline"
				>
					Back to games
				</a>
			</section>
		</main>
	);
}
