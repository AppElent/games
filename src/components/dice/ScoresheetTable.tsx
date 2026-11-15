import { type DiceGame, diceRules } from "@arcadeclub/core/dice/engine";
import type { ScoresheetView } from "@arcadeclub/core/dice/scoresheet";
import {
	diceSeatName,
	latestNews,
	standings,
	turnStep,
} from "@arcadeclub/core/dice/table-view";
import { buildInviteUrl } from "@arcadeclub/core/sessions";
import { seatIsSilent } from "@arcadeclub/core/table-engine";
import { Link } from "@tanstack/react-router";
import { Bot, MoreHorizontal, ScrollText } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Sheet } from "#/components/table/Chrome";
import { fmt, plural, useI18n, useMessages } from "#/lib/i18n";
import { useNow } from "#/lib/use-now";
import { DicePage } from "./Chrome";
import { DieFace } from "./Die";
import { DiceRulesSheet } from "./RulesSheet";
import type { DiceTableBundle, DiceTableControls } from "./useDiceTable";

type Props = {
	game: DiceGame;
	table: DiceTableBundle;
	view: ScoresheetView;
	controls: DiceTableControls;
};

/** A score-sheet game in play: the dice, the sheet, and the end of the game. */
export function ScoresheetTable({ game, table, view, controls }: Props) {
	const dice = useMessages().games.dice;
	const text = dice.games[game.id];
	const [rulesOpen, setRulesOpen] = useState(false);
	const news = latestNews({ dice, fmt }, table, view.events);
	const you = table.you;

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
			<div className="dice-top">
				<div className="min-w-0">
					<p className="cards-kicker">
						{fmt(dice.table.round, {
							round: Math.min(view.round, view.rounds),
							rounds: view.rounds,
						})}
					</p>
					<h1 className="cards-title text-3xl">{text.name}</h1>
				</div>
				<button
					type="button"
					className="icon-chip"
					aria-label={dice.table.rules}
					onClick={() => setRulesOpen(true)}
				>
					<ScrollText className="h-4 w-4" aria-hidden="true" />
					<span>{dice.table.rules}</span>
				</button>
			</div>
			{you === null ? (
				<p className="dice-note">
					{dice.table.spectating}
					{table.session.joinCode ? (
						<>
							{" · "}
							<a href={buildInviteUrl("", { code: table.session.joinCode })}>
								{dice.table.rejoin}
							</a>
						</>
					) : null}
				</p>
			) : null}
			<div className="dice-layout">
				<DiceTray table={table} view={view} controls={controls} />
				<ScoreSheet game={game} table={table} view={view} controls={controls} />
			</div>
			<p className="sr-only" aria-live="polite">
				{news ? <span key={news.seq}>{news.text}</span> : null}
			</p>
			{controls.error ? (
				<p className="dice-error" role="alert">
					{controls.error}
				</p>
			) : null}
			{view.phase === "finished" ? (
				<DiceEnd table={table} view={view} controls={controls} />
			) : null}
			<DiceRulesSheet
				game={game}
				options={table.options}
				open={rulesOpen}
				onClose={() => setRulesOpen(false)}
			/>
		</DicePage>
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
	const autopilot = you !== null && table.seats[you]?.autopilot;

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
			{autopilot && you !== null ? (
				<div className="dice-actions">
					<p className="text-sm">{dice.table.autopilotActive}</p>
					<button
						type="button"
						className="btn-gold"
						onClick={() => controls.setAutopilot(you, false)}
					>
						{dice.table.autopilotBack}
					</button>
				</div>
			) : null}
		</section>
	);
}

/** Every player's sheet side by side; your open boxes offer what the dice would score. */
function ScoreSheet({ game, table, view, controls }: Props) {
	const dice = useMessages().games.dice;
	const now = useNow(15_000);
	const [menuSeat, setMenuSeat] = useState<number | null>(null);
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
								const canManage =
									you !== null &&
									seat !== you &&
									human &&
									!entry.autopilot &&
									(table.isHost || silent);
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
										{canManage ? (
											<button
												type="button"
												className="score-manage"
												aria-label={fmt(dice.table.seatMenu, {
													name: name(seat),
												})}
												onClick={() => setMenuSeat(seat)}
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
			<Sheet
				open={menuSeat !== null}
				title={
					menuSeat === null
						? ""
						: fmt(dice.table.seatMenu, { name: name(menuSeat) })
				}
				onClose={() => setMenuSeat(null)}
			>
				{menuSeat === null ? null : (
					<button
						type="button"
						className="btn-gold w-full"
						onClick={() => {
							controls.setAutopilot(menuSeat, true);
							setMenuSeat(null);
						}}
					>
						{fmt(dice.table.autopilotOn, { name: name(menuSeat) })}
					</button>
				)}
			</Sheet>
		</section>
	);
}

/** The final sheet: who won, everyone's total, and what next. */
function DiceEnd({ table, view, controls }: Omit<Props, "game">) {
	const dice = useMessages().games.dice;
	const dialog = useRef<HTMLDialogElement>(null);
	const heading = useRef<HTMLHeadingElement>(null);
	const you = table.you;
	const title =
		view.winners.length > 1
			? dice.table.tie
			: view.winners[0] === you
				? dice.table.youWin
				: fmt(dice.table.winner, {
						name: diceSeatName(dice, table, view.winners[0]),
					});

	// Modal, so nothing on the table behind it can be reached.
	useEffect(() => {
		dialog.current?.showModal();
		heading.current?.focus();
	}, []);

	return (
		<dialog
			ref={dialog}
			className="end-backdrop"
			aria-labelledby="dice-end"
			onCancel={(event) => event.preventDefault()}
			// Browsers can close a dialog despite the cancelled event above.
			onClose={() => dialog.current?.showModal()}
		>
			<section className="cards-panel end-panel" aria-labelledby="dice-end">
				<h2
					id="dice-end"
					ref={heading}
					tabIndex={-1}
					className="cards-title text-3xl outline-none"
				>
					{title}
				</h2>
				<h3 className="cards-kicker mt-4 mb-2">{dice.table.standings}</h3>
				<ol className="dice-standings">
					{standings(view).map(({ seat, total }) => (
						<li key={seat} data-winner={view.winners.includes(seat)}>
							<span className="min-w-0 flex-1 truncate">
								{diceSeatName(dice, table, seat)}
							</span>
							<span className="font-bold">{total}</span>
						</li>
					))}
				</ol>
				<div className="end-actions mt-2 flex flex-wrap items-center justify-center gap-2">
					{you !== null ? (
						<button
							type="button"
							className="btn-gold"
							disabled={controls.pending}
							onClick={controls.rematch}
						>
							{dice.table.playAgain}
						</button>
					) : (
						<p className="w-full text-sm text-[var(--ivory-muted)]">
							{dice.table.waitingRematch}
						</p>
					)}
					<Link to="/dice" className="btn-ghost">
						{dice.table.newGame}
					</Link>
				</div>
			</section>
		</dialog>
	);
}
