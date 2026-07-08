import { useCallback } from "react";
import { type GameCatalogItem, getVisibleGames } from "#/lib/games/catalog";
import { useI18n } from "./index";

/**
 * Returns a function that overlays localized catalog text onto a catalog
 * item. A function (not a per-item hook) so callers can localize inside
 * list renders without violating hook rules.
 */
export function useGameLocalizer() {
	const { messages } = useI18n();
	return useCallback(
		(game: GameCatalogItem): GameCatalogItem => ({
			...game,
			...messages.catalog[game.type],
		}),
		[messages],
	);
}

export function useLocalizedGames(): GameCatalogItem[] {
	const localize = useGameLocalizer();
	return getVisibleGames().map(localize);
}
