import type { GameCatalogItem } from "#/lib/games/catalog";

export function GameCard({ game }: { game: GameCatalogItem }) {
	const Icon = game.icon;
	const disabled = game.availability !== "playable";

	return (
		<article className="club-panel group flex min-h-[260px] flex-col justify-between rounded-lg p-5">
			<div>
				<div
					className={`mb-5 flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br ${game.accent} text-slate-950 shadow-lg`}
				>
					<Icon className="h-6 w-6" />
				</div>
				<div className="mb-2 flex items-center justify-between gap-3">
					<h2 className="club-title text-xl font-bold text-white">
						{game.title}
					</h2>
					<span className="rounded-full border border-white/10 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-slate-300">
						{game.stats}
					</span>
				</div>
				<p className="mb-3 text-sm font-semibold text-cyan-200">
					{game.tagline}
				</p>
				<p className="text-sm leading-6 text-slate-300">{game.description}</p>
			</div>
			<a
				href={game.route}
				className={`mt-6 inline-flex items-center justify-center rounded-md px-4 py-2.5 text-sm font-bold no-underline ${
					disabled
						? "border border-white/10 bg-white/5 text-slate-400"
						: "bg-white text-slate-950 hover:-translate-y-0.5 hover:bg-cyan-100"
				}`}
			>
				{disabled ? "Coming soon" : game.primaryAction}
			</a>
		</article>
	);
}
