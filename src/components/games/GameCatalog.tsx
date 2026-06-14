import { getVisibleGames } from "#/lib/games/catalog";
import { GameCard } from "./GameCard";

export function GameCatalog() {
	return (
		<section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
			{getVisibleGames().map((game) => (
				<GameCard key={game.type} game={game} />
			))}
		</section>
	);
}
