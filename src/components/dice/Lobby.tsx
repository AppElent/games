import type { DiceGame } from "@arcadeclub/core/dice/engine";
import { diceSeatName } from "@arcadeclub/core/dice/table-view";
import { useState } from "react";
import { TableLobby } from "#/components/table/Lobby";
import { useMessages } from "#/lib/i18n";
import { DicePage } from "./Chrome";
import { DiceRulesSheet } from "./RulesSheet";
import type { DiceTableBundle, DiceTableControls } from "./useDiceTable";

/** The table before the first roll: invite people, fill seats, and the host starts. */
export function DiceLobby({
	game,
	table,
	controls,
}: {
	game: DiceGame;
	table: DiceTableBundle;
	controls: DiceTableControls;
}) {
	const dice = useMessages().games.dice;
	const text = dice.games[game.id];
	const [rulesOpen, setRulesOpen] = useState(false);
	const optionText = text.options as Record<string, { label: string }>;

	return (
		<DicePage
			title={text.name}
			felt={game.felt}
			crumbs={[
				{ label: dice.hub.kicker, to: "/dice" },
				{ label: text.name, to: "/dice/$gameId", params: { gameId: game.id } },
				{ label: dice.table.crumb },
			]}
		>
			<TableLobby
				name={text.name}
				players={game.players}
				table={table}
				controls={controls}
				words={dice.lobby}
				seatName={(seat) => diceSeatName(dice, table, seat)}
				optionLabel={(id) => optionText[id]?.label}
				rulesButton={dice.setup.rulesButton}
				onRules={() => setRulesOpen(true)}
			/>
			<DiceRulesSheet
				game={game}
				options={table.options}
				open={rulesOpen}
				onClose={() => setRulesOpen(false)}
			/>
		</DicePage>
	);
}
