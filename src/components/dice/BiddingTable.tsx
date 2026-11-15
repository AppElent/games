import {
	type Bid,
	type BiddingView,
	countMatching,
	minimumQuantity,
	type Reveal,
} from "@arcadeclub/core/dice/bidding";
import type { DiceGameOf } from "@arcadeclub/core/dice/engine";
import {
	biddingNews,
	biddingStandings,
	biddingStep,
	bidText,
	defaultBid,
	diceSeatName,
	revealSentences,
	winnerTitle,
} from "@arcadeclub/core/dice/table-view";
import { seatIsSilent } from "@arcadeclub/core/table-engine";
import { Bot, Minus, MoreHorizontal, Plus } from "lucide-react";
import { useState } from "react";
import { fmt, plural, useI18n, useMessages } from "#/lib/i18n";
import { useNow } from "#/lib/use-now";
import { DieFace } from "./Die";
import {
	AutopilotNotice,
	DiceEndDialog,
	DiceTableFrame,
	useSeatMenu,
} from "./TableParts";
import type { DiceTableBundle, DiceTableControls } from "./useDiceTable";

type Props = {
	game: DiceGameOf<"bidding">;
	table: DiceTableBundle;
	view: BiddingView;
	controls: DiceTableControls;
};

const FACES = [1, 2, 3, 4, 5, 6] as const;

/** A liar's dice game in play: your cup, the bid to beat, and every player's dice left. */
export function BiddingTable({ game, table, view, controls }: Props) {
	const { locale } = useI18n();
	const dice = useMessages().games.dice;
	const words = { dice, locale };
	return (
		<DiceTableFrame
			game={game}
			table={table}
			controls={controls}
			kicker={fmt(dice.bidding.round, { round: view.round })}
			news={biddingNews(words, table, view)}
			end={
				view.phase === "finished" ? (
					<DiceEndDialog
						table={table}
						controls={controls}
						title={winnerTitle(dice, table, view.winners)}
						heading={dice.bidding.standings}
					>
						{biddingStandings(view).map(({ seat, outIn }) => (
							<li key={seat} data-winner={view.winners.includes(seat)}>
								<span className="min-w-0 flex-1 truncate">
									{diceSeatName(dice, table, seat)}
								</span>
								<span className="text-sm">
									{view.winners.includes(seat) || outIn === null
										? dice.bidding.lastStanding
										: fmt(dice.bidding.outIn, { round: outIn })}
								</span>
							</li>
						))}
					</DiceEndDialog>
				) : null
			}
		>
			<div className="dice-layout">
				<YourCup table={table} view={view} controls={controls} />
				<BidBoard table={table} view={view} controls={controls} />
			</div>
		</DiceTableFrame>
	);
}

type PanelProps = Omit<Props, "game">;

/** Your own dice, which no one else sees, and the bid or call you make with them. */
function YourCup({ table, view, controls }: PanelProps) {
	const dice = useMessages().games.dice;
	const bidding = dice.bidding;
	const you = table.you;
	const step = biddingStep(view, you);
	const mine = step === "open" || step === "raise";
	const status =
		step === "over"
			? null
			: step === "open"
				? bidding.yourTurnOpen
				: step === "raise"
					? bidding.yourTurnRaise
					: fmt(bidding.theirTurn, {
							name: diceSeatName(dice, table, view.turn),
						});

	return (
		<section className="cards-panel dice-tray" aria-label={bidding.yourDice}>
			<p className="dice-status" data-mine={mine} aria-live="polite">
				{status}
			</p>
			{you === null ? null : step === "out" ? (
				<p className="dice-empty">{bidding.outOfDice}</p>
			) : (
				<>
					<ul
						className="dice-row"
						aria-label={fmt(bidding.yourDiceLabel, {
							dice: view.yourDice.join(", "),
						})}
					>
						{view.yourDice.map((value, index) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: a new round rolls every cup again, so the dice tumble again.
							<li key={`${view.round}-${index}`} aria-hidden="true">
								<span className="die" data-fresh="true">
									<DieFace value={value} />
								</span>
							</li>
						))}
					</ul>
					<p className="dice-hint">{bidding.yourDiceHint}</p>
				</>
			)}
			{view.rules.wildOnes ? (
				<p className="text-sm text-[var(--ivory-muted)]">{bidding.wildNote}</p>
			) : null}
			{mine ? (
				// A new bid starts the picker over from the new lowest bid.
				<BidPicker
					key={`${view.round}:${view.bids.length}`}
					view={view}
					controls={controls}
				/>
			) : null}
			<AutopilotNotice table={table} controls={controls} />
		</section>
	);
}

/** How many dice and which face, never lower than the bid to beat; or call it. */
function BidPicker({
	view,
	controls,
}: {
	view: BiddingView;
	controls: DiceTableControls;
}) {
	const { locale } = useI18n();
	const dice = useMessages().games.dice;
	const bidding = dice.bidding;
	const previous = view.bids.at(-1) ?? null;
	const start = defaultBid(view);
	const [face, setFace] = useState(start?.face ?? previous?.face ?? 2);
	const least = minimumQuantity(previous, face, view.rules);
	const [chosen, setChosen] = useState(start?.quantity ?? least);
	const quantity = Math.max(chosen, least);
	const bid: Bid = { quantity, face };
	const canBid = quantity <= view.totalDice && !controls.pending;

	return (
		<div className="bid-picker">
			<div className="bid-field">
				<span className="cards-kicker">{bidding.quantity}</span>
				<div className="bid-stepper">
					<button
						type="button"
						className="stepper-btn"
						aria-label={bidding.fewer}
						disabled={quantity <= least}
						onClick={() => setChosen(quantity - 1)}
					>
						<Minus className="h-4 w-4" />
					</button>
					<output aria-live="polite" className="bid-quantity">
						{quantity}
					</output>
					<button
						type="button"
						className="stepper-btn"
						aria-label={bidding.more}
						disabled={quantity >= view.totalDice}
						onClick={() => setChosen(quantity + 1)}
					>
						<Plus className="h-4 w-4" />
					</button>
				</div>
			</div>
			<fieldset className="bid-field">
				<legend className="cards-kicker">{bidding.face}</legend>
				<div className="bid-faces">
					{FACES.map((value) => (
						<button
							key={value}
							type="button"
							className="die bid-face"
							aria-pressed={face === value}
							aria-label={fmt(bidding.faceButton, { face: value })}
							disabled={
								minimumQuantity(previous, value, view.rules) > view.totalDice
							}
							onClick={() => setFace(value)}
						>
							<DieFace value={value} />
						</button>
					))}
				</div>
			</fieldset>
			<div className="dice-actions">
				<button
					type="button"
					className="btn-gold min-h-12 text-lg"
					disabled={!canBid}
					onClick={() => controls.act({ type: "bid", quantity, face })}
				>
					{fmt(bidding.placeBid, { bid: bidText({ dice, locale }, bid) })}
				</button>
				{previous ? (
					<div className="bid-calls">
						<button
							type="button"
							className="btn-ghost"
							disabled={controls.pending}
							onClick={() => controls.act({ type: "liar" })}
						>
							{bidding.liar}
						</button>
						{view.rules.spotOn ? (
							<button
								type="button"
								className="btn-ghost"
								disabled={controls.pending}
								onClick={() => controls.act({ type: "spotOn" })}
							>
								{bidding.spotOn}
							</button>
						) : null}
					</div>
				) : null}
			</div>
		</div>
	);
}

/** The bid to beat, who is still in with how many dice, and how the last round ended. */
function BidBoard({ table, view, controls }: PanelProps) {
	const { locale } = useI18n();
	const dice = useMessages().games.dice;
	const bidding = dice.bidding;
	const now = useNow(15_000);
	const menu = useSeatMenu(table, controls, now);
	const words = { dice, locale };
	const name = (seat: number) => diceSeatName(dice, table, seat);
	const current = view.bids.at(-1);

	return (
		<section className="cards-panel bid-board">
			<div className="bid-current">
				<p className="cards-kicker">{bidding.currentBid}</p>
				{current ? (
					<>
						<p className="bid-current-text">
							<span className="die bid-current-die" aria-hidden="true">
								<DieFace value={current.face} />
							</span>
							<span>{bidText(words, current)}</span>
						</p>
						<p className="text-sm text-[var(--ivory-muted)]">
							{fmt(bidding.bidBy, { name: name(current.seat) })}
						</p>
					</>
				) : (
					<p className="text-[var(--ivory-muted)]">{bidding.noBid}</p>
				)}
				<p className="text-sm text-[var(--ivory-muted)]">
					{plural(locale, view.totalDice, bidding.onTable)}
				</p>
			</div>

			<h2 className="cards-kicker mt-4 mb-2">{bidding.players}</h2>
			<ul className="bid-seats">
				{view.diceCounts.map((count, seat) => {
					const entry = table.seats[seat];
					const human = entry.botIndex === null;
					const active = view.phase === "playing" && view.turn === seat;
					return (
						<li
							// biome-ignore lint/suspicious/noArrayIndexKey: seats never reorder
							key={seat}
							data-active={active}
							data-out={count === 0}
							aria-current={active ? "true" : undefined}
						>
							<span className="score-name min-w-0 flex-1">
								{entry.autopilot && human ? (
									<Bot className="h-3.5 w-3.5" aria-hidden="true" />
								) : null}
								<span className="truncate">{name(seat)}</span>
								{seatIsSilent(entry, now) ? (
									<span className="score-note">{dice.table.offline}</span>
								) : null}
							</span>
							<span className="bid-count">
								{count === 0
									? bidding.out
									: plural(locale, count, bidding.diceLeft)}
							</span>
							{menu.canManage(seat) ? (
								<button
									type="button"
									className="score-manage"
									aria-label={fmt(dice.table.seatMenu, { name: name(seat) })}
									onClick={() => menu.open(seat)}
								>
									<MoreHorizontal className="h-4 w-4" />
								</button>
							) : null}
						</li>
					);
				})}
			</ul>

			{view.bids.length > 0 ? (
				<>
					<h2 className="cards-kicker mt-4 mb-2">{bidding.history}</h2>
					<ol className="bid-history">
						{view.bids.map((bid) => (
							// Each bid outranks the last, so no two in a round are alike.
							<li key={`${bid.seat}:${bid.quantity}:${bid.face}`}>
								{fmt(bidding.historyEntry, {
									name: name(bid.seat),
									bid: bidText(words, bid),
								})}
							</li>
						))}
					</ol>
				</>
			) : null}

			{view.reveal ? (
				<RevealPanel table={table} view={view} reveal={view.reveal} />
			) : null}
			{menu.sheet}
		</section>
	);
}

/** Every cup lifted at the last call, with the dice that counted picked out. */
function RevealPanel({
	table,
	view,
	reveal,
}: {
	table: DiceTableBundle;
	view: BiddingView;
	reveal: Reveal;
}) {
	const { locale } = useI18n();
	const dice = useMessages().games.dice;
	const bidding = dice.bidding;
	const name = (seat: number) => diceSeatName(dice, table, seat);
	const counts = (value: number) =>
		countMatching([value], reveal.bid.face, view.rules) > 0;

	return (
		<div className="bid-reveal">
			<h2 className="cards-kicker mb-2">{bidding.revealHeading}</h2>
			{revealSentences({ dice, locale }, table, reveal).map((sentence) => (
				<p key={sentence} className="text-sm leading-snug">
					{sentence}
				</p>
			))}
			<ul className="bid-cups">
				{reveal.cups.map((cup, seat) => (
					<li
						// biome-ignore lint/suspicious/noArrayIndexKey: seats never reorder
						key={seat}
						data-lost={reveal.losers.includes(seat)}
					>
						<span className="sr-only">
							{cup.length === 0
								? fmt(bidding.cupOut, { name: name(seat) })
								: fmt(bidding.cupOf, {
										name: name(seat),
										dice: cup.join(", "),
									})}
						</span>
						<span className="bid-cup-name" aria-hidden="true">
							{name(seat)}
						</span>
						<span className="bid-cup-dice" aria-hidden="true">
							{cup.map((value, index) => (
								<span
									// biome-ignore lint/suspicious/noArrayIndexKey: a cup's dice have no identity
									key={index}
									className="die die-small"
									data-match={counts(value)}
								>
									<DieFace value={value} />
								</span>
							))}
						</span>
					</li>
				))}
			</ul>
		</div>
	);
}
