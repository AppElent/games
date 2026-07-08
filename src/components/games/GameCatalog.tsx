import { useLocalizedGames } from "#/lib/i18n/catalog";
import { GameCard } from "./GameCard";

export function GameCatalog() {
	const games = useLocalizedGames();
	return (
		<section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
			{games.map((game) => (
				<GameCard key={game.type} game={game} />
			))}
		</section>
	);
}
