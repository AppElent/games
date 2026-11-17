import type { CardGame } from "@arcadeclub/core/cards/engine";
import { houseRuleLabel, seatName } from "@arcadeclub/core/cards/table-view";
import { useState } from "react";
import { TableLobby } from "#/components/table/Lobby";
import { useMessages } from "#/lib/i18n";
import { CardsPage } from "./Chrome";
import { RulesSheet } from "./RulesSheet";
import type { CardTableBundle, CardTableControls } from "./useCardTable";
import { useCardWords } from "./useCardWords";

/** The table before the deal: invite people, fill seats, and the host deals. */
export function Lobby({
	game,
	table,
	controls,
}: {
	game: CardGame;
	table: CardTableBundle;
	controls: CardTableControls;
}) {
	const cards = useMessages().games.cards;
	const text = cards.games[game.id];
	const [rulesOpen, setRulesOpen] = useState(false);
	const words = useCardWords();

	return (
		<CardsPage
			title={text.name}
			felt={game.felt}
			crumbs={[
				{ label: cards.hub.kicker, to: "/cards" },
				{ label: text.name, to: "/cards/$gameId", params: { gameId: game.id } },
				{ label: cards.table.crumb },
			]}
		>
			<TableLobby
				name={text.name}
				players={game.players}
				table={table}
				controls={controls}
				words={cards.lobby}
				seatName={(seat) => seatName(cards, table, seat)}
				optionLabel={(id) =>
					houseRuleLabel(words, game, id, table.seats.length)
				}
				rulesButton={cards.setup.rulesButton}
				onRules={() => setRulesOpen(true)}
			/>
			<RulesSheet
				game={game}
				options={table.options}
				seats={table.seats.length}
				open={rulesOpen}
				onClose={() => setRulesOpen(false)}
			/>
		</CardsPage>
	);
}
