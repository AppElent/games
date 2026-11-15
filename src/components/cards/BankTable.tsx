import type { BankView } from "@arcadeclub/core/cards/bank";
import type { CardGame } from "@arcadeclub/core/cards/engine";
import {
	bankHint,
	bankSeatNote,
	seatName,
	signedPoints,
} from "@arcadeclub/core/cards/table-view";
import { ListOrdered } from "lucide-react";
import { useRef, useState } from "react";
import { fmt, plural, useI18n, useMessages } from "#/lib/i18n";
import { Sheet } from "./Chrome";
import { EndOverlay } from "./EndOverlay";
import { PlayingCard, useCardName } from "./PlayingCard";
import { ScoreBoard } from "./ScoreBoard";
import { Hand, SeatRow, TableFrame, TurnStatus, useFreshCards } from "./Table";
import type { CardTableBundle, CardTableControls } from "./useCardTable";
import { useCardWords } from "./useCardWords";
import { useFlights } from "./useFlights";
import { zoneAttr } from "./zones";

const NO_MELD = () => null;
const NO_CARDS: readonly string[] = [];

/** A table for the bank family: everyone plays their own hand against the bank. */
export function BankTable({
	game,
	table,
	view,
	controls,
}: {
	game: CardGame;
	table: CardTableBundle;
	view: BankView;
	controls: CardTableControls;
}) {
	const { locale } = useI18n();
	const cards = useMessages().games.cards;
	const words = useCardWords();
	const cardName = useCardName();
	const rootRef = useRef<HTMLDivElement>(null);
	const [scoresOpen, setScoresOpen] = useState(false);
	const flights = useFlights(
		rootRef,
		view.events,
		table.you,
		table.seats.length,
		NO_MELD,
	);

	const name = cards.games[game.id].name;
	const you = table.you;
	const playing = view.phase === "play";
	const mine = playing && view.turn === you;
	const hint = bankHint(view, you, words);
	const hand = you === null ? NO_CARDS : view.hands[you];
	const fresh = useFreshCards(hand, mine, view.events);
	const yourNote = you === null ? "" : bankSeatNote(words, view, you);
	const finished = view.phase === "finished";
	const best = Math.max(...view.totals);
	const standings = view.totals
		.map((total, seat) => ({ total, seat }))
		.sort((a, b) => b.total - a.total);
	const roundLabel = fmt(cards.rummy.roundLabel, {
		round: view.round,
		total: view.totalRounds,
	});
	const bankCards = view.bank.length > 0;
	const bankLabel = bankCards
		? `${cards.bank.bankName}: ${fmt(cards.bank.bankTotal, { total: view.bankTotal })}`
		: cards.bank.bankName;

	return (
		<TableFrame
			game={game}
			rootRef={rootRef}
			table={table}
			name={name}
			error={controls.error}
			flightLayer={flights.layer}
			topExtra={
				<>
					<span className="seat-note hidden px-2 sm:block">{roundLabel}</span>
					<button
						type="button"
						className="icon-chip"
						aria-label={cards.rummy.scoresButton}
						onClick={() => setScoresOpen(true)}
					>
						<ListOrdered className="h-4 w-4" aria-hidden="true" />
						<span>{cards.rummy.scoresButton}</span>
					</button>
				</>
			}
			seats={
				<SeatRow
					table={table}
					handCounts={view.handCounts}
					turn={playing ? view.turn : null}
					flash={flights.flash}
					controls={controls}
					note={(seat) => bankSeatNote(words, view, seat) || " "}
				/>
			}
			center={
				<div className="bank-board">
					<section
						className="bank-seat"
						{...zoneAttr("bank")}
						aria-label={bankLabel}
					>
						<p className="bank-name" aria-hidden="true">
							{cards.bank.bankName}
							{bankCards ? <strong>{view.bankTotal}</strong> : null}
						</p>
						<div className="bank-cards">
							{view.bank.map((card) => (
								<PlayingCard
									key={card ?? "hole"}
									card={card}
									label={card ? cardName(card) : cards.bank.hidden}
								/>
							))}
						</div>
					</section>
					<div
						className="pile pile-stock bank-stock"
						{...zoneAttr("stock")}
						role="img"
						aria-label={`${cards.table.stock}: ${plural(locale, view.stockCount, cards.table.stockCount)}`}
					>
						<PlayingCard card={null} />
						<PlayingCard card={null} />
						<PlayingCard card={null} />
					</div>
					<p className="seat-note sm:hidden">{roundLabel}</p>
					<div className="table-flags">
						{yourNote ? <span className="flag">{yourNote}</span> : null}
					</div>
				</div>
			}
			status={
				<TurnStatus
					table={table}
					controls={controls}
					events={view.events}
					turn={view.turn}
					live={playing}
					mine={mine}
					hint={hint}
				>
					{view.canStake
						? view.stakeOptions.map((amount) => (
								<button
									key={amount}
									type="button"
									className="btn-gold"
									disabled={controls.pending}
									onClick={() => controls.act({ type: "stake", amount })}
								>
									{plural(locale, amount, cards.bank.stakeButton)}
								</button>
							))
						: null}
					{mine ? (
						<button
							type="button"
							className="btn-gold"
							disabled={controls.pending}
							onClick={() => controls.act({ type: "hit" })}
						>
							{cards.bank.hit}
						</button>
					) : null}
					{mine ? (
						<button
							type="button"
							className="btn-ghost"
							disabled={controls.pending}
							onClick={() => controls.act({ type: "stand" })}
						>
							{cards.bank.stand}
						</button>
					) : null}
					{view.canDouble ? (
						<button
							type="button"
							className="btn-ghost"
							disabled={controls.pending}
							onClick={() => controls.act({ type: "double" })}
						>
							{cards.bank.double}
						</button>
					) : null}
				</TurnStatus>
			}
			hand={
				<Hand
					cards={hand}
					label={cards.table.handLabel}
					fresh={fresh}
					render={(card, style) => (
						<span
							className="hand-card"
							style={style}
							data-new={fresh.has(card)}
						>
							<PlayingCard card={card} label={cardName(card)} />
						</span>
					)}
				/>
			}
			overlays={
				<>
					<Sheet
						open={scoresOpen}
						title={cards.rummy.scoresHeading}
						onClose={() => setScoresOpen(false)}
					>
						<p className="mb-3 text-sm font-semibold">{roundLabel}</p>
						<ScoreBoard
							table={table}
							scores={view.results}
							totals={view.totals}
							empty={cards.rummy.noScores}
							totalLabel={cards.rummy.scoreTotal}
						/>
						<p className="mt-3 text-sm text-[var(--ivory-muted)]">
							{cards.bank.highestWins}
						</p>
					</Sheet>
					{finished ? (
						<EndOverlay
							table={table}
							winners={view.winners}
							controls={controls}
							title={
								view.winners.length > 1
									? cards.rummy.matchTie
									: you !== null && view.winners.includes(you)
										? cards.rummy.matchYouWin
										: fmt(cards.rummy.matchWinner, {
												name: seatName(cards, table, view.winners[0]),
											})
							}
						>
							<ol className="mt-4 flex flex-col gap-1 text-left">
								{standings.map(({ total, seat }) => (
									<li
										key={seat}
										className="standing flex justify-between gap-3 rounded-md px-2 py-1.5"
										data-best={total === best}
									>
										<span className="truncate font-semibold">
											{seatName(cards, table, seat)}
										</span>
										<span>{signedPoints(words, total)}</span>
									</li>
								))}
							</ol>
						</EndOverlay>
					) : null}
				</>
			}
		/>
	);
}
