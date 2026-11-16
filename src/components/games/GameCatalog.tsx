import { getLocalizedGame, getVisibleGames } from "#/lib/games/catalog";
import { useMessages } from "#/lib/i18n";
import { GameCard } from "./GameCard";

export function GameCatalog() {
	const messages = useMessages();
	return (
		<section aria-labelledby="catalog-heading">
			<h2 id="catalog-heading" className="club-title mb-4 text-2xl font-bold">
				{messages.common.header.games}
			</h2>
			<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
				{getVisibleGames().map((game) => (
					<GameCard key={game.type} game={getLocalizedGame(game, messages)} />
				))}
			</div>
		</section>
	);
}
