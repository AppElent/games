import { createFileRoute } from "@tanstack/react-router";
import { type GameType, getGameByType } from "#/lib/games/catalog";
import { useGameLocalizer } from "#/lib/i18n/catalog";

export const Route = createFileRoute("/games/$gameType")({
	component: GameDetailPage,
});

function GameDetailPage() {
	const { gameType } = Route.useParams();
	const localize = useGameLocalizer();
	const base = getGameByType(gameType as GameType);
	const game = base ? localize(base) : undefined;

	if (!game) {
		return (
			<main className="club-wrap py-10 text-[var(--club-orange)]">
				Game not found.
			</main>
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
				<h1 className="club-title mb-4 text-4xl font-bold text-[var(--club-text)]">
					{game.title}
				</h1>
				<p className="text-lg leading-8 text-[var(--club-muted)]">
					{game.description}
				</p>
				<p className="mt-5 rounded-md border border-[var(--club-line)] bg-[var(--club-line)] p-4 text-sm text-[var(--club-muted)]">
					This game is on the Arcade Club shelf and will use the same live
					session system when it becomes playable.
				</p>
				<a
					href="/"
					className="mt-6 inline-flex rounded-md bg-[var(--club-text)] px-4 py-2 text-sm font-bold text-[color:var(--club-bg)] no-underline"
				>
					Back to games
				</a>
			</section>
		</main>
	);
}
