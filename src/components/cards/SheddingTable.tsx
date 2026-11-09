import { isRedSuit, suitColor } from "@arcadeclub/core/cards/art";
import { type CardId, SUITS, type Suit } from "@arcadeclub/core/cards/deck";
import { type CardGame, familyRules } from "@arcadeclub/core/cards/engine";
import { powerOf, type SheddingView } from "@arcadeclub/core/cards/shedding";
import {
	seatName,
	sheddingHint,
	sortCards,
} from "@arcadeclub/core/cards/table-view";
import { RotateCcw, RotateCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { fmt, plural, useI18n, useMessages } from "#/lib/i18n";
import { Sheet } from "./Chrome";
import { EndOverlay } from "./EndOverlay";
import { PlayingCard, SuitIcon, useCardName } from "./PlayingCard";
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
import { cardAttr } from "./zones";

const SHAKE_MS = 300;

const NO_MELD = () => null;

export function SheddingTable({
	game,
	table,
	view,
	controls,
}: {
	game: CardGame;
	table: CardTableBundle;
	view: SheddingView;
	controls: CardTableControls;
}) {
	const { locale } = useI18n();
	const cards = useMessages().games.cards;
	const words = useCardWords();
	const cardName = useCardName();
	const rootRef = useRef<HTMLDivElement>(null);
	const [picking, setPicking] = useState<CardId | null>(null);
	const [armed, setArmed] = useState(false);
	const [shake, setShake] = useState<CardId | null>(null);
	const shakeTimers = useRef(new Set<number>());
	const flights = useFlights(
		rootRef,
		view.events,
		table.you,
		table.seats.length,
		NO_MELD,
	);

	const rules = familyRules(game, table.options, "shedding");
	const name = cards.games[game.id].name;
	const you = table.you;
	const playing = view.phase === "playing";
	const mine = playing && view.turn === you;
	const legal = new Set(view.legal);
	const callable =
		mine &&
		rules?.lastCardPenalty !== null &&
		view.hand.length === 2 &&
		view.legal.length > 0;

	// Armed for this last card only: drawing instead must not carry it to the next.
	useEffect(() => {
		if (!callable) {
			setArmed(false);
		}
	}, [callable]);

	useEffect(() => {
		const timers = shakeTimers.current;
		return () => {
			for (const timer of timers) {
				window.clearTimeout(timer);
			}
		};
	}, []);

	function play(card: CardId, suit?: Suit) {
		controls.act({
			type: "play",
			card,
			suit,
			callLast: callable && armed ? true : undefined,
		});
		setArmed(false);
	}

	function tap(card: CardId, element: HTMLElement) {
		if (!mine || !legal.has(card) || controls.pending) {
			setShake(card);
			const timer = window.setTimeout(() => {
				shakeTimers.current.delete(timer);
				setShake(null);
			}, SHAKE_MS);
			shakeTimers.current.add(timer);
			return;
		}
		flights.playFrom(card, element, () => {
			if (rules && powerOf(rules, card)?.kind === "chooseSuit") {
				setPicking(card);
				return;
			}
			play(card);
		});
	}

	const hint = sheddingHint(view, mine, words);

	const fresh = useFreshCards(view.hand, mine, view.events);
	const debtor = view.lastCardDebtor;
	const catchable =
		you !== null && debtor !== null && debtor !== you ? debtor : null;
	const canDraw = mine && view.canDraw;

	return (
		<TableFrame
			game={game}
			rootRef={rootRef}
			table={table}
			name={name}
			error={controls.error}
			flightLayer={flights.layer}
			seats={
				<SeatRow
					table={table}
					handCounts={view.handCounts}
					turn={playing ? view.turn : null}
					flash={flights.flash}
					controls={controls}
					onCatch={
						catchable === null
							? undefined
							: {
									seat: catchable,
									run: () => controls.act({ type: "catch", target: catchable }),
								}
					}
				/>
			}
			center={
				<>
					<Piles
						stockCount={view.stockCount}
						top={view.top}
						underTop={view.underTop}
						landing={flights.landing}
						stockAction={
							canDraw
								? {
										label: drawLabel(),
										run: () => controls.act({ type: "draw" }),
										pulse: view.legal.length === 0 || view.pendingDraw > 0,
									}
								: undefined
						}
					>
						{table.seats.length > 2 ? (
							<span
								key={view.direction}
								className="direction-mark"
								role="img"
								aria-label={
									view.direction === 1
										? cards.table.directionClockwise
										: cards.table.directionCounter
								}
							>
								{view.direction === 1 ? (
									<RotateCw aria-hidden="true" />
								) : (
									<RotateCcw aria-hidden="true" />
								)}
							</span>
						) : null}
					</Piles>
					<div className="table-flags">
						{view.pendingDraw > 0 ? (
							<span className="flag" data-tone="danger">
								{fmt(cards.shedding.pendingDraw, { count: view.pendingDraw })}
							</span>
						) : null}
						{view.activeSuit ? (
							<span
								className="flag"
								data-tone={isRedSuit(view.activeSuit) ? "red" : undefined}
							>
								<SuitIcon suit={view.activeSuit} />
								{fmt(cards.shedding.chosenSuit, {
									suit: cards.suits[view.activeSuit],
								})}
							</span>
						) : null}
						{view.openTable && view.pendingDraw === 0 ? (
							<span className="flag">{cards.shedding.openTable}</span>
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
					live={playing}
					mine={mine}
					hint={hint}
				>
					{view.canCallLast ? (
						<button
							type="button"
							className="btn-gold call-pulse"
							onClick={() => controls.act({ type: "callLast" })}
						>
							{cards.shedding.callLast}
						</button>
					) : null}
					{callable ? (
						<button
							type="button"
							className="btn-ghost toggle-chip"
							aria-pressed={armed}
							title={cards.shedding.callLastHint}
							onClick={() => setArmed((current) => !current)}
						>
							{armed ? cards.shedding.callLastArmed : cards.shedding.callLast}
						</button>
					) : null}
					{canDraw ? (
						<button
							type="button"
							className={
								view.legal.length === 0 || view.pendingDraw > 0
									? "btn-gold"
									: "btn-ghost"
							}
							disabled={controls.pending}
							onClick={() => controls.act({ type: "draw" })}
						>
							{drawLabel()}
						</button>
					) : null}
					{mine && view.canPass ? (
						<button
							type="button"
							className="btn-ghost"
							disabled={controls.pending}
							onClick={() => controls.act({ type: "pass" })}
						>
							{cards.shedding.pass}
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
						return (
							<button
								type="button"
								className="hand-card"
								style={style}
								{...cardAttr(card)}
								aria-label={cardName(card)}
								aria-disabled={!canPlay}
								data-legal={canPlay}
								data-dim={mine && !canPlay}
								data-new={fresh.has(card)}
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
						open={picking !== null}
						title={cards.shedding.chooseSuit}
						onClose={() => setPicking(null)}
					>
						<div className="grid grid-cols-4 gap-2">
							{SUITS.map((suit) => (
								<button
									key={suit}
									type="button"
									className="suit-choice"
									style={{ color: suitColor(suit) }}
									onClick={() => {
										if (picking) {
											play(picking, suit);
										}
										setPicking(null);
									}}
								>
									<SuitIcon suit={suit} />
									{cards.suits[suit]}
								</button>
							))}
						</div>
					</Sheet>
					{view.phase === "finished" ? (
						<EndOverlay
							table={table}
							winners={view.winners}
							controls={controls}
							title={
								you !== null && view.winners.includes(you)
									? cards.shedding.youWin
									: fmt(cards.shedding.winner, {
											name: view.winners
												.map((seat) => seatName(cards, table, seat))
												.join(" & "),
										})
							}
						>
							<table className="score-table mt-4 text-left">
								<thead>
									<tr>
										<th scope="col">{cards.table.playerHeading}</th>
										<th scope="col">{cards.shedding.standings}</th>
									</tr>
								</thead>
								<tbody>
									{view.handCounts
										.map((count, seat) => ({ count, seat }))
										.sort((a, b) => a.count - b.count)
										.map(({ count, seat }) => (
											<tr key={seat}>
												<td>{seatName(cards, table, seat)}</td>
												<td>{count === 0 ? cards.table.noCards : count}</td>
											</tr>
										))}
								</tbody>
							</table>
						</EndOverlay>
					) : null}
				</>
			}
		/>
	);

	function drawLabel() {
		return view.pendingDraw > 0
			? plural(locale, view.pendingDraw, cards.shedding.drawPenalty)
			: cards.shedding.draw;
	}
}
