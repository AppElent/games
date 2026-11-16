import type { PushluckGame } from "@arcadeclub/core/dice/engine";
import type { PushluckView } from "@arcadeclub/core/dice/pushluck";
import {
	diceSeatName,
	lastBust,
	latestNews,
	pushluckPick,
	pushluckStep,
	standings,
} from "@arcadeclub/core/dice/table-view";
import { Bot, Flag, MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { fmt, plural, useI18n, useMessages } from "#/lib/i18n";
import { useNow } from "#/lib/use-now";
import { DicePage } from "./Chrome";
import { DieFace } from "./Die";
import { DiceEnd } from "./End";
import { DiceRulesSheet } from "./RulesSheet";
import {
	AutopilotNote,
	DiceTableTop,
	SeatMenu,
	SpectatorNote,
	seatManagement,
} from "./TableParts";
import type { DiceTableBundle, DiceTableControls } from "./useDiceTable";

type Props = {
	table: DiceTableBundle;
	view: PushluckView;
	controls: DiceTableControls;
};

/** A push-your-luck game in play: the dice, what is set aside, the scores, and the end. */
export function PushluckTable({
	game,
	table,
	view,
	controls,
}: Props & { game: PushluckGame }) {
	const { locale } = useI18n();
	const dice = useMessages().games.dice;
	const words = dice.pushluck.table;
	const text = dice.games[game.id];
	const [rulesOpen, setRulesOpen] = useState(false);
	const news = latestNews({ dice, fmt, locale }, table, view.events);
	const num = (value: number) => value.toLocaleString(locale);

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
			<DiceTableTop
				kicker={`${fmt(words.round, { round: view.round })} · ${fmt(
					words.target,
					{ target: num(view.rules.target) },
				)}`}
				name={text.name}
				onRules={() => setRulesOpen(true)}
			/>
			<SpectatorNote table={table} />
			{view.finalRoundBy !== null && view.phase === "playing" ? (
				<p className="push-final" role="status">
					<Flag className="h-4 w-4 shrink-0" aria-hidden="true" />
					{fmt(words.finalRound, {
						name: diceSeatName(dice, table, view.finalRoundBy),
					})}
				</p>
			) : null}
			<div className="dice-layout">
				<PushTray table={table} view={view} controls={controls} />
				<Scoreboard table={table} view={view} controls={controls} />
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
				<DiceEnd
					table={table}
					winners={view.winners}
					rows={standings(view).map(({ seat, total }) => ({
						seat,
						value: total.toLocaleString(locale),
					}))}
					controls={controls}
				/>
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

/**
 * Whose turn, the dice just rolled, what is set aside, and the roll and bank
 * buttons. Picks stay on this device until the player rolls or banks.
 */
function PushTray({ table, view, controls }: Props) {
	const { locale } = useI18n();
	const dice = useMessages().games.dice;
	const words = dice.pushluck.table;
	const num = (value: number) => value.toLocaleString(locale);
	const step = pushluckStep(view, table.you);
	const rollKey = String(view.events.at(-1)?.seq ?? -1);
	const [picked, setPicked] = useState<boolean[]>([]);
	const [pickedFor, setPickedFor] = useState(rollKey);
	// Every roll starts with nothing picked.
	if (pickedFor !== rollKey) {
		setPickedFor(rollKey);
		setPicked([]);
	}
	const pick = pushluckPick(view, picked);
	const mine = step === "start" || step === "pick";
	const bust = lastBust(view);
	const problem =
		step === "pick" && pick.problem
			? pick.problem === "needOpening"
				? fmt(words.needOpening, { needed: num(view.rules.openingScore) })
				: words[pick.problem]
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
						: fmt(dice.table.theirTurn, {
								name: diceSeatName(dice, table, view.turn),
							})}
			</p>
			{step === "start" ? (
				<p className="dice-hint">
					{fmt(words.startHint, { count: view.rules.dice })}
				</p>
			) : step === "pick" ? (
				<p className="dice-hint">{words.pickHint}</p>
			) : null}
			<div className="push-total">
				<span className="cards-kicker">{words.turnTotal}</span>
				<span className="push-points">{num(view.turnTotal)}</span>
				{step === "pick" && pick.points !== null ? (
					<span className="push-selected">
						{fmt(words.selected, { points: num(pick.points) })}
					</span>
				) : null}
			</div>
			{view.dice.length > 0 ? (
				<ul className="dice-row push-row">
					{view.dice.map((value, index) => {
						const label = fmt(dice.table.die, { index: index + 1, value });
						const on = picked[index] ?? false;
						return (
							// Each roll gets new keys, so the dice tumble again.
							// biome-ignore lint/suspicious/noArrayIndexKey: see above
							<li key={`${rollKey}-${index}`}>
								{step === "pick" ? (
									<button
										type="button"
										className="die"
										data-fresh="true"
										aria-pressed={on}
										aria-label={label}
										disabled={controls.pending}
										onClick={() =>
											setPicked((current) => {
												const next = view.dice.map(
													(_, at) => current[at] ?? false,
												);
												next[index] = !next[index];
												return next;
											})
										}
									>
										<DieFace value={value} />
										<span className="die-tag" aria-hidden="true">
											{on ? words.pickTag : ""}
										</span>
									</button>
								) : (
									<span
										className="die"
										role="img"
										data-fresh="true"
										aria-label={label}
									>
										<DieFace value={value} />
										<span className="die-tag" aria-hidden="true" />
									</span>
								)}
							</li>
						);
					})}
				</ul>
			) : bust ? (
				<div className="push-bust">
					<ul
						className="dice-row push-row"
						aria-label={`${words.bust} ${bust.dice.join(", ")}`}
					>
						{bust.dice.map((value, index) => (
							// A bust roll never changes, so its order is its identity.
							// biome-ignore lint/suspicious/noArrayIndexKey: see above
							<li key={index} className="die" data-bust="true">
								<DieFace value={value} />
							</li>
						))}
					</ul>
					<p className="push-bust-tag" aria-hidden="true">
						{words.bust}
					</p>
					<p className="dice-hint">
						{latestNews({ dice, fmt, locale }, table, view.events)?.text}
					</p>
				</div>
			) : (
				<p className="dice-empty push-row">{dice.table.noDice}</p>
			)}
			<div className="push-aside">
				<p className="cards-kicker">{words.setAsideLabel}</p>
				{view.setAside.length > 0 ? (
					<ul
						className="push-aside-dice"
						aria-label={`${words.setAsideLabel}: ${view.setAside.join(", ")}`}
					>
						{view.setAside.map((value, index) => (
							// Set-aside dice only grow during a turn, so their order is their identity.
							// biome-ignore lint/suspicious/noArrayIndexKey: see above
							<li key={index}>
								<DieFace value={value} />
							</li>
						))}
					</ul>
				) : (
					<p className="text-sm text-[var(--ivory-muted)]">
						{words.nothingSetAside}
					</p>
				)}
			</div>
			{mine ? (
				<div className="dice-actions">
					{step === "start" ? (
						<button
							type="button"
							className="btn-gold min-h-12 text-lg"
							disabled={controls.pending}
							onClick={() => controls.act({ type: "roll", keep: [] })}
						>
							{words.roll}
						</button>
					) : (
						<>
							<div className="push-buttons">
								<button
									type="button"
									className="btn-gold min-h-12 text-lg"
									disabled={!pick.canRoll || controls.pending}
									onClick={() =>
										controls.act({ type: "roll", keep: pick.keep })
									}
								>
									{pick.hotDice
										? fmt(words.hotDice, { count: pick.rollCount })
										: plural(locale, pick.rollCount, words.rollRest)}
								</button>
								<button
									type="button"
									className="btn-ghost min-h-12 text-lg"
									disabled={!pick.canBank || controls.pending}
									onClick={() =>
										controls.act({ type: "bank", keep: pick.keep })
									}
								>
									{fmt(words.bank, { points: num(pick.total) })}
								</button>
							</div>
							<p className="push-problem" aria-live="polite">
								{problem}
							</p>
						</>
					)}
				</div>
			) : null}
			<AutopilotNote table={table} controls={controls} />
		</section>
	);
}

/** Everyone's banked score against the target; the player rolling now shows the turn at stake. */
function Scoreboard({ table, view, controls }: Props) {
	const { locale } = useI18n();
	const dice = useMessages().games.dice;
	const words = dice.pushluck.table;
	const now = useNow(15_000);
	const [menuSeat, setMenuSeat] = useState<number | null>(null);
	const num = (value: number) => value.toLocaleString(locale);
	const target = view.rules.target;

	return (
		<section className="cards-panel push-board" aria-labelledby="push-board">
			<h2 id="push-board" className="cards-kicker">
				{words.scoreboard}
			</h2>
			<ol>
				{view.scores.map((score, seat) => {
					const entry = table.seats[seat];
					const name = diceSeatName(dice, table, seat);
					const { human, silent, canManage } = seatManagement(table, seat, now);
					const active = view.phase === "playing" && view.turn === seat;
					return (
						<li
							// Seats never move during a game.
							// biome-ignore lint/suspicious/noArrayIndexKey: see above
							key={seat}
							data-active={active}
							aria-current={active ? "true" : undefined}
						>
							<div className="push-seat">
								<span className="push-name" aria-hidden="true">
									{entry.autopilot && human ? (
										<Bot className="h-3.5 w-3.5" aria-hidden="true" />
									) : null}
									{view.finalRoundBy === seat ? (
										<Flag className="h-3.5 w-3.5" aria-hidden="true" />
									) : null}
									<span className="truncate">{name}</span>
								</span>
								<span className="push-score" aria-hidden="true">
									{num(score)}
								</span>
								<span className="sr-only">
									{fmt(words.scoreLabel, {
										name,
										score: num(score),
										target: num(target),
									})}
								</span>
								{canManage ? (
									<button
										type="button"
										className="score-manage"
										aria-label={fmt(dice.table.seatMenu, { name })}
										onClick={() => setMenuSeat(seat)}
									>
										<MoreHorizontal className="h-4 w-4" />
									</button>
								) : null}
							</div>
							<div className="push-bar" aria-hidden="true">
								<span
									style={{
										width: `${Math.min(100, (score / target) * 100)}%`,
									}}
								/>
							</div>
							<p className="push-seat-note">
								{active && view.turnTotal > 0
									? fmt(words.selected, { points: num(view.turnTotal) })
									: score === 0 && view.rules.openingScore > 0
										? words.notOnBoard
										: null}
								{silent ? ` ${dice.table.offline}` : null}
							</p>
						</li>
					);
				})}
			</ol>
			<SeatMenu
				table={table}
				seat={menuSeat}
				controls={controls}
				onClose={() => setMenuSeat(null)}
			/>
		</section>
	);
}
