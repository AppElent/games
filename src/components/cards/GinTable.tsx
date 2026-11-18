import type { CardId } from "@arcadeclub/core/cards/deck";
import { type CardGame, familyRules } from "@arcadeclub/core/cards/engine";
import type { GinHandResult, GinView } from "@arcadeclub/core/cards/gin";
import type { Meld } from "@arcadeclub/core/cards/melds";
import {
	ginHint,
	ginLayoffOrder,
	ginResultText,
	ginTurn,
	groupGinHand,
	meldCardNames,
	seatName,
	sortCards,
} from "@arcadeclub/core/cards/table-view";
import { ArrowDownUp, ListOrdered } from "lucide-react";
import {
	type CSSProperties,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { fmt, plural, useI18n, useMessages } from "#/lib/i18n";
import { Sheet } from "./Chrome";
import { EndOverlay } from "./EndOverlay";
import { PlayingCard, useCardName } from "./PlayingCard";
import { ScoreBoard } from "./ScoreBoard";
import {
	Hand,
	Piles,
	SeatRow,
	TableFrame,
	TurnStatus,
	useFreshCards,
} from "./Table";
import type { CardTableBundle, CardTableControls } from "./useCardTable";
import { useCardWords } from "./useCardWords";
import { useFlights } from "./useFlights";
import {
	cardAttr,
	findCard,
	findMeldTarget,
	meldTargetAttr,
	meldZone,
	zoneAttr,
} from "./zones";

type Sort = "melds" | "suit";

/** One seat's hand as it was scored: melds, then deadwood. */
function ShownHand({
	shown,
	deadwood,
}: {
	shown: GinHandResult["shown"][number];
	deadwood: number;
}) {
	const { locale } = useI18n();
	const cards = useMessages().games.cards;
	const cardName = useCardName();
	const small = { "--card-w": "34px" } as CSSProperties;
	return (
		<div className="flex flex-wrap items-center gap-2">
			{shown.melds.map((meld) => (
				<div key={meld.join()} className="meld" style={small}>
					{meld.map((card) => (
						<PlayingCard key={card} card={card} label={cardName(card)} />
					))}
				</div>
			))}
			{shown.deadwood.length > 0 ? (
				<div className="meld" data-deadwood="true" style={small}>
					{sortCards(shown.deadwood, "suit").map((card) => (
						<PlayingCard key={card} card={card} label={cardName(card)} />
					))}
				</div>
			) : null}
			<p className="text-xs">
				{plural(locale, deadwood, cards.gin.deadwoodPoints)}
			</p>
		</div>
	);
}

export function GinTable({
	game,
	table,
	view,
	controls,
}: {
	game: CardGame;
	table: CardTableBundle;
	view: GinView;
	controls: CardTableControls;
}) {
	const { locale } = useI18n();
	const { games, serverErrors } = useMessages();
	const cards = games.cards;
	const words = useCardWords();
	const cardName = useCardName();
	const rootRef = useRef<HTMLDivElement>(null);
	const [selected, setSelected] = useState<CardId[]>([]);
	const [sortBy, setSortBy] = useState<Sort>("melds");
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

	const ginRules = familyRules(game, table.options, table.seats.length, "gin");
	if (!ginRules) {
		throw new Error("GinTable needs a gin game");
	}
	const rules = ginRules;
	const name = cards.games[game.id].name;
	const you = table.you;
	const turn = ginTurn({ view, rules, you, selected });
	const { live, mine, drawing, playing, layingOff, selection, singleCard } =
		turn;
	const knocker = view.knock ? seatName(cards, table, view.knock.seat) : "";

	// A rematch shows its own last hand again when that match ends.
	useEffect(() => {
		if (view.phase !== "finished") {
			setResultShown(false);
		}
	}, [view.phase]);

	// A selection belongs to one step of one turn.
	const step = playing ? "play" : layingOff ? "layoff" : "wait";
	// biome-ignore lint/correctness/useExhaustiveDependencies: clears when the step changes.
	useEffect(() => {
		setSelected([]);
	}, [step]);

	const fresh = useFreshCards(view.hand, mine, view.events);
	const handShown =
		sortBy === "melds"
			? groupGinHand(view.hand, rules)
			: sortCards(view.hand, "suit");

	const selectionKey = selection.join();
	// biome-ignore lint/correctness/useExhaustiveDependencies: runs when the selection changes.
	useEffect(() => {
		const root = rootRef.current;
		if (root) {
			findMeldTarget(root)?.scrollIntoView({ block: "nearest" });
		}
	}, [selectionKey]);

	function tap(card: CardId) {
		if (playing) {
			// A turn ends on one card, so picking another replaces it.
			setSelected((current) => (current.includes(card) ? [] : [card]));
		} else if (layingOff) {
			setSelected((current) =>
				current.includes(card)
					? current.filter((item) => item !== card)
					: [...current, card],
			);
		}
	}

	function finishTurn(type: "discard" | "knock") {
		if (!singleCard) {
			return;
		}
		flights.playFrom(singleCard, findCard(document, singleCard), () =>
			controls.act({ type, card: singleCard }),
		);
		setSelected([]);
	}

	function layOff(meld: Meld, order: CardId[]) {
		flights.playFrom(order[0], findCard(document, order[0]), () =>
			controls.act({ type: "layOff", meldId: meld.id, cards: order }),
		);
		setSelected([]);
	}

	const hint = ginHint(turn, view, {
		cards,
		fmt,
		serverErrors,
		knocker,
	});
	const meldKind = (meld: Meld) =>
		meld.kind === "set" ? cards.rummy.meldSet : cards.rummy.meldRun;

	const finished = view.phase === "finished";
	const handDone = view.phase === "handOver" || finished;
	const result = view.result;
	const best = Math.max(...view.totals);
	const standings = view.totals
		.map((total, seat) => ({ total, seat }))
		.sort((a, b) => b.total - a.total);
	const handLabel = fmt(cards.gin.handLabel, {
		round: view.round,
		target: view.targetScore,
	});

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
					<span className="seat-note hidden px-2 sm:block">{handLabel}</span>
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
								sortBy === "melds"
									? cards.table.sortBySuit
									: cards.gin.sortByMelds
							}
							onClick={() =>
								setSortBy((current) => (current === "melds" ? "suit" : "melds"))
							}
						>
							<ArrowDownUp className="h-4 w-4" aria-hidden="true" />
							<span>
								{sortBy === "melds"
									? cards.table.sortBySuit
									: cards.gin.sortByMelds}
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
					note={(seat) =>
						view.scores.length > 0
							? plural(locale, view.totals[seat], cards.rummy.totalPoints)
							: " "
					}
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
										label: cards.gin.drawStock,
										run: () => controls.act({ type: "drawStock" }),
										pulse: true,
									}
								: undefined
						}
						discardAction={
							turn.canTakeDiscard && view.top
								? {
										label: fmt(cards.gin.takeDiscard, {
											card: cardName(view.top),
										}),
										run: () => controls.act({ type: "takeDiscard" }),
										pulse: true,
									}
								: undefined
						}
					/>
					<div className="meld-area">
						{view.knock === null ? (
							<p className="meld-empty">{handLabel}</p>
						) : null}
						{view.melds.map((meld) => {
							const order = ginLayoffOrder(turn, meld);
							const kind = meldKind(meld).toLowerCase();
							const faces = meldCardNames(cards, meld);
							const content = meld.cards.map((card, index) => (
								<PlayingCard
									key={card}
									card={card}
									label={order ? undefined : faces[index]}
								/>
							));
							return order ? (
								<button
									key={meld.id}
									type="button"
									className="meld"
									{...meldTargetAttr}
									{...zoneAttr(meldZone(meld.id))}
									aria-label={`${fmt(cards.gin.layOffOn, { kind })}: ${faces.join(", ")}`}
									onClick={() => layOff(meld, order)}
								>
									{content}
								</button>
							) : (
								<section
									key={meld.id}
									className="meld"
									{...zoneAttr(meldZone(meld.id))}
									aria-label={`${fmt(cards.gin.knockerMelds, { name: knocker })}: ${meldKind(meld)}`}
								>
									{content}
								</section>
							);
						})}
						{view.knockerDeadwood.length > 0 ? (
							<section
								className="meld"
								data-deadwood="true"
								aria-label={fmt(cards.gin.knockerDeadwood, { name: knocker })}
							>
								{sortCards(view.knockerDeadwood, "suit").map((card) => (
									<PlayingCard key={card} card={card} label={cardName(card)} />
								))}
							</section>
						) : null}
					</div>
				</div>
			}
			status={
				<TurnStatus
					table={table}
					controls={controls}
					events={view.events}
					turn={view.turn}
					live={live}
					mine={mine}
					hint={
						hint ??
						(view.phase === "layoff" && !mine
							? fmt(cards.gin.layoffWait, {
									name: seatName(cards, table, view.turn),
								})
							: null)
					}
				>
					{turn.deadwood !== null ? (
						<span className="seat-note self-center px-2">
							{fmt(cards.gin.deadwood, { points: turn.deadwood })}
						</span>
					) : null}
					{turn.canKnock ? (
						<button
							type="button"
							className="btn-gold"
							disabled={controls.pending}
							onClick={() => finishTurn("knock")}
						>
							{turn.gin
								? cards.gin.goGin
								: fmt(cards.gin.knock, { deadwood: turn.knockDeadwood ?? 0 })}
						</button>
					) : null}
					{turn.canDiscard ? (
						<button
							type="button"
							className={turn.canKnock ? "btn-ghost" : "btn-gold"}
							disabled={controls.pending}
							onClick={() => finishTurn("discard")}
						>
							{cards.gin.discardCard}
						</button>
					) : null}
					{layingOff ? (
						<button
							type="button"
							className="btn-gold"
							disabled={controls.pending}
							onClick={() => controls.act({ type: "finishLayoff" })}
						>
							{cards.gin.finishLayoff}
						</button>
					) : null}
					{selection.length > 1 ? (
						<button
							type="button"
							className="btn-ghost"
							onClick={() => setSelected([])}
						>
							{cards.rummy.clearSelection}
						</button>
					) : null}
				</TurnStatus>
			}
			hand={
				<Hand
					cards={handShown}
					label={cards.table.handLabel}
					fresh={fresh}
					render={(card, style) => (
						<button
							type="button"
							className="hand-card"
							style={style}
							{...cardAttr(card)}
							aria-label={cardName(card)}
							aria-pressed={selection.includes(card)}
							aria-disabled={!playing && !layingOff}
							data-selected={selection.includes(card)}
							data-new={fresh.has(card)}
							onClick={() => tap(card)}
						>
							<PlayingCard card={card} />
						</button>
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
						<p className="mb-3 text-sm font-semibold">{handLabel}</p>
						<ScoreBoard
							table={table}
							scores={view.scores}
							totals={view.totals}
							empty={cards.gin.noScores}
							totalLabel={cards.gin.scoreTotal}
						/>
						<p className="mt-3 text-sm text-[var(--ivory-muted)]">
							{fmt(cards.gin.firstTo, { target: view.targetScore })}
						</p>
					</Sheet>
					<Sheet
						open={handDone && !resultShown && result !== null}
						dismissable={finished}
						title={fmt(cards.gin.handOver, { round: view.round })}
						onClose={() => {
							if (finished) {
								setResultShown(true);
							}
						}}
					>
						{result ? (
							<>
								<p className="mb-3 text-base font-bold">
									{ginResultText(result, words, table)}
								</p>
								<ul className="mb-4 flex flex-col gap-3">
									{result.shown.map((shown, seat) => (
										// biome-ignore lint/suspicious/noArrayIndexKey: seats are fixed during a game.
										<li key={seat}>
											<p className="mb-1 text-xs font-semibold">
												{seatName(cards, table, seat)}
											</p>
											<ShownHand
												shown={shown}
												deadwood={result.deadwood[seat]}
											/>
										</li>
									))}
								</ul>
								<div className="mb-4">
									<ScoreBoard
										table={table}
										scores={view.scores}
										totals={view.totals}
										empty={cards.gin.noScores}
										totalLabel={cards.gin.scoreTotal}
									/>
								</div>
							</>
						) : null}
						{!finished && you === null ? (
							<p className="status-hint sheet-foot">
								{cards.gin.waitingNextHand}
							</p>
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
										? cards.rummy.seeResult
										: fmt(cards.gin.nextHand, { round: view.round + 1 })}
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
								you !== null && view.winners.includes(you)
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
