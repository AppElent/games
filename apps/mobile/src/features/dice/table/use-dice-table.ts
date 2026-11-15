/** This phone's view of a dice table; see `useTableGame`. */
import { api } from "../../../convex/api";
import { useI18n } from "../../../i18n";
import {
	type TableBundle,
	type TableGameControls,
	useTableGame,
} from "../../table/use-table-game";

export type DiceTableBundle = TableBundle<typeof api.diceGames>;

export function useDiceTable(sessionId: string) {
	const dice = useI18n().t.games.dice;
	return useTableGame(api.diceGames, sessionId, {
		seatError: dice.lobby.seatError,
		couldNotChange: dice.lobby.couldNotChange,
		couldNotStart: dice.lobby.couldNotStart,
		actionFailed: dice.table.actionFailed,
	});
}

export type DiceTableControls = TableGameControls<typeof api.diceGames>;
