import type { LocalizedGame } from "#/lib/games/catalog";

export function GameCard({ game }: { game: LocalizedGame }) {
	const Icon = game.icon;

	return (
		<article className="club-panel group flex min-h-[260px] flex-col justify-between rounded-lg p-5">
			<div>
				<div
					className={`mb-5 flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br ${game.accent} text-slate-950 shadow-lg`}
				>
					<Icon className="h-6 w-6" />
				</div>
				<div className="mb-2 flex items-center justify-between gap-3">
					<h2 className="club-title text-xl font-bold text-[var(--club-text)]">
						{game.title}
					</h2>
					<span className="rounded-full border border-[var(--club-line)] px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-[var(--club-muted)]">
						{game.stats}
					</span>
				</div>
				<p className="mb-3 text-sm font-semibold text-[var(--club-cyan)]">
					{game.tagline}
				</p>
				<p className="text-sm leading-6 text-[var(--club-muted)]">
					{game.description}
				</p>
			</div>
			<a
				href={game.route}
				className="mt-6 inline-flex items-center justify-center rounded-md bg-[var(--club-text)] px-4 py-2.5 text-sm font-bold text-[color:var(--club-bg)] no-underline hover:-translate-y-0.5"
			>
				{game.primaryAction}
			</a>
		</article>
	);
}
