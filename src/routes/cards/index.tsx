import { CARD_GAME_IDS, CARD_GAMES } from "@arcadeclub/core/cards/engine";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import type { CSSProperties } from "react";
import { CardsPage } from "#/components/cards/Chrome";
import { PlayingCard } from "#/components/cards/PlayingCard";
import { fmt, useMessages } from "#/lib/i18n";

export const Route = createFileRoute("/cards/")({
	component: CardsHubPage,
	staticData: { fullscreen: true },
});

/** Lists whatever the registry holds: a new game shows up here by itself. */
function CardsHubPage() {
	const cards = useMessages().games.cards;
	return (
		<CardsPage
			title={cards.hub.kicker}
			felt="midnight"
			crumbs={[{ label: cards.hub.kicker }]}
		>
			<p className="cards-kicker mb-1">{cards.hub.kicker}</p>
			<h1 className="cards-title mb-2 text-4xl sm:text-5xl">
				{cards.hub.heading}
			</h1>
			<p className="mb-6 max-w-xl text-[var(--ivory-muted)]">
				{cards.hub.body}
			</p>
			<ul className="grid gap-4 md:grid-cols-2">
				{CARD_GAME_IDS.map((id) => {
					const game = CARD_GAMES[id];
					const text = cards.games[id];
					return (
						<li key={id}>
							<Link
								to="/cards/$gameId"
								params={{ gameId: id }}
								className="game-tile"
								data-felt={game.felt}
							>
								<h2 className="cards-title text-3xl">{text.name}</h2>
								<p className="cards-kicker">{text.tagline}</p>
								<p className="mt-1 text-sm leading-snug text-[var(--ivory-muted)]">
									{text.blurb}
								</p>
								<p className="tile-foot">
									{fmt(cards.hub.players, game.players)}
									<ArrowRight className="h-4 w-4" aria-hidden="true" />
								</p>
								<span
									className="tile-fan"
									aria-hidden="true"
									style={
										{ "--mid": (game.showcase.length - 1) / 2 } as CSSProperties
									}
								>
									{game.showcase.map((card, index) => (
										<span
											key={card}
											className="contents"
											style={{ "--i": index } as CSSProperties}
										>
											<PlayingCard card={card} />
										</span>
									))}
								</span>
							</Link>
						</li>
					);
				})}
			</ul>
			<div className="cards-panel mt-5 flex flex-wrap items-center gap-3 p-4">
				<p className="min-w-0 flex-1 font-semibold">{cards.hub.haveCode}</p>
				<Link to="/join" className="btn-ghost">
					{cards.hub.joinWithCode}
				</Link>
			</div>
		</CardsPage>
	);
}
