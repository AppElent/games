import type { CSSProperties } from "react";
import type { LocalizedGame } from "#/lib/games/catalog";

export function GameCard({ game }: { game: LocalizedGame }) {
	const Icon = game.icon;
	return (
		<a
			href={game.route}
			className="club-catalog-card"
			style={{ "--game-hue": `var(--club-${game.accent})` } as CSSProperties}
		>
			<div className="club-card-heading">
				<span className="club-game-icon">
					<Icon className="h-6 w-6" />
				</span>
				<div>
					<h2 className="club-title text-lg font-bold sm:text-xl">
						{game.title}
					</h2>
					<p className="mt-0.5 text-sm font-semibold text-[var(--club-muted)]">
						{game.tagline}
					</p>
				</div>
			</div>
			<p className="mt-2.5 text-sm leading-[22px] text-[var(--club-muted)]">
				{game.description}
			</p>
			<div className="mt-auto flex items-center justify-between gap-3 pt-4">
				<span className="rounded-full border border-[var(--club-line)] px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-[var(--club-muted)]">
					{game.stats}
				</span>
				<span className="text-right text-sm font-bold">
					{game.primaryAction} <span aria-hidden="true">›</span>
				</span>
			</div>
		</a>
	);
}
