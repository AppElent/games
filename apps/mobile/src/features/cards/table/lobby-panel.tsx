/** The table before the deal: invite people, fill seats, and the host deals. */
import type { CardGame } from "@arcadeclub/core/cards/engine";
import { houseRuleLabel, seatName } from "@arcadeclub/core/cards/table-view";
import { useState } from "react";
import { useI18n } from "../../../i18n";
import { TableLobby } from "../../table/table-lobby";
import { RulesSheet } from "../deck/rules-sheet";
import { useCardWords } from "../deck/use-card-words";
import type { CardTableBundle, CardTableControls } from "./use-card-table";

export function LobbyPanel({
	game,
	table,
	controls,
}: {
	game: CardGame;
	table: CardTableBundle;
	controls: CardTableControls;
}) {
	const { t } = useI18n();
	const cards = t.games.cards;
	const text = cards.games[game.id];
	const [rulesOpen, setRulesOpen] = useState(false);
	const words = useCardWords();

	return (
		<TableLobby
			name={text.name}
			players={game.players}
			table={table}
			controls={controls}
			words={cards.lobby}
			seatName={(seat) => seatName(cards, table, seat)}
			optionLabel={(id) => houseRuleLabel(words, game, id, table.seats.length)}
			rulesButton={cards.setup.rulesButton}
			onRules={() => setRulesOpen(true)}
			rulesSheet={
				<RulesSheet
					game={game}
					options={table.options}
					seats={table.seats.length}
					open={rulesOpen}
					onClose={() => setRulesOpen(false)}
				/>
			}
			testPrefix="cards"
		/>
	);
}
