/** This phone's view of a card table; see `useTableGame`. */
import { api } from "../../../convex/api";
import { useI18n } from "../../../i18n";
import {
	type TableBundle,
	type TableGameControls,
	useTableGame,
} from "../../table/use-table-game";

export type CardTableBundle = TableBundle<typeof api.cardGames>;

export function useCardTable(sessionId: string) {
	const cards = useI18n().t.games.cards;
	return useTableGame(api.cardGames, "card-games", sessionId, {
		seatError: cards.lobby.seatError,
		couldNotChange: cards.lobby.couldNotChange,
		couldNotStart: cards.lobby.couldNotStart,
		actionFailed: cards.table.actionFailed,
	});
}

export type CardTableControls = TableGameControls<typeof api.cardGames>;
