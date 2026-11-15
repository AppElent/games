import {
	type CardGameId,
	generalOptions,
	getCardGame,
} from "@arcadeclub/core/cards/engine";
import { specialCards } from "@arcadeclub/core/cards/table-view";
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
import { CardsPage } from "./Chrome";
import { PlayingCard } from "./PlayingCard";
import { RulesSheet } from "./RulesSheet";
import { useCardWords } from "./useCardWords";

/** Picking how to play a card game, then opening its table. */
export function CardSetup({ gameId }: { gameId: CardGameId }) {
	const { locale } = useI18n();
	const cards = useMessages().games.cards;
	const game = getCardGame(gameId);
	const text = cards.games[gameId];
	const optionText = text.options as Record<
		string,
		{ label: string; hint: string }
	>;
	const [mode, setMode] = useState<TableMode>("computer");
	const [opponents, setOpponents] = useState(Math.min(game.players.max - 1, 3));
	const [options, setOptions] = useState<string[]>([]);
	const [rulesOpen, setRulesOpen] = useState(false);
	const words = useCardWords();
	const houseRules = generalOptions(game);
	const special = specialCards(words, game);
	const toggle = (id: string) =>
		setOptions((current) => toggleOption(current, id));
	const navigate = useNavigate();
	const table = useCreateTable("card-games", api.cardGames.createTable, (id) =>
		navigate({ to: "/cards/table/$sessionId", params: { sessionId: id } }),
	);
	const { busy, error } = table;
	const create = () =>
		table.create(
			{ gameId, title: text.name, mode, opponents, options },
			cards.setup.couldNotCreate,
		);

	const button = (
		<button
			type="button"
			className="btn-gold min-h-12 w-full text-lg"
			disabled={busy}
			onClick={create}
		>
			{busy
				? cards.setup.creating
				: mode === "computer"
					? cards.setup.playNow
					: cards.setup.openRoom}
		</button>
	);

	return (
		<CardsPage
			title={text.name}
			felt={game.felt}
			crumbs={[{ label: cards.hub.kicker, to: "/cards" }, { label: text.name }]}
		>
			<div className="mx-auto w-full max-w-xl">
				<p className="cards-kicker mb-1">{text.tagline}</p>
				<h1 className="cards-title mb-2 text-4xl sm:text-5xl">{text.name}</h1>
				<p className="mb-5 text-[var(--ivory-muted)]">{text.blurb}</p>
				<div className="cards-panel flex flex-col gap-5 p-5">
					<ModePicker mode={mode} onChange={setMode} words={cards.setup} />
					{mode === "computer" ? (
						<OpponentStepper
							value={opponents}
							min={game.players.min - 1}
							max={game.players.max - 1}
							label={plural(locale, opponents, cards.setup.opponents)}
							onChange={setOpponents}
							words={cards.setup}
						/>
					) : null}
					{special.length > 0 ? (
						<div>
							<h2 className="cards-kicker mb-1">{cards.setup.specialCards}</h2>
							<p className="mb-1 text-xs leading-snug text-[var(--ivory-muted)]">
								{cards.setup.specialCardsHint}
							</p>
							<div
								className="divide-y divide-white/10"
								style={{ "--card-w": "2.25rem" } as React.CSSProperties}
							>
								{special.map((card) => {
									const plain = card.plainOption;
									const on = plain === null || !options.includes(plain);
									return (
										<button
											key={card.key}
											type="button"
											role="switch"
											aria-checked={on}
											aria-labelledby={`power-${card.key}`}
											aria-describedby={`power-${card.key}-effect`}
											disabled={plain === null}
											className="rule-switch"
											onClick={() => {
												if (plain !== null) toggle(plain);
											}}
										>
											<PlayingCard card={card.sample} />
											<span className="min-w-0">
												<span
													id={`power-${card.key}`}
													className="block font-semibold"
												>
													{card.name}
												</span>
												<span
													id={`power-${card.key}-effect`}
													className="block text-xs leading-snug text-[var(--ivory-muted)]"
												>
													{card.effect}
												</span>
											</span>
											<span className="rule-switch-track" aria-hidden="true" />
										</button>
									);
								})}
							</div>
						</div>
					) : null}
					<HouseRuleSwitches
						heading={cards.setup.houseRules}
						rules={houseRules.map((option) => ({
							id: option.id,
							...optionText[option.id],
						}))}
						chosen={options}
						onToggle={toggle}
					/>
					{error ? (
						<p role="alert" className="text-sm font-semibold text-orange-200">
							{error}
						</p>
					) : null}
					{mode === "computer" ? button : <HostGate>{button}</HostGate>}
					<button
						type="button"
						className="btn-ghost"
						onClick={() => setRulesOpen(true)}
					>
						{cards.setup.rulesButton}
					</button>
				</div>
				<RulesSheet
					game={game}
					options={options}
					open={rulesOpen}
					onClose={() => setRulesOpen(false)}
				/>
			</div>
		</CardsPage>
	);
}
