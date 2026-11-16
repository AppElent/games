import { isRedSuit } from "@arcadeclub/core/cards/art";
import type { CardId } from "@arcadeclub/core/cards/deck";
import { type CardGame, familyRules } from "@arcadeclub/core/cards/engine";
import {
	bidTotal,
	cardTilt,
	openTrickSlots,
	seatName,
	sortCards,
	tricksChoices,
	tricksHint,
	tricksRoundLabel,
	tricksSeatNote,
	tricksWinsLine,
} from "@arcadeclub/core/cards/table-view";
import type { TricksView } from "@arcadeclub/core/cards/tricks";
import { ListOrdered, Minus, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { fmt, plural, useI18n, useMessages } from "#/lib/i18n";
import { Sheet } from "./Chrome";
import { EndOverlay } from "./EndOverlay";
import { PlayingCard, SuitIcon, useCardName } from "./PlayingCard";
import { ScoreBoard } from "./ScoreBoard";
import { Hand, SeatRow, TableFrame, TurnStatus, useFreshCards } from "./Table";
import type { CardTableBundle, CardTableControls } from "./useCardTable";
import { useCardWords } from "./useCardWords";
import { useFlights } from "./useFlights";
import { cardAttr, zoneAttr } from "./zones";

const SHAKE_MS = 300;

const NO_MELD = () => null;

/** The trump suit for this deal, with the card turned up for it. */
function TrumpFlag({ view }: { view: TricksView }) {
	const cards = useMessages().games.cards;
	const t = cards.tricks;
	const cardName = useCardName();
	if (!view.trump) {
		return <span className="flag">{t.noTrumpPill}</span>;
	}
	return (
		<span
			className="flag"
			data-tone={isRedSuit(view.trump) ? "red" : undefined}
			title={
				view.turnedUp
					? fmt(t.turnedUpLabel, { card: cardName(view.turnedUp) })
					: undefined
			}
		>
			{view.turnedUp ? (
				<span className="flag-card" aria-hidden="true">
					<PlayingCard card={view.turnedUp} />
				</span>
			) : (
				<SuitIcon suit={view.trump} />
			)}
			{fmt(t.trumpPill, { suit: cards.suits[view.trump] })}
		</span>
	);
}

/** Pick a number of tricks and bid it; numbers the rules forbid can't be sent. */
function BidPicker({
	view,
	pending,
	onBid,
}: {
	view: TricksView;
	pending: boolean;
	onBid: (count: number) => void;
}) {
	const t = useMessages().games.cards.tricks;
	const [draft, setDraft] = useState(view.legalBids[0] ?? 0);
	return (
		<div className="bid-picker">
			<fieldset className="bid-stepper" aria-label={t.bidValue}>
				<button
					type="button"
					className="stepper-btn"
					aria-label={t.bidLess}
					disabled={draft <= 0}
					onClick={() => setDraft((count) => count - 1)}
				>
					<Minus className="h-4 w-4" aria-hidden="true" />
				</button>
				<output aria-live="polite" className="bid-value">
					{draft}
				</output>
				<button
					type="button"
					className="stepper-btn"
					aria-label={t.bidMore}
					disabled={draft >= view.handSize}
					onClick={() => setDraft((count) => count + 1)}
				>
					<Plus className="h-4 w-4" aria-hidden="true" />
				</button>
			</fieldset>
			<button
				type="button"
				className="btn-gold"
				disabled={pending || !view.legalBids.includes(draft)}
				onClick={() => onBid(draft)}
			>
				{fmt(t.bidButton, { count: draft })}
			</button>
		</div>
	);
}

/**
 * The cards on the table: the trick being played, or the last one with its
 * taker until the next card goes down. Played cards fly to it as "discard".
 */
function TrickArea({
	table,
	view,
	landing,
}: {
	table: CardTableBundle;
	view: TricksView;
	landing: boolean;
}) {
	const cards = useMessages().games.cards;
	const cardName = useCardName();
	const live = view.trick.length > 0 || !view.lastTrick;
	const plays = live ? view.trick : (view.lastTrick?.plays ?? []);
	const winner = live ? null : (view.lastTrick?.winner ?? null);
	const open = openTrickSlots(view);
	return (
		<section
			className="trick"
			{...zoneAttr("discard")}
			data-landing={landing}
			data-done={winner !== null}
			aria-label={cards.tricks.trickLabel}
		>
			{plays.map((play) => (
				<figure
					key={play.card}
					className="trick-play"
					data-winner={play.seat === winner}
				>
					<span
						className="trick-card"
						style={{ transform: `rotate(${cardTilt(play.card) / 2}deg)` }}
					>
						<PlayingCard card={play.card} label={cardName(play.card)} />
					</span>
					<figcaption>{seatName(cards, table, play.seat)}</figcaption>
				</figure>
			))}
			{live
				? Array.from({ length: open }, (_, index) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: empty places have nothing else to tell them apart.
						<span key={index} className="trick-slot" aria-hidden="true" />
					))
				: null}
			{winner !== null ? (
				<p className="trick-taker">
					{winner === table.you
						? cards.tricks.youTookTrick
						: fmt(cards.tricks.tookTrick, {
								name: seatName(cards, table, winner),
							})}
				</p>
			) : null}
		</section>
	);
}

export function TricksTable({
	game,
	table,
	view,
	controls,
}: {
	game: CardGame;
	table: CardTableBundle;
	view: TricksView;
	controls: CardTableControls;
}) {
	const { locale } = useI18n();
	const cards = useMessages().games.cards;
	const t = cards.tricks;
	const words = useCardWords();
	const cardName = useCardName();
	const rootRef = useRef<HTMLDivElement>(null);
	const [selected, setSelected] = useState<CardId[]>([]);
	const [shake, setShake] = useState<CardId | null>(null);
	const [scoresOpen, setScoresOpen] = useState(false);
	const [resultShown, setResultShown] = useState(false);
	const shakeTimers = useRef(new Set<number>());
	const flights = useFlights(
		rootRef,
		view.events,
		table.you,
		table.seats.length,
		NO_MELD,
	);

	const rules = familyRules(game, table.options, "tricks");
	if (!rules) {
		throw new Error("TricksTable needs a trick-taking game");
	}
	const name = cards.games[game.id].name;
	const you = table.you;
	const playing = view.phase === "playing";
	const bidding = view.phase === "bidding";
	// Someone has the turn: to bid, or to play a card.
	const live = playing || bidding;
	const mine = playing && view.turn === you;
	const myBid = bidding && view.turn === you;
	const choosing = view.phase === "passing" && you !== null && !view.passed;
	const legal = new Set(view.legal);
	const finished = view.phase === "finished";
	const firstTrick = view.tricksTaken.every((count) => count === 0);
	const choices = tricksChoices(view, you);
	const sittingOut = you !== null && (view.out[you] || view.folded[you]);

	useEffect(() => {
		if (!choosing) {
			setSelected([]);
		}
	}, [choosing]);

	// A rematch shows its own last round again when that game ends.
	useEffect(() => {
		if (!finished) {
			setResultShown(false);
		}
	}, [finished]);

	useEffect(() => {
		const timers = shakeTimers.current;
		return () => {
			for (const timer of timers) {
				window.clearTimeout(timer);
			}
		};
	}, []);

	const fresh = useFreshCards(view.hand, mine, view.events);

	function refuse(card: CardId) {
		setShake(card);
		const timer = window.setTimeout(() => {
			shakeTimers.current.delete(timer);
			setShake(null);
		}, SHAKE_MS);
		shakeTimers.current.add(timer);
	}

	function tap(card: CardId, element: HTMLElement) {
		if (choosing) {
			setSelected((current) =>
				current.includes(card)
					? current.filter((item) => item !== card)
					: current.length < view.passCount
						? [...current, card]
						: current,
			);
			return;
		}
		if (!mine || !legal.has(card) || controls.pending) {
			refuse(card);
			return;
		}
		flights.playFrom(card, element, () => controls.act({ type: "play", card }));
	}

	function pass() {
		// The selection clears once the pass is in, and survives a refusal.
		controls.act({ type: "passCards", cards: selected });
	}

	const roundLabel =
		view.deals === null
			? tricksRoundLabel(view, words)
			: `${fmt(t.dealLabel, { round: view.round, deals: view.deals })} · ${plural(locale, view.handSize, t.cardsEach)}`;
	const highWins = rules.highWins === true;
	const best = highWins ? Math.max(...view.totals) : Math.min(...view.totals);
	const standings = view.totals
		.map((total, seat) => ({ total, seat }))
		.sort((a, b) => (highWins ? b.total - a.total : a.total - b.total));
	const lastRound = view.scores.at(-1);
	const bids = bidTotal(view);
	const winsLine = tricksWinsLine(view, rules, words);

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
						aria-label={t.scoresButton}
						onClick={() => setScoresOpen(true)}
					>
						<ListOrdered className="h-4 w-4" aria-hidden="true" />
						<span>{t.scoresButton}</span>
					</button>
				</>
			}
			seats={
				<SeatRow
					table={table}
					handCounts={view.handCounts}
					turn={live ? view.turn : null}
					flash={flights.flash}
					controls={controls}
					note={(seat) => tricksSeatNote(view, seat, words)}
				/>
			}
			center={
				<>
					<TrickArea table={table} view={view} landing={flights.landing} />
					<div className="table-flags">
						{view.stake !== null ? (
							<span className="flag" data-tone="gold">
								{fmt(t.stakePill, { stake: view.stake })}
							</span>
						) : null}
						{rules.trumpChoice !== "none" && live ? (
							<TrumpFlag view={view} />
						) : null}
						{bids !== null && live ? (
							<span className="flag">
								{fmt(t.bidsPill, { bids, tricks: view.handSize })}
							</span>
						) : null}
						{view.phase === "passing" ? (
							<span className="flag">
								{fmt(t.passPill, {
									direction: t.directions[view.passDirection],
								})}
							</span>
						) : null}
						{playing &&
						firstTrick &&
						rules.passing &&
						view.passDirection === "keep" ? (
							<span className="flag">{t.keepPill}</span>
						) : null}
						{view.broken && rules.breaking && playing ? (
							<span
								className="flag"
								data-tone={isRedSuit(rules.breaking.suit) ? "red" : undefined}
							>
								<SuitIcon suit={rules.breaking.suit} />
								{fmt(t.broken, { suit: cards.suits[rules.breaking.suit] })}
							</span>
						) : null}
					</div>
				</>
			}
			status={
				<TurnStatus
					table={table}
					controls={controls}
					events={view.events}
					turn={view.turn}
					live={live}
					mine={mine || myBid}
					hint={tricksHint(view, you, words, rules)}
				>
					{myBid ? (
						<BidPicker
							key={`${view.round}-${view.blockedBid}`}
							view={view}
							pending={controls.pending}
							onBid={(count) => controls.act({ type: "bid", count })}
						/>
					) : null}
					{choosing ? (
						<button
							type="button"
							className="btn-gold"
							disabled={controls.pending || selected.length !== view.passCount}
							onClick={pass}
						>
							{t.passButton}
						</button>
					) : null}
					{choices.answer ? (
						<>
							<button
								type="button"
								className="btn-gold"
								disabled={controls.pending}
								onClick={() => controls.act({ type: "stay" })}
							>
								{t.stayButton}
							</button>
							<button
								type="button"
								className="btn-ghost"
								disabled={controls.pending}
								onClick={() => controls.act({ type: "fold" })}
							>
								{t.foldButton}
							</button>
						</>
					) : null}
					{choices.knock ? (
						<button
							type="button"
							className="btn-gold"
							disabled={controls.pending}
							onClick={() => controls.act({ type: "knock" })}
						>
							{t.knockButton}
						</button>
					) : null}
					{choices.swap ? (
						<button
							type="button"
							className="btn-ghost"
							disabled={controls.pending}
							onClick={() => controls.act({ type: "swapHand" })}
						>
							{t.swapButton}
						</button>
					) : null}
				</TurnStatus>
			}
			hand={
				<Hand
					cards={sortCards(view.hand, "suit")}
					label={cards.table.handLabel}
					fresh={fresh}
					render={(card, style) => {
						const canPlay = mine && legal.has(card);
						const passedIn = firstTrick && view.received.includes(card);
						return (
							<button
								type="button"
								className="hand-card"
								style={style}
								{...cardAttr(card)}
								aria-label={
									passedIn
										? `${cardName(card)}, ${t.receivedLabel}`
										: cardName(card)
								}
								aria-pressed={choosing ? selected.includes(card) : undefined}
								aria-disabled={!choosing && !canPlay}
								data-legal={canPlay}
								data-dim={(mine && !canPlay) || sittingOut}
								data-selected={selected.includes(card)}
								data-new={fresh.has(card) || passedIn}
								data-shake={shake === card}
								onClick={(event) => tap(card, event.currentTarget)}
							>
								<PlayingCard card={card} />
							</button>
						);
					}}
				/>
			}
			overlays={
				<>
					<Sheet
						open={scoresOpen}
						title={t.scoresHeading}
						onClose={() => setScoresOpen(false)}
					>
						<p className="mb-3 text-sm font-semibold">{roundLabel}</p>
						<ScoreBoard
							table={table}
							scores={view.scores}
							totals={view.totals}
							empty={t.noScores}
							totalLabel={t.scoreTotal}
						/>
						<p className="mt-3 text-sm text-[var(--ivory-muted)]">{winsLine}</p>
					</Sheet>
					<Sheet
						open={view.phase === "roundOver" || (finished && !resultShown)}
						dismissable={finished}
						title={fmt(t.roundOver, { round: view.round })}
						onClose={() => {
							if (finished) {
								setResultShown(true);
							}
						}}
					>
						{view.moon !== null ? (
							<p className="mb-3 text-base font-bold">
								{view.moon === you
									? t.youMoon
									: fmt(t.moon, { name: seatName(cards, table, view.moon) })}
							</p>
						) : null}
						{view.dealWinner !== null ? (
							<p className="mb-3 text-base font-bold">
								{view.dealWinner === you
									? t.youDealWinner
									: fmt(t.dealWinner, {
											name: seatName(cards, table, view.dealWinner),
										})}
							</p>
						) : null}
						{lastRound ? (
							<ul
								className="mb-4 flex flex-col gap-1 text-sm"
								aria-label={t.roundSummary}
							>
								{lastRound.map((points, seat) => (
									<li
										// biome-ignore lint/suspicious/noArrayIndexKey: seats are fixed during a game.
										key={seat}
										className="flex justify-between gap-3"
									>
										<span className="min-w-0 truncate">
											{seatName(cards, table, seat)}
											{view.bids ? (
												<span className="text-[var(--ivory-muted)]">
													{" · "}
													{fmt(t.roundBid, {
														bid: view.bids[seat] ?? 0,
														taken: view.tricksTaken[seat],
													})}
												</span>
											) : null}
										</span>
										<span className="font-bold">
											{plural(locale, points, t.totalPoints)}
											{view.out[seat] ? ` · ${t.outNote}` : ""}
										</span>
									</li>
								))}
							</ul>
						) : null}
						<ScoreBoard
							table={table}
							scores={view.scores}
							totals={view.totals}
							empty={t.noScores}
							totalLabel={t.scoreTotal}
						/>
						{!finished && you === null ? (
							<p className="status-hint sheet-foot">{t.waitingNextRound}</p>
						) : (
							<div className="sheet-foot">
								<button
									type="button"
									className="btn-gold w-full"
									disabled={controls.pending}
									onClick={() =>
										finished
											? setResultShown(true)
											: controls.act({ type: "nextRound" })
									}
								>
									{finished
										? t.seeResult
										: fmt(t.nextRound, { round: view.round + 1 })}
								</button>
							</div>
						)}
					</Sheet>
					{finished && resultShown ? (
						<EndOverlay
							table={table}
							winners={view.winners}
							controls={controls}
							title={
								view.winners.length > 1
									? t.matchTie
									: you !== null && view.winners.includes(you)
										? t.matchYouWin
										: fmt(t.matchWinner, {
												name: seatName(cards, table, view.winners[0]),
											})
							}
						>
							<ol className="mt-4 flex flex-col gap-1 text-left">
								{standings.map(({ total, seat }) => (
									<li
										key={seat}
										className="flex justify-between gap-3 rounded-md px-2 py-1.5"
										style={
											total === best
												? { background: "var(--gold-soft)" }
												: undefined
										}
									>
										<span className="truncate font-semibold">
											{seatName(cards, table, seat)}
										</span>
										<span>{plural(locale, total, t.totalPoints)}</span>
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
