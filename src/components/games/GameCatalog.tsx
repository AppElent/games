import { getLocalizedGame, getVisibleGames } from "#/lib/games/catalog";
import { useMessages } from "#/lib/i18n";
import { GameCard } from "./GameCard";

export function GameCatalog() {
	const messages = useMessages();
	return (
		<section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
			{getVisibleGames().map((game) => (
				<GameCard key={game.type} game={getLocalizedGame(game, messages)} />
			))}
		</section>
	);
}
