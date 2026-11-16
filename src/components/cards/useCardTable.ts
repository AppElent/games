import {
	type TableBundle,
	type TableGameControls,
	useTableGame,
} from "#/lib/games/use-table-game";
import { useMessages } from "#/lib/i18n";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export type CardTableBundle = TableBundle<typeof api.cardGames>;

/** This device's view of a card table: the seat it holds, live state, and every move it can make. */
export function useCardTable(sessionId: Id<"gameSessions">) {
	const cards = useMessages().games.cards;
	return useTableGame(api.cardGames, sessionId, {
		seatError: cards.lobby.seatError,
		couldNotChange: cards.lobby.couldNotChange,
		couldNotStart: cards.lobby.couldNotStart,
		actionFailed: cards.table.actionFailed,
	});
}

export type CardTableControls = TableGameControls<typeof api.cardGames>;
