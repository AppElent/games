import { DICE_GAME_IDS, DICE_GAMES } from "@arcadeclub/core/dice/engine";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import type { CSSProperties } from "react";
import { DicePage } from "#/components/dice/Chrome";
import { DieFace } from "#/components/dice/Die";
import { fmt, useMessages } from "#/lib/i18n";

export const Route = createFileRoute("/dice/")({
	component: DiceHubPage,
	staticData: { fullscreen: true },
});

/** Lists whatever the registry holds: a new game shows up here by itself. */
function DiceHubPage() {
	const dice = useMessages().games.dice;
	return (
		<DicePage
			title={dice.hub.kicker}
			felt="midnight"
			crumbs={[{ label: dice.hub.kicker }]}
		>
			<p className="cards-kicker mb-1">{dice.hub.kicker}</p>
			<h1 className="cards-title mb-2 text-4xl sm:text-5xl">
				{dice.hub.heading}
			</h1>
			<p className="mb-6 max-w-xl text-[var(--ivory-muted)]">{dice.hub.body}</p>
			<ul className="grid gap-4 md:grid-cols-2">
				{DICE_GAME_IDS.map((id) => {
					const game = DICE_GAMES[id];
					const text = dice.games[id];
					return (
						<li key={id}>
							<Link
								to="/dice/$gameId"
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
									{fmt(dice.hub.players, game.players)}
									<ArrowRight className="h-4 w-4" aria-hidden="true" />
								</p>
								<span className="tile-dice" aria-hidden="true">
									{game.showcase.map((value, index) => (
										<DieFace
											// The showcase is fixed, so its order is its identity.
											// biome-ignore lint/suspicious/noArrayIndexKey: see above
											key={index}
											value={value}
											style={{ "--i": index } as CSSProperties}
										/>
									))}
								</span>
							</Link>
						</li>
					);
				})}
			</ul>
			<div className="cards-panel mt-5 flex flex-wrap items-center gap-3 p-4">
				<p className="min-w-0 flex-1 font-semibold">{dice.hub.haveCode}</p>
				<Link to="/join" className="btn-ghost">
					{dice.hub.joinWithCode}
				</Link>
			</div>
		</DicePage>
	);
}
