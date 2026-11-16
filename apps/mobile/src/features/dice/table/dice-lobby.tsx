/** The table before the first roll: invite people, fill seats, and the host starts. */
import type { DiceGame } from "@arcadeclub/core/dice/engine";
import { diceSeatName } from "@arcadeclub/core/dice/table-view";
import { useState } from "react";
import { useI18n } from "../../../i18n";
import { TableLobby } from "../../table/table-lobby";
import { DiceRulesSheet } from "../rules/dice-rules-sheet";
import type { DiceTableBundle, DiceTableControls } from "./use-dice-table";

export function DiceLobby({
	game,
	table,
	controls,
}: {
	game: DiceGame;
	table: DiceTableBundle;
	controls: DiceTableControls;
}) {
	const { t } = useI18n();
	const dice = t.games.dice;
	const text = dice.games[game.id];
	const [rulesOpen, setRulesOpen] = useState(false);
	const optionText = text.options as Record<string, { label: string }>;

	return (
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
			rulesSheet={
				<DiceRulesSheet
					game={game}
					options={table.options}
					open={rulesOpen}
					onClose={() => setRulesOpen(false)}
				/>
			}
			testPrefix="dice"
		/>
	);
}
