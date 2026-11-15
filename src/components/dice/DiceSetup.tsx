import { type DiceGameId, getDiceGame } from "@arcadeclub/core/dice/engine";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { HostGate } from "#/components/games/HostGate";
import {
	HouseRuleSwitches,
	ModePicker,
	OpponentStepper,
	toggleOption,
} from "#/components/table/Setup";
import { type TableMode, useCreateTable } from "#/lib/games/use-create-table";
import { plural, useI18n, useMessages } from "#/lib/i18n";
import { api } from "../../../convex/_generated/api";
import { DicePage } from "./Chrome";
import { DiceRulesSheet } from "./RulesSheet";

/** Picking how to play a dice game, then opening its table. */
export function DiceSetup({ gameId }: { gameId: DiceGameId }) {
	const { locale } = useI18n();
	const dice = useMessages().games.dice;
	const game = getDiceGame(gameId);
	const text = dice.games[gameId];
	const optionText = text.options as Record<
		string,
		{ label: string; hint: string }
	>;
	const [mode, setMode] = useState<TableMode>("computer");
	const [opponents, setOpponents] = useState(Math.min(game.players.max - 1, 1));
	const [options, setOptions] = useState<string[]>([]);
	const [rulesOpen, setRulesOpen] = useState(false);
	const navigate = useNavigate();
	const table = useCreateTable("dice-games", api.diceGames.createTable, (id) =>
		navigate({ to: "/dice/table/$sessionId", params: { sessionId: id } }),
	);
	const create = () =>
		table.create(
			{ gameId, title: text.name, mode, opponents, options },
			dice.setup.couldNotCreate,
		);

	const button = (
		<button
			type="button"
			className="btn-gold min-h-12 w-full text-lg"
			disabled={table.busy}
			onClick={create}
		>
			{table.busy
				? dice.setup.creating
				: mode === "computer"
					? dice.setup.playNow
					: dice.setup.openRoom}
		</button>
	);

	return (
		<DicePage
			title={text.name}
			felt={game.felt}
			crumbs={[{ label: dice.hub.kicker, to: "/dice" }, { label: text.name }]}
		>
			<div className="mx-auto w-full max-w-xl">
				<p className="cards-kicker mb-1">{text.tagline}</p>
				<h1 className="cards-title mb-2 text-4xl sm:text-5xl">{text.name}</h1>
				<p className="mb-5 text-[var(--ivory-muted)]">{text.blurb}</p>
				<div className="cards-panel flex flex-col gap-5 p-5">
					<ModePicker mode={mode} onChange={setMode} words={dice.setup} />
					{mode === "computer" ? (
						<OpponentStepper
							value={opponents}
							min={game.players.min - 1}
							max={game.players.max - 1}
							label={
								opponents === 0
									? dice.setup.solo
									: plural(locale, opponents, dice.setup.opponents)
							}
							onChange={setOpponents}
							words={dice.setup}
						/>
					) : null}
					<HouseRuleSwitches
						heading={dice.setup.houseRules}
						rules={game.options.map((option) => ({
							id: option.id,
							...optionText[option.id],
						}))}
						chosen={options}
						onToggle={(id) =>
							setOptions((current) => toggleOption(current, id))
						}
					/>
					{table.error ? (
						<p role="alert" className="text-sm font-semibold text-orange-200">
							{table.error}
						</p>
					) : null}
					{mode === "computer" ? button : <HostGate>{button}</HostGate>}
					<button
						type="button"
						className="btn-ghost"
						onClick={() => setRulesOpen(true)}
					>
						{dice.setup.rulesButton}
					</button>
				</div>
				<DiceRulesSheet
					game={game}
					options={options}
					open={rulesOpen}
					onClose={() => setRulesOpen(false)}
				/>
			</div>
		</DicePage>
	);
}
