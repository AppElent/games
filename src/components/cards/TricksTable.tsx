import { isRedSuit } from "@arcadeclub/core/cards/art";
import { type CardId, SUITS, type Suit } from "@arcadeclub/core/cards/deck";
import { type CardGame, familyRules } from "@arcadeclub/core/cards/engine";
import {
	bidTotal,
	cardTilt,
	isTeamGame,
	seatName,
	sortTricksHand,
	teamName,
	tricksDealSummary,
	tricksHint,
	tricksMatchTitle,
	tricksRoundLabel,
	tricksScoreRows,
	tricksSeatNote,
	tricksStandings,
	tricksTeams,
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
	const open =
		view.phase === "playing" ? table.seats.length - view.trick.length : 0;
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
	const calling = view.phase === "trump";
	const callingMine = calling && view.turn === you;
	const myBid = bidding && view.turn === you;
	const choosing = view.phase === "passing" && you !== null && !view.passed;
	const legal = new Set(view.legal);
	const finished = view.phase === "finished";
	const firstTrick = view.tricksTaken.every((count) => count === 0);

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

	function callTrump(suit: Suit) {
		controls.act({ type: "chooseTrump", suit });
	}

	const roundLabel = tricksRoundLabel(view, words);
	const teamGame = isTeamGame(view);
	const teams = teamGame ? tricksTeams(view, you) : [];
	const scoreRows = tricksScoreRows(view, table, cards);
	const scoreBoard = (
		<ScoreBoard
			table={table}
			scores={scoreRows.scores}
			totals={scoreRows.totals}
			labels={scoreRows.labels}
			heading={teamGame ? t.teamHeading : undefined}
			empty={t.noScores}
			totalLabel={t.scoreTotal}
		/>
	);
	const highWins = rules.highWins === true;
	const standings = tricksStandings(view, table, cards, highWins);
	const winsLine = highWins ? t.highestWins : t.lowestWins;
	const bids = bidTotal(view);
	const dealSummary = tricksDealSummary(view, table, words);
	const lastRound = view.scores.at(-1);
	// The roem of the trick on show, until the next card goes down.
	const roem = view.trick.length === 0 ? (view.lastTrick?.roem ?? null) : null;

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
					turn={live || calling ? view.turn : null}
					flash={flights.flash}
					controls={controls}
					note={(seat) => tricksSeatNote(view, seat, words, you)}
				/>
			}
			center={
				<>
					<TrickArea table={table} view={view} landing={flights.landing} />
					<div className="table-flags">
						{calling && view.offered ? (
							<span
								className="flag"
								data-tone={isRedSuit(view.offered) ? "red" : undefined}
							>
								<SuitIcon suit={view.offered} />
								{fmt(t.offerPill, { suit: cards.suits[view.offered] })}
							</span>
						) : null}
						{(rules.trumpChoice !== "none" || rules.callTrump === true) &&
						live ? (
							<TrumpFlag view={view} />
						) : null}
						{bids !== null && live ? (
							<span className="flag">
								{fmt(t.bidsPill, { bids, tricks: view.handSize })}
							</span>
						) : null}
						{roem ? (
							<span className="flag" data-tone="gold">
								{[
									fmt(t.roem, { points: roem.points }),
									...roem.kinds.map((kind) => t.roemKinds[kind]),
								].join(" · ")}
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
						view.passDirection === "keep" &&
						view.bids === null ? (
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
					{teamGame ? (
						<ul className="table-flags team-strip" aria-label={t.teamsLabel}>
							{teams.map((team) => (
								<li key={team.team} className="flag" data-yours={team.yours}>
									<span className="truncate">
										{teamName(cards, table, team.seats)}
									</span>
									<span>{team.total}</span>
									{view.phase === "playing" ? (
										<span className="team-deal">
											{fmt(t.teamDeal, {
												points: team.points,
												roem: team.roem,
											})}
										</span>
									) : null}
								</li>
							))}
						</ul>
					) : null}
				</>
			}
			status={
				<TurnStatus
					table={table}
					controls={controls}
					events={view.events}
					turn={view.turn}
					live={live || calling}
					mine={mine || callingMine || myBid}
					hint={tricksHint(view, you, words, rules)}
				>
					{callingMine && view.offered ? (
						<>
							<button
								type="button"
								className="btn-gold"
								disabled={controls.pending}
								onClick={() => view.offered && callTrump(view.offered)}
							>
								<SuitIcon suit={view.offered} />
								{fmt(t.playTrump, { suit: cards.suits[view.offered] })}
							</button>
							<button
								type="button"
								className="btn-ghost"
								disabled={controls.pending}
								onClick={() => controls.act({ type: "passTrump" })}
							>
								{t.passTrump}
							</button>
						</>
					) : null}
					{callingMine && !view.offered
						? SUITS.map((suit) => (
								<button
									key={suit}
									type="button"
									className="btn-gold"
									disabled={controls.pending}
									onClick={() => callTrump(suit)}
								>
									<SuitIcon suit={suit} />
									{fmt(t.playTrump, { suit: cards.suits[suit] })}
								</button>
							))
						: null}
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
				</TurnStatus>
			}
			hand={
				<Hand
					cards={sortTricksHand(view.hand, rules, view.trump)}
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
								data-dim={mine && !canPlay}
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
						{scoreBoard}
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
						{dealSummary?.headlines.map((line) => (
							<p key={line} className="mb-3 text-base font-bold">
								{line}
							</p>
						))}
						{dealSummary ? (
							<ul
								className="mb-4 flex flex-col gap-1 text-sm"
								aria-label={t.roundSummary}
							>
								{dealSummary.teams.map((team) => (
									<li key={team.team} className="flex justify-between gap-3">
										<span className="min-w-0">
											<span className="block truncate font-semibold">
												{team.label}
											</span>
											<span className="text-[var(--ivory-muted)]">
												{team.detail}
											</span>
										</span>
										<span className="font-bold">
											{plural(locale, team.score, t.totalPoints)}
										</span>
									</li>
								))}
							</ul>
						) : lastRound ? (
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
										</span>
									</li>
								))}
							</ul>
						) : null}
						{scoreBoard}
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
							title={tricksMatchTitle(view, table, words)}
						>
							<ol className="mt-4 flex flex-col gap-1 text-left">
								{standings.map(({ row, label, total, best }) => (
									<li
										key={row}
										className="flex justify-between gap-3 rounded-md px-2 py-1.5"
										style={
											best ? { background: "var(--gold-soft)" } : undefined
										}
									>
										<span className="truncate font-semibold">{label}</span>
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
