import type { MexenGame } from "@arcadeclub/core/dice/engine";
import type { MexenView } from "@arcadeclub/core/dice/mexen";
import {
	diceSeatName,
	latestNews,
	mexenStandings,
	mexenThrowLabel,
	mexenTurnStep,
} from "@arcadeclub/core/dice/table-view";
import { buildInviteUrl } from "@arcadeclub/core/sessions";
import { seatIsSilent } from "@arcadeclub/core/table-engine";
import { Bot, Heart, MoreHorizontal, ScrollText } from "lucide-react";
import { useState } from "react";
import { Sheet } from "#/components/table/Chrome";
import { fmt, plural, useI18n, useMessages } from "#/lib/i18n";
import { useNow } from "#/lib/use-now";
import { DicePage } from "./Chrome";
import { DieFace } from "./Die";
import { DiceEnd } from "./End";
import { DiceRulesSheet } from "./RulesSheet";
import type { DiceTableBundle, DiceTableControls } from "./useDiceTable";

type Props = {
	game: MexenGame;
	table: DiceTableBundle;
	view: MexenView;
	controls: DiceTableControls;
};

/** A Mexen game in play: the dice, every player's lives and kept throw, and the end. */
export function MexenTable({ game, table, view, controls }: Props) {
	const { locale } = useI18n();
	const dice = useMessages().games.dice;
	const text = dice.games[game.id];
	const [rulesOpen, setRulesOpen] = useState(false);
	const news = latestNews({ dice, fmt }, table, view.events);
	const you = table.you;
	const standingValue = (seat: number) =>
		view.scoring === "lives"
			? plural(locale, view.livesLeft[seat], dice.mexen.lives)
			: plural(locale, view.penalties[seat], dice.mexen.points);

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
						{fmt(dice.mexen.round, { round: view.round })}
						{view.throwOff ? ` · ${dice.mexen.throwOff}` : null}
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
				<MexenTray
					table={table}
					view={view}
					controls={controls}
					news={news?.text ?? null}
				/>
				<MexenSeats table={table} view={view} controls={controls} />
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
					rows={mexenStandings(view).map((seat) => ({
						seat,
						value: standingValue(seat),
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

/** Whose turn, the two dice, and the choice between keeping and throwing again. */
function MexenTray({
	table,
	view,
	controls,
	news,
}: Omit<Props, "game"> & { news: string | null }) {
	const { locale } = useI18n();
	const dice = useMessages().games.dice;
	const words = dice.mexen;
	const you = table.you;
	const step = mexenTurnStep(view, you);
	const mine = step === "start" || step === "decide";
	const name = (seat: number) => diceSeatName(dice, table, seat);
	const rollKey = `${view.round}:${view.turn}:${view.rollsUsed}`;
	const current = view.current
		? mexenThrowLabel(dice, fmt, view.current)
		: null;
	const isLeader = view.turn === view.leader && !view.throwOff;
	const hint =
		step === "start"
			? view.throwOff
				? words.throwOffHint
				: isLeader
					? fmt(words.leaderHint, { cap: view.throwCap })
					: plural(locale, view.throwCap, words.startHint)
			: step === "decide"
				? words.decideHint
				: null;
	const limit = view.throwOff
		? null
		: view.limitSet
			? plural(locale, view.throwCap, words.limit)
			: view.leader === you
				? words.yourLimitPending
				: fmt(words.limitPending, { name: name(view.leader) });
	const autopilot = you !== null && table.seats[you]?.autopilot;
	// Between throws the table is empty; show the throw kept last, so one
	// kept as it landed (the last allowed) is still seen.
	const kept =
		view.dice.length === 0 && view.lastKept && view.phase === "playing"
			? view.lastKept
			: null;
	const shown = kept ? kept.dice : view.dice;

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
						: fmt(words.theirTurn, { name: name(view.turn) })}
			</p>
			{hint ? <p className="dice-hint">{hint}</p> : null}
			{shown.length === 0 ? (
				<p className="dice-empty">{dice.table.noDice}</p>
			) : (
				<ul className="dice-row" data-kept={kept ? "true" : undefined}>
					{shown.map((value, index) => (
						// A new key per throw, so the dice tumble again.
						// biome-ignore lint/suspicious/noArrayIndexKey: two dice that never move
						<li key={`${rollKey}-${index}`}>
							<span
								className="die"
								role="img"
								data-fresh={kept ? undefined : "true"}
								aria-label={fmt(dice.table.die, { index: index + 1, value })}
							>
								<DieFace value={value} />
							</span>
						</li>
					))}
				</ul>
			)}
			{current ? (
				<p className="mexen-throw" data-kind={view.current?.kind}>
					{current}
				</p>
			) : kept ? (
				<p className="mexen-throw" data-kind={kept.kind}>
					{fmt(words.lastStand, {
						name: name(kept.seat),
						throw: mexenThrowLabel(dice, fmt, kept),
					})}
				</p>
			) : null}
			{view.rollsUsed > 0 ? (
				<p className="text-sm text-[var(--ivory-muted)]">
					{fmt(words.throwCount, {
						used: view.rollsUsed,
						cap: view.throwCap,
					})}
				</p>
			) : null}
			{mine ? (
				<div className="dice-actions">
					<button
						type="button"
						className="btn-gold min-h-12 text-lg"
						disabled={controls.pending || view.rollsUsed >= view.throwCap}
						onClick={() => controls.act({ type: "roll", keep: [] })}
					>
						{view.rollsUsed === 0 ? words.throw : words.throwAgain}
					</button>
					{step === "decide" && current ? (
						<button
							type="button"
							className="btn-ghost min-h-12 w-full max-w-[16rem]"
							disabled={controls.pending}
							onClick={() => controls.act({ type: "stand" })}
						>
							{fmt(words.keep, { throw: current })}
						</button>
					) : null}
				</div>
			) : null}
			{limit && view.phase === "playing" ? (
				<p className="dice-hint">{limit}</p>
			) : null}
			{view.scoring === "points" && view.phase === "playing" ? (
				<p className="dice-hint">
					{fmt(words.pointLimit, { limit: view.lives })}
				</p>
			) : null}
			{view.doubled && view.mexDoubles && view.phase === "playing" ? (
				<p className="mexen-doubled">{words.doubled}</p>
			) : null}
			{news && (!mine || view.rollsUsed === 0) ? (
				<p className="mexen-news" aria-hidden="true">
					{news}
				</p>
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

/** Every player round the table: lives (or points), and the throw they kept this round. */
function MexenSeats({ table, view, controls }: Omit<Props, "game">) {
	const { locale } = useI18n();
	const dice = useMessages().games.dice;
	const words = dice.mexen;
	const now = useNow(15_000);
	const [menuSeat, setMenuSeat] = useState<number | null>(null);
	const you = table.you;
	const name = (seat: number) => diceSeatName(dice, table, seat);

	const status = (seat: number) => {
		const result = view.results[seat];
		if (view.out[seat]) {
			return words.out;
		}
		if (view.phase === "finished") {
			return null;
		}
		if (seat === view.turn) {
			return words.throwing;
		}
		if (result) {
			return fmt(words.kept, { throw: mexenThrowLabel(dice, fmt, result) });
		}
		if (view.order.includes(seat)) {
			return view.throwOff ? words.inThrowOff : words.toThrow;
		}
		return null;
	};

	return (
		<section className="cards-panel mexen-seats" aria-labelledby="mexen-seats">
			<h2 id="mexen-seats" className="cards-kicker">
				{words.seatsLabel}
			</h2>
			<ol>
				{table.seats.map((entry, seat) => {
					const human = entry.botIndex === null;
					const silent = seatIsSilent(entry, now);
					const canManage =
						you !== null &&
						seat !== you &&
						human &&
						!entry.autopilot &&
						(table.isHost || silent);
					const active = view.phase === "playing" && view.turn === seat;
					const score =
						view.scoring === "lives"
							? plural(locale, view.livesLeft[seat], words.lives)
							: plural(locale, view.penalties[seat], words.points);
					const line = status(seat);
					return (
						<li
							// biome-ignore lint/suspicious/noArrayIndexKey: seats never move, so a seat's index is its identity
							key={seat}
							data-active={active}
							data-out={view.out[seat]}
							data-winner={view.winners.includes(seat)}
							aria-current={active ? "true" : undefined}
						>
							<div className="min-w-0 flex-1">
								<p className="mexen-seat-name">
									{entry.autopilot && human ? (
										<Bot className="h-3.5 w-3.5" aria-hidden="true" />
									) : null}
									<span className="truncate">{name(seat)}</span>
									{seat === view.leader &&
									!view.throwOff &&
									view.phase === "playing" ? (
										<span className="mexen-badge">{words.leader}</span>
									) : null}
								</p>
								<p className="mexen-seat-line">
									{[line, silent ? dice.table.offline : null]
										.filter(Boolean)
										.join(" · ")}
								</p>
							</div>
							{view.scoring === "lives" ? (
								<p className="mexen-lives">
									<span className="sr-only">{score}</span>
									<span className="mexen-hearts" aria-hidden="true">
										{Array.from({ length: view.lives }, (_, life) => (
											<Heart
												// biome-ignore lint/suspicious/noArrayIndexKey: hearts are interchangeable
												key={life}
												className="h-3.5 w-3.5"
												data-lost={life >= view.livesLeft[seat]}
											/>
										))}
									</span>
								</p>
							) : (
								<p className="mexen-lives">{score}</p>
							)}
							{canManage ? (
								<button
									type="button"
									className="score-manage"
									aria-label={fmt(dice.table.seatMenu, { name: name(seat) })}
									onClick={() => setMenuSeat(seat)}
								>
									<MoreHorizontal className="h-4 w-4" />
								</button>
							) : null}
						</li>
					);
				})}
			</ol>
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
