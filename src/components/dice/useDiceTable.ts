import {
	type TableBundle,
	type TableGameControls,
	useTableGame,
} from "#/lib/games/use-table-game";
import { useMessages } from "#/lib/i18n";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export type DiceTableBundle = TableBundle<typeof api.diceGames>;

/** This device's view of a dice table: the seat it holds, live state, and every move it can make. */
export function useDiceTable(sessionId: Id<"gameSessions">) {
	const dice = useMessages().games.dice;
	return useTableGame(api.diceGames, sessionId, {
		seatError: dice.lobby.seatError,
		couldNotChange: dice.lobby.couldNotChange,
		couldNotStart: dice.lobby.couldNotStart,
		actionFailed: dice.table.actionFailed,
	});
}

export type DiceTableControls = TableGameControls<typeof api.diceGames>;
