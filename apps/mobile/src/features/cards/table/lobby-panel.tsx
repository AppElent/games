/** The table before the deal: invite people, fill seats, and the host deals. */
import type { CardGame } from "@arcadeclub/core/cards/engine";
import { seatName } from "@arcadeclub/core/cards/table-view";
import { useState } from "react";
import { useI18n } from "../../../i18n";
import { TableLobby } from "../../table/table-lobby";
import { RulesSheet } from "../deck/rules-sheet";
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
	const optionText = text.options as Record<string, { label: string }>;

	return (
		<TableLobby
			name={text.name}
			players={game.players}
			table={table}
			controls={controls}
			words={cards.lobby}
			seatName={(seat) => seatName(cards, table, seat)}
			optionLabel={(id) => optionText[id]?.label}
			rulesButton={cards.setup.rulesButton}
			onRules={() => setRulesOpen(true)}
			rulesSheet={
				<RulesSheet
					game={game}
					options={table.options}
					open={rulesOpen}
					onClose={() => setRulesOpen(false)}
				/>
			}
			testPrefix="cards"
		/>
	);
}
