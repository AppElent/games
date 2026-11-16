import { diceRules, type ScoresheetGame } from "@arcadeclub/core/dice/engine";
import type { ScoresheetView } from "@arcadeclub/core/dice/scoresheet";
import {
	diceSeatName,
	latestNews,
	standings,
	turnStep,
} from "@arcadeclub/core/dice/table-view";
import { seatIsSilent } from "@arcadeclub/core/table-engine";
import { Bot, MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { fmt, plural, useI18n, useMessages } from "#/lib/i18n";
import { useNow } from "#/lib/use-now";
import { DieFace } from "./Die";
import { DiceEnd } from "./End";
import { AutopilotNotice, DiceTableFrame, useSeatMenu } from "./TableParts";
import type { DiceTableBundle, DiceTableControls } from "./useDiceTable";

type Props = {
	game: ScoresheetGame;
	table: DiceTableBundle;
	view: ScoresheetView;
	controls: DiceTableControls;
};

/** A score-sheet game in play: the dice, the sheet, and the end of the game. */
export function ScoresheetTable({ game, table, view, controls }: Props) {
	const dice = useMessages().games.dice;
	return (
		<DiceTableFrame
			game={game}
			table={table}
			controls={controls}
			kicker={fmt(dice.table.round, {
				round: Math.min(view.round, view.rounds),
				rounds: view.rounds,
			})}
			news={latestNews({ dice, fmt }, table, view.events)}
			end={
				view.phase === "finished" ? (
					<DiceEnd
						table={table}
						winners={view.winners}
						rows={standings(view).map(({ seat, total }) => ({
							seat,
							value: total,
						}))}
						controls={controls}
					/>
				) : null
			}
		>
			<div className="dice-layout">
				<DiceTray table={table} view={view} controls={controls} />
				<ScoreSheet game={game} table={table} view={view} controls={controls} />
			</div>
		</DiceTableFrame>
	);
}

/** Whose turn, the dice, and the roll button. Holds stay on this device until the roll. */
function DiceTray({ table, view, controls }: Omit<Props, "game">) {
	const { locale } = useI18n();
	const dice = useMessages().games.dice;
	const you = table.you;
	const step = turnStep(view, you);
	const rollKey = `${view.round}:${view.turn}:${view.rollsUsed}`;
	const [held, setHeld] = useState(view.held);
	const [heldFor, setHeldFor] = useState(rollKey);
	// A new roll or a new turn starts from what the server says is held.
	if (heldFor !== rollKey) {
		setHeldFor(rollKey);
		setHeld(view.held);
	}

	const rollsLeft = view.rollsPerTurn - view.rollsUsed;
	const canRoll =
		(step === "start" || step === "hold") &&
		!controls.pending &&
		!(step === "hold" && held.every(Boolean));
	const mine = step === "start" || step === "hold" || step === "score";
	const turnName = diceSeatName(dice, table, view.turn);
	const hint =
		step === "start"
			? dice.table.startHint
			: step === "hold"
				? dice.table.holdHint
				: step === "score"
					? dice.table.scoreHint
					: null;

	return (
		<section
			className="cards-panel dice-tray"
			aria-label={dice.table.diceLabel}
		>
			<p className="dice-status" data-mine={mine} aria-live="polite">
				{view.phase === "finished"
					? null
					: mine
						? dice.table.yourTurn
						: fmt(dice.table.theirTurn, { name: turnName })}
			</p>
			{hint ? <p className="dice-hint">{hint}</p> : null}
			{view.rollsUsed === 0 ? (
				<p className="dice-empty">{dice.table.noDice}</p>
			) : (
				<ul className="dice-row">
					{view.dice.map((value, index) => {
						const label = fmt(dice.table.die, { index: index + 1, value });
						const isHeld = held[index] ?? false;
						const fresh = !view.held[index];
						return (
							// Rolled dice get a new key per roll, so they tumble again.
							<li key={fresh ? `${rollKey}-${index}` : `held-${index}`}>
								{step === "hold" ? (
									<button
										type="button"
										className="die"
										data-fresh={fresh}
										aria-pressed={isHeld}
										aria-label={label}
										disabled={controls.pending}
										onClick={() =>
											setHeld((current) =>
												current.map((on, at) => (at === index ? !on : on)),
											)
										}
									>
										<DieFace value={value} />
										<span className="die-tag" aria-hidden="true">
											{isHeld ? dice.table.heldLabel : ""}
										</span>
									</button>
								) : (
									<span
										className="die"
										role="img"
										data-fresh={fresh}
										data-held={view.held[index]}
										aria-label={
											view.held[index] ? `${label}, ${dice.table.held}` : label
										}
									>
										<DieFace value={value} />
										<span className="die-tag" aria-hidden="true" />
									</span>
								)}
							</li>
						);
					})}
				</ul>
			)}
			{mine ? (
				<div className="dice-actions">
					<button
						type="button"
						className="btn-gold min-h-12 text-lg"
						disabled={!canRoll}
						onClick={() =>
							controls.act({
								type: "roll",
								keep:
									step === "hold"
										? held.flatMap((on, index) => (on ? [index] : []))
										: [],
							})
						}
					>
						{view.rollsUsed === 0 ? dice.table.roll : dice.table.rollAgain}
					</button>
					<p className="text-sm text-[var(--ivory-muted)]">
						{rollsLeft > 0
							? plural(locale, rollsLeft, dice.table.rollsLeft)
							: dice.table.noRollsLeft}
					</p>
				</div>
			) : null}
			<AutopilotNotice table={table} controls={controls} />
		</section>
	);
}

/** Every player's sheet side by side; your open boxes offer what the dice would score. */
function ScoreSheet({ game, table, view, controls }: Props) {
	const dice = useMessages().games.dice;
	const now = useNow(15_000);
	const menu = useSeatMenu(table, controls, now);
	const rules = diceRules(game, table.options);
	const you = table.you;
	const step = turnStep(view, you);
	const choosing = step === "hold" || step === "score";
	const seats = view.sheets.map((_, seat) => seat);
	const name = (seat: number) => diceSeatName(dice, table, seat);
	const upper = view.sheet.filter((entry) => entry.section === "upper");
	const lower = view.sheet.filter((entry) => entry.section === "lower");

	const row = (entry: (typeof view.sheet)[number]) => {
		const category = dice.categories[entry.id];
		return (
			<tr key={entry.id}>
				<th scope="row">{category}</th>
				{seats.map((seat) => {
					const points = view.sheets[seat].scores[entry.id];
					const option =
						choosing && seat === you
							? view.options.find((choice) => choice.category === entry.id)
							: undefined;
					return (
						<td key={seat} data-active={view.turn === seat}>
							{points !== undefined ? (
								points
							) : option ? (
								<button
									type="button"
									className="score-option"
									data-zero={option.points === 0}
									aria-label={fmt(dice.table.scoreFor, {
										points: option.points,
										category,
									})}
									disabled={controls.pending}
									onClick={() =>
										controls.act({ type: "score", category: entry.id })
									}
								>
									{option.points}
								</button>
							) : (
								<span className="sr-only">{dice.table.empty}</span>
							)}
						</td>
					);
				})}
			</tr>
		);
	};

	const totals = (
		label: string,
		value: (seat: number) => React.ReactNode,
		strong = false,
	) => (
		<tr data-total={strong}>
			<th scope="row">{label}</th>
			{seats.map((seat) => (
				<td key={seat} data-active={view.turn === seat}>
					{value(seat)}
				</td>
			))}
		</tr>
	);

	return (
		<section className="cards-panel score-sheet">
			<div className="score-scroll">
				<table>
					<caption className="sr-only">{dice.table.sheetCaption}</caption>
					<thead>
						<tr>
							<th scope="col">{dice.table.category}</th>
							{seats.map((seat) => {
								const entry = table.seats[seat];
								const human = entry.botIndex === null;
								const silent = seatIsSilent(entry, now);
								return (
									<th
										key={seat}
										scope="col"
										data-active={view.turn === seat}
										aria-current={view.turn === seat ? "true" : undefined}
									>
										<span className="score-name">
											{entry.autopilot && human ? (
												<Bot className="h-3.5 w-3.5" aria-hidden="true" />
											) : null}
											{name(seat)}
										</span>
										{silent ? (
											<span className="score-note">{dice.table.offline}</span>
										) : null}
										{menu.canManage(seat) ? (
											<button
												type="button"
												className="score-manage"
												aria-label={fmt(dice.table.seatMenu, {
													name: name(seat),
												})}
												onClick={() => menu.open(seat)}
											>
												<MoreHorizontal className="h-4 w-4" />
											</button>
										) : null}
									</th>
								);
							})}
						</tr>
					</thead>
					<tbody>{upper.map(row)}</tbody>
					<tbody data-section="subtotal">
						{totals(dice.table.upperSum, (seat) => (
							<>
								{view.sheets[seat].upper}
								<span className="score-progress">
									{fmt(dice.table.bonusProgress, {
										have: view.sheets[seat].upper,
										needed: view.upperBonus.threshold,
									})}
								</span>
							</>
						))}
						{totals(dice.table.bonus, (seat) => view.sheets[seat].upperBonus)}
					</tbody>
					<tbody>{lower.map(row)}</tbody>
					<tfoot>
						{rules.extraAllSame
							? totals(dice.table.extra, (seat) => view.sheets[seat].extra)
							: null}
						{totals(dice.table.total, (seat) => view.sheets[seat].total, true)}
					</tfoot>
				</table>
			</div>
			{menu.sheet}
		</section>
	);
}
