import type { CardId } from "@arcadeclub/core/cards/deck";
import { parseCard } from "@arcadeclub/core/cards/deck";
import {
	type CardGameDefinition,
	type CardGameId,
	resolvedRules,
} from "@arcadeclub/core/cards/engine";
import {
	buildMeld,
	fitOnMeld,
	type Meld,
	meldPoints,
	runFaceAt,
	swapJoker,
} from "@arcadeclub/core/cards/melds";
import type { RummyView } from "@arcadeclub/core/cards/rummy";
import { ArrowDownUp, ListOrdered } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { fmt, plural, useI18n, useMessages } from "#/lib/i18n";
import { Sheet } from "./Chrome";
import { EndOverlay } from "./EndOverlay";
import { seatName, sortCards } from "./format";
import { PlayingCard, useCardName } from "./PlayingCard";
import {
	AutopilotBack,
	EventTicker,
	Hand,
	Piles,
	SeatRow,
	TableFrame,
	useFreshCards,
} from "./Table";
import type { CardTableBundle, CardTableControls } from "./useCardTable";
import { useFlights } from "./useFlights";

function ScoreBoard({
	table,
	view,
}: {
	table: CardTableBundle;
	view: RummyView;
}) {
	const cards = useMessages().games.cards;
	if (view.scores.length === 0) {
		return <p className="text-sm">{cards.rummy.noScores}</p>;
	}
	return (
		<table className="score-table">
			<thead>
				<tr>
					<th scope="col">{cards.table.playerHeading}</th>
					{view.scores.map((_, index) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: rounds only ever append.
						<th key={index} scope="col">
							{index + 1}
						</th>
					))}
					<th scope="col">{cards.rummy.scoreTotal}</th>
				</tr>
			</thead>
			<tbody>
				{table.seats.map((_, seat) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: seats are fixed during a game.
					<tr key={seat}>
						<td>{seatName(cards, table, seat)}</td>
						{view.scores.map((round, index) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: rounds only ever append.
							<td key={index}>{round[seat]}</td>
						))}
						<td className="font-bold">{view.totals[seat]}</td>
					</tr>
				))}
			</tbody>
		</table>
	);
}

export function RummyTable({
	game,
	table,
	view,
	controls,
}: {
	game: CardGameDefinition;
	table: CardTableBundle;
	view: RummyView;
	controls: CardTableControls;
}) {
	const { locale } = useI18n();
	const { games, serverErrors } = useMessages();
	const cards = games.cards;
	const cardName = useCardName();
	const rootRef = useRef<HTMLDivElement>(null);
	const [selected, setSelected] = useState<CardId[]>([]);
	const [staged, setStaged] = useState<CardId[][]>([]);
	const [sortBy, setSortBy] = useState<"suit" | "rank">("suit");
	const [scoresOpen, setScoresOpen] = useState(false);
	const [resultShown, setResultShown] = useState(false);
	const melds = view.melds;
	const meldCard = useMemo(
		() => (id: number) => melds.find((m) => m.id === id)?.cards[0] ?? null,
		[melds],
	);
	const flights = useFlights(
		rootRef,
		view.events,
		table.you,
		table.seats.length,
		meldCard,
	);

	const resolved = resolvedRules(game, table.options);
	if (resolved.family !== "rummy") {
		throw new Error("RummyTable needs a rummy game");
	}
	const rules = resolved.rules;
	const name = cards.games[game.id as CardGameId].name;
	const you = table.you;
	const live = view.phase === "draw" || view.phase === "play";
	const mine = live && view.turn === you;
	const drawing = mine && view.phase === "draw";
	const playing = mine && view.phase === "play";
	const opened = you !== null && view.opened[you];

	// A rematch shows its own last round again when that game ends.
	useEffect(() => {
		if (view.phase !== "finished") {
			setResultShown(false);
		}
	}, [view.phase]);

	// Anything selected or set aside belongs to this turn only.
	useEffect(() => {
		if (!playing) {
			setSelected([]);
			setStaged([]);
		}
	}, [playing]);

	const fresh = useFreshCards(view.hand, mine, view.events);
	const stagedFlat = staged.flat();
	const handShown = sortCards(
		view.hand.filter((card) => !stagedFlat.includes(card)),
		sortBy,
	);
	const liveSelection = selected.filter((card) => handShown.includes(card));
	const shape =
		liveSelection.length >= rules.minMeldSize
			? buildMeld(liveSelection, rules)
			: null;
	const shapePoints = shape ? meldPoints(shape, rules) : 0;
	const stagedPoints = staged.reduce((sum, group) => {
		const built = buildMeld(group, rules);
		return sum + (built ? meldPoints(built, rules) : 0);
	}, 0);
	// Every turn ends on a discard, so laying down can never empty the hand.
	const keepsOne = liveSelection.length < handShown.length;
	const canOpen =
		!opened &&
		staged.length > 0 &&
		shape === null &&
		stagedPoints >= rules.openingPoints &&
		handShown.length > 0;
	// The selection itself reaches the opening, with or without what's set aside.
	const openingWithShape = stagedPoints + shapePoints;
	const canOpenNow =
		playing &&
		!opened &&
		shape !== null &&
		keepsOne &&
		openingWithShape >= rules.openingPoints;
	const singleCard = liveSelection.length === 1 ? liveSelection[0] : null;
	const cantReturn =
		singleCard !== null &&
		singleCard === view.takenDiscard &&
		view.hand.length > 1;
	const canDiscard =
		playing && singleCard !== null && staged.length === 0 && !cantReturn;

	// A target can sit below the fold when the table is full of melds.
	const selectionKey = liveSelection.join();
	// biome-ignore lint/correctness/useExhaustiveDependencies: runs when the selection changes.
	useEffect(() => {
		rootRef.current
			?.querySelector('.meld-area [data-target="true"]')
			?.scrollIntoView({ block: "nearest" });
	}, [selectionKey]);

	function toggle(card: CardId) {
		setSelected((current) =>
			current.includes(card)
				? current.filter((item) => item !== card)
				: [...current, card],
		);
	}

	function meldAction(meld: Meld) {
		if (!playing || !opened || liveSelection.length === 0) {
			return null;
		}
		// Taking the joker back beats adding the card, as the rules promise.
		if (singleCard && swapJoker(meld, singleCard)) {
			return { type: "swap" as const };
		}
		const order = keepsOne ? fitOnMeld(meld, liveSelection) : null;
		return order ? { type: "add" as const, order } : null;
	}

	function runMeldAction(
		meld: Meld,
		action: NonNullable<ReturnType<typeof meldAction>>,
	) {
		const element = document.querySelector<HTMLElement>(
			`[data-card-id="${liveSelection[0]}"]`,
		);
		if (element) {
			flights.noteOrigin(liveSelection[0], element);
		}
		controls.act(
			action.type === "add"
				? {
						type: "layDown",
						additions: [{ meldId: meld.id, cards: action.order }],
					}
				: {
						type: "layDown",
						swaps: [{ meldId: meld.id, card: liveSelection[0] }],
					},
		);
		setSelected([]);
	}

	function layNow() {
		controls.act({ type: "layDown", melds: [liveSelection] });
		setSelected([]);
	}

	function stage() {
		setStaged((current) => [...current, liveSelection]);
		setSelected([]);
	}

	function openWithSelection() {
		controls.act({ type: "layDown", melds: [...staged, liveSelection] });
		setStaged([]);
		setSelected([]);
	}

	function openWithStaged() {
		controls.act({ type: "layDown", melds: staged });
		setStaged([]);
		setSelected([]);
	}

	function discard() {
		if (!singleCard) {
			return;
		}
		const element = document.querySelector<HTMLElement>(
			`[data-card-id="${singleCard}"]`,
		);
		if (element) {
			flights.noteOrigin(singleCard, element);
		}
		controls.act({ type: "discard", card: singleCard });
		setSelected([]);
	}

	const canTakeDiscard = drawing && rules.takeFromDiscard && view.top !== null;
	const hint = drawing
		? rules.takeFromDiscard
			? cards.rummy.drawHint
			: cards.rummy.drawStockHint
		: playing
			? playHint()
			: null;

	function playHint() {
		if (!keepsOne && !canDiscard) {
			return serverErrors.cardsKeepOneToDiscard;
		}
		if (cantReturn) {
			return serverErrors.cardsCannotReturnDiscard;
		}
		if (liveSelection.length === 0) {
			return staged.length > 0 ? stagedNote() : cards.rummy.selectHint;
		}
		if (melds.some((meld) => meldAction(meld))) {
			return cards.rummy.tapMeldHint;
		}
		if (liveSelection.length > 1 && shape === null) {
			return cards.rummy.invalidMeld;
		}
		if (canOpenNow) {
			return cards.rummy.openNowHint;
		}
		if (!opened && shape !== null) {
			return fmt(cards.rummy.openingNeeded, { needed: rules.openingPoints });
		}
		return staged.length > 0 ? stagedNote() : cards.rummy.discardHint;
	}

	function stagedNote() {
		return stagedPoints >= rules.openingPoints
			? cards.rummy.stagedHint
			: fmt(cards.rummy.stagedMoreHint, { needed: rules.openingPoints });
	}

	const meldKind = (meld: Meld) =>
		meld.kind === "set" ? cards.rummy.meldSet : cards.rummy.meldRun;

	const finished = view.phase === "finished";
	const best = Math.min(...view.totals);
	const standings = view.totals
		.map((total, seat) => ({ total, seat }))
		.sort((a, b) => a.total - b.total);

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
					<span className="seat-note hidden px-2 sm:block">
						{fmt(cards.rummy.roundLabel, {
							round: view.round,
							total: view.totalRounds,
						})}
					</span>
					<button
						type="button"
						className="icon-chip"
						aria-label={cards.rummy.scoresButton}
						onClick={() => setScoresOpen(true)}
					>
						<ListOrdered className="h-4 w-4" aria-hidden="true" />
						<span>{cards.rummy.scoresButton}</span>
					</button>
					{you !== null ? (
						<button
							type="button"
							className="icon-chip"
							aria-label={
								sortBy === "suit"
									? cards.table.sortByRank
									: cards.table.sortBySuit
							}
							onClick={() =>
								setSortBy((current) => (current === "suit" ? "rank" : "suit"))
							}
						>
							<ArrowDownUp className="h-4 w-4" aria-hidden="true" />
							<span>
								{sortBy === "suit"
									? cards.table.sortByRank
									: cards.table.sortBySuit}
							</span>
						</button>
					) : null}
				</>
			}
			seats={
				<SeatRow
					table={table}
					handCounts={view.handCounts}
					turn={live ? view.turn : null}
					flash={flights.flash}
					controls={controls}
					note={(seat) => (
						<>
							{view.opened[seat] ? (
								<span role="img" aria-label={cards.rummy.opened}>
									{"✓ "}
								</span>
							) : null}
							{view.scores.length > 0
								? plural(locale, view.totals[seat], cards.rummy.totalPoints)
								: "\u00a0"}
						</>
					)}
				/>
			}
			center={
				<div className="rummy-board">
					<Piles
						stockCount={view.stockCount}
						top={view.top}
						underTop={view.underTop}
						landing={flights.landing}
						stockAction={
							drawing
								? {
										label: cards.rummy.drawStock,
										run: () => controls.act({ type: "drawStock" }),
										pulse: true,
									}
								: undefined
						}
						discardAction={
							canTakeDiscard && view.top
								? {
										label: fmt(cards.rummy.takeDiscard, {
											card: cardName(view.top),
										}),
										run: () => controls.act({ type: "takeDiscard" }),
										pulse: true,
									}
								: undefined
						}
					/>
					<div className="meld-area">
						{view.melds.length === 0 ? (
							<p className="meld-empty">{cards.rummy.tableEmpty}</p>
						) : null}
						{view.melds.map((meld) => {
							const action = meldAction(meld);
							const kind = meldKind(meld).toLowerCase();
							const faces = meld.cards.map((card, index) => {
								if (!parseCard(card).joker || meld.kind !== "run") {
									return cardName(card);
								}
								const face = runFaceAt(meld, index);
								return fmt(cards.rummy.jokerAs, {
									card: cards.cardName
										.replace("{rank}", cards.ranks[face.rank])
										.replace("{suit}", cards.suits[face.suit]),
								});
							});
							const content = meld.cards.map((card, index) => (
								<PlayingCard
									key={card}
									card={card}
									label={action ? undefined : faces[index]}
								/>
							));
							return action ? (
								<button
									key={meld.id}
									type="button"
									className="meld"
									data-target="true"
									data-zone={`meld-${meld.id}`}
									aria-label={`${fmt(
										action.type === "add"
											? cards.rummy.addToMeld
											: cards.rummy.swapOnMeld,
										{ kind },
									)}: ${faces.join(", ")}`}
									onClick={() => runMeldAction(meld, action)}
								>
									{content}
								</button>
							) : (
								<section
									key={meld.id}
									className="meld"
									data-zone={`meld-${meld.id}`}
									aria-label={meldKind(meld)}
								>
									{content}
								</section>
							);
						})}
					</div>
				</div>
			}
			status={
				<>
					{staged.length > 0 ? (
						<section className="staged" aria-label={cards.rummy.stagedLabel}>
							{staged.map((group) => (
								<div key={group.join()} className="meld">
									{group.map((card) => (
										<PlayingCard
											key={card}
											card={card}
											label={cardName(card)}
										/>
									))}
								</div>
							))}
						</section>
					) : null}
					{playing && !opened && staged.length > 0 ? (
						<>
							<p className="status-hint">
								{fmt(cards.rummy.openingProgress, {
									have: stagedPoints,
									needed: rules.openingPoints,
								})}
							</p>
							<div className="opening-meter" aria-hidden="true">
								<i
									style={{
										width: `${Math.min(100, (stagedPoints / rules.openingPoints) * 100)}%`,
									}}
								/>
							</div>
						</>
					) : null}
					<p className="status-line" data-mine={mine} aria-live="polite">
						{!live
							? null
							: mine
								? cards.table.yourTurn
								: fmt(cards.table.theirTurn, {
										name: seatName(cards, table, view.turn),
									})}
					</p>
					{hint ? <p className="status-hint">{hint}</p> : null}
					<EventTicker events={view.events} table={table} />
					<div className="table-actions">
						{canOpenNow ? (
							<button
								type="button"
								className="btn-gold"
								disabled={controls.pending}
								onClick={openWithSelection}
							>
								{fmt(cards.rummy.openingConfirm, {
									points: openingWithShape,
								})}
							</button>
						) : null}
						{playing && !opened && shape ? (
							<button
								type="button"
								className={canOpenNow ? "btn-ghost" : "btn-gold"}
								onClick={stage}
							>
								{fmt(cards.rummy.stageMeld, { points: shapePoints })}
							</button>
						) : null}
						{playing && opened && shape && keepsOne ? (
							<button
								type="button"
								className="btn-gold"
								disabled={controls.pending}
								onClick={layNow}
							>
								{fmt(cards.rummy.layMeld, { points: shapePoints })}
							</button>
						) : null}
						{canOpen ? (
							<button
								type="button"
								className="btn-gold"
								disabled={controls.pending}
								onClick={openWithStaged}
							>
								{fmt(cards.rummy.openingConfirm, { points: stagedPoints })}
							</button>
						) : null}
						{staged.length > 0 ? (
							<button
								type="button"
								className="btn-ghost"
								onClick={() => setStaged([])}
							>
								{cards.rummy.openingCancel}
							</button>
						) : null}
						{canDiscard ? (
							<button
								type="button"
								className="btn-gold"
								disabled={controls.pending}
								onClick={discard}
							>
								{cards.rummy.discardCard}
							</button>
						) : null}
						{playing && liveSelection.length > 1 ? (
							<button
								type="button"
								className="btn-ghost"
								onClick={() => setSelected([])}
							>
								{cards.rummy.clearSelection}
							</button>
						) : null}
						{you !== null && table.seats[you]?.autopilot ? (
							<AutopilotBack controls={controls} seat={you} />
						) : null}
					</div>
				</>
			}
			hand={
				you === null ? (
					<div className="h-4" />
				) : (
					<Hand
						cards={handShown}
						label={cards.table.handLabel}
						fresh={fresh}
						render={(card, style) => (
							<button
								type="button"
								className="hand-card"
								style={style}
								data-card-id={card}
								aria-label={cardName(card)}
								aria-pressed={liveSelection.includes(card)}
								aria-disabled={!playing}
								data-selected={liveSelection.includes(card)}
								data-new={fresh.has(card)}
								onClick={() => {
									if (playing) {
										toggle(card);
									}
								}}
							>
								<PlayingCard card={card} />
							</button>
						)}
					/>
				)
			}
			overlays={
				<>
					<Sheet
						open={scoresOpen}
						title={cards.rummy.scoresHeading}
						onClose={() => setScoresOpen(false)}
					>
						<p className="mb-3 text-sm font-semibold">
							{fmt(cards.rummy.roundLabel, {
								round: view.round,
								total: view.totalRounds,
							})}
						</p>
						<ScoreBoard table={table} view={view} />
						<p className="mt-3 text-sm text-[var(--ivory-muted)]">
							{cards.rummy.lowestWins}
						</p>
					</Sheet>
					<Sheet
						open={view.phase === "roundOver" || (finished && !resultShown)}
						dismissable={finished}
						title={fmt(cards.rummy.roundOver, { round: view.round })}
						onClose={() => {
							if (finished) {
								setResultShown(true);
							}
						}}
					>
						<p className="mb-3 text-base font-bold">
							{view.roundWinner === null
								? cards.rummy.roundNoWinner
								: view.roundWinner === you
									? cards.rummy.roundYouOut
									: fmt(cards.rummy.roundWinner, {
											name: seatName(cards, table, view.roundWinner),
										})}
						</p>
						<div className="mb-4">
							<ScoreBoard table={table} view={view} />
						</div>
						<ul className="mb-4 flex flex-col gap-2">
							{view.revealed?.map((hand, seat) => (
								// biome-ignore lint/suspicious/noArrayIndexKey: seats are fixed during a game.
								<li key={seat}>
									<p className="mb-1 text-xs font-semibold">
										{seatName(cards, table, seat)}
									</p>
									{hand.length === 0 ? (
										<p className="text-xs opacity-70">{cards.table.noCards}</p>
									) : (
										<div
											className="meld"
											style={{ "--card-w": "34px" } as React.CSSProperties}
										>
											{sortCards(hand, sortBy).map((card) => (
												<PlayingCard
													key={card}
													card={card}
													label={cardName(card)}
												/>
											))}
										</div>
									)}
								</li>
							))}
						</ul>
						{!finished && you === null ? (
							<p className="status-hint sheet-foot">
								{cards.rummy.waitingNextRound}
							</p>
						) : null}
						{finished || you !== null ? (
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
										? cards.rummy.seeResult
										: fmt(cards.rummy.nextRound, { round: view.round + 1 })}
								</button>
							</div>
						) : null}
					</Sheet>
					{finished && resultShown ? (
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
										className="flex justify-between gap-3 rounded-md px-2 py-1.5"
										style={
											total === best
												? { background: "rgba(230,192,106,.16)" }
												: undefined
										}
									>
										<span className="truncate font-semibold">
											{seatName(cards, table, seat)}
										</span>
										<span>
											{plural(locale, total, cards.rummy.totalPoints)}
										</span>
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
