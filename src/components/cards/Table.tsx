import type { CardId } from "@arcadeclub/core/cards/deck";
import {
	type CardGameDefinition,
	SEAT_SILENT_AFTER_MS,
} from "@arcadeclub/core/cards/engine";
import type { CardEvent } from "@arcadeclub/core/cards/events";
import { buildInviteUrl } from "@arcadeclub/core/sessions";
import { Bot, MoreHorizontal, ScrollText } from "lucide-react";
import {
	type CSSProperties,
	type ReactNode,
	type RefObject,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { FullscreenGameShell } from "#/components/games/FullscreenGameShell";
import { fmt, plural, useI18n, useMessages } from "#/lib/i18n";
import { CardCrumbs, Sheet } from "./Chrome";
import { cardTilt, describeEvent, seatName } from "./format";
import { CardSprite, PlayingCard, useCardName } from "./PlayingCard";
import { RulesSheet } from "./RulesSheet";
import type { CardTableBundle, CardTableControls } from "./useCardTable";

const FAN_SLOTS = [0, 1, 2, 3, 4];

const SEAT_TONES = [
	["#3f6fd8", "#1d2f6b"],
	["#d0713a", "#7a2f12"],
	["#3aa17e", "#0f4c38"],
	["#a858c9", "#512368"],
	["#c9a233", "#6e5310"],
	["#d0506f", "#6c1730"],
	["#3a9fc4", "#104d66"],
	["#8d8fa3", "#3b3c4e"],
];

function initialOf(name: string) {
	return [...name.trim()][0]?.toUpperCase() ?? "?";
}

/** The other seats, in the order play reaches them, so the table reads clockwise. */
export function SeatRow({
	table,
	handCounts,
	turn,
	flash,
	note,
	onCatch,
	controls,
}: {
	table: CardTableBundle;
	handCounts: readonly number[];
	turn: number | null;
	flash: number | null;
	/** Family-specific line under a name, such as a running score. */
	note?: (seat: number) => ReactNode;
	onCatch?: { seat: number; run: () => void };
	controls: CardTableControls;
}) {
	const { locale } = useI18n();
	const cards = useMessages().games.cards;
	const [menuSeat, setMenuSeat] = useState<number | null>(null);
	const [now, setNow] = useState(() => Date.now());

	useEffect(() => {
		const timer = window.setInterval(() => setNow(Date.now()), 15_000);
		return () => window.clearInterval(timer);
	}, []);

	const seatCount = table.seats.length;
	const you = table.you;
	const order =
		you === null
			? table.seats.map((_, index) => index)
			: Array.from(
					{ length: seatCount - 1 },
					(_, step) => (you + step + 1) % seatCount,
				);

	return (
		<>
			<ul
				className="seat-row"
				data-dense={order.length > 4}
				style={{ "--seats": order.length } as CSSProperties}
			>
				{order.map((seat, position) => {
					const entry = table.seats[seat];
					const name = seatName(cards, table, seat);
					const human = entry.botIndex === null;
					const silent =
						human &&
						!entry.autopilot &&
						entry.lastSeen !== null &&
						now - entry.lastSeen > SEAT_SILENT_AFTER_MS;
					const canManage =
						you !== null &&
						human &&
						!entry.autopilot &&
						(table.isHost || silent);
					const centred = (position + 0.5) / order.length;
					const arc = (2 * centred - 1) ** 2;
					const [toneA, toneB] = SEAT_TONES[seat % SEAT_TONES.length];
					const count = handCounts[seat] ?? 0;
					return (
						<li
							key={seat}
							className="seat"
							data-zone={`seat-${seat}`}
							data-active={turn === seat}
							data-offline={silent}
							data-flash={flash === seat}
							style={{ "--arc": arc } as CSSProperties}
						>
							<div
								className="seat-disc"
								style={
									{ "--seat-a": toneA, "--seat-b": toneB } as CSSProperties
								}
							>
								<span className="seat-fan" aria-hidden="true">
									{FAN_SLOTS.slice(0, Math.min(count, FAN_SLOTS.length)).map(
										(index) => (
											<span
												key={index}
												style={
													{
														"--i": index,
														"--fan": Math.min(count, FAN_SLOTS.length),
													} as CSSProperties
												}
												className="seat-fan-card"
											>
												<PlayingCard card={null} />
											</span>
										),
									)}
								</span>
								{entry.autopilot && human ? (
									<Bot className="h-1/2 w-1/2" aria-hidden="true" />
								) : (
									<span aria-hidden="true">{initialOf(name)}</span>
								)}
								<span className="seat-count">
									<span className="sr-only">
										{plural(locale, count, cards.table.cardsLeft)}
									</span>
									<span aria-hidden="true">{count}</span>
								</span>
							</div>
							<p className="seat-name">{name}</p>
							{silent ? (
								<p className="seat-note">{cards.table.offline}</p>
							) : note?.(seat) ? (
								<p className="seat-note">{note(seat)}</p>
							) : null}
							{onCatch?.seat === seat ? (
								<button
									type="button"
									className="catch-btn"
									onClick={onCatch.run}
								>
									{fmt(cards.shedding.catch, { name })}
								</button>
							) : null}
							{canManage ? (
								<button
									type="button"
									className="seat-manage"
									aria-label={fmt(cards.table.seatMenu, { name })}
									onClick={() => setMenuSeat(seat)}
								>
									<MoreHorizontal className="h-4 w-4" />
								</button>
							) : null}
						</li>
					);
				})}
			</ul>
			<Sheet
				open={menuSeat !== null}
				title={
					menuSeat === null
						? ""
						: fmt(cards.table.seatMenu, {
								name: seatName(cards, table, menuSeat),
							})
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
						{fmt(cards.table.autopilotOn, {
							name: seatName(cards, table, menuSeat),
						})}
					</button>
				)}
			</Sheet>
		</>
	);
}

/** The stock and the discard pile. Either can be a button when it is yours to take. */
export function Piles({
	stockCount,
	top,
	underTop,
	landing,
	stockAction,
	discardAction,
	children,
}: {
	stockCount: number;
	top: CardId | null;
	underTop: readonly CardId[];
	landing: boolean;
	stockAction?: { label: string; run: () => void; pulse?: boolean };
	discardAction?: { label: string; run: () => void; pulse?: boolean };
	children?: ReactNode;
}) {
	const { locale } = useI18n();
	const cards = useMessages().games.cards;
	const cardName = useCardName();
	const countLabel = plural(locale, stockCount, cards.table.stockCount);
	const stockFace = (
		<>
			{stockCount > 2 ? <PlayingCard card={null} /> : null}
			{stockCount > 1 ? <PlayingCard card={null} /> : null}
			{stockCount > 0 ? (
				<PlayingCard card={null} />
			) : (
				<span className="pile-empty" />
			)}
			<span className="pile-count">{countLabel}</span>
		</>
	);
	const discardFace = (
		<>
			{top === null ? <span className="pile-empty" /> : null}
			{underTop.map((card) => (
				<TiltedCard key={card} card={card} />
			))}
			{top ? <TiltedCard key={top} card={top} label={cardName(top)} /> : null}
		</>
	);
	return (
		<div className="piles">
			{children}
			{stockAction ? (
				<button
					type="button"
					className="pile pile-stock"
					data-zone="stock"
					data-pulse={stockAction.pulse}
					aria-label={`${stockAction.label}. ${countLabel}`}
					onClick={stockAction.run}
				>
					{stockFace}
				</button>
			) : (
				<div
					className="pile pile-stock"
					data-zone="stock"
					role="img"
					aria-label={`${cards.table.stock}: ${countLabel}`}
				>
					{stockFace}
				</div>
			)}
			{discardAction ? (
				<button
					type="button"
					className="pile"
					data-zone="discard"
					data-landing={landing}
					data-pulse={discardAction.pulse}
					aria-label={discardAction.label}
					onClick={discardAction.run}
				>
					{discardFace}
				</button>
			) : (
				<section
					className="pile"
					data-zone="discard"
					data-landing={landing}
					aria-label={cards.table.discard}
				>
					{discardFace}
				</section>
			)}
		</div>
	);
}

function TiltedCard({ card, label }: { card: CardId; label?: string }) {
	return (
		<span
			className="pile-card"
			style={{ transform: `rotate(${cardTilt(card)}deg)` }}
		>
			<PlayingCard card={card} label={label} />
		</span>
	);
}

export function AutopilotBack({
	controls,
	seat,
}: {
	controls: CardTableControls;
	seat: number;
}) {
	const cards = useMessages().games.cards;
	return (
		<button
			type="button"
			className="btn-gold"
			onClick={() => controls.setAutopilot(seat, false)}
		>
			{cards.table.autopilotBack}
		</button>
	);
}

const NO_CARDS: ReadonlySet<CardId> = new Set();

/** From here on a phone shows smaller cards rather than a hand to scroll. */
const MANY_CARDS = 12;
/** Room left beside a card scrolled into view, clear of the hand's edge fade. */
const FRESH_CARD_MARGIN = 24;

/**
 * The cards that just arrived in this hand, so a draw can be found in a sorted
 * fan. They stay marked until the player's next turn begins. A new deal marks
 * nothing: a rematch restarts the event log, so its newest event number drops.
 */
export function useFreshCards(
	hand: readonly CardId[],
	mine: boolean,
	events: readonly CardEvent[],
) {
	const previous = useRef<readonly CardId[] | null>(null);
	const wasMine = useRef(mine);
	const lastDeal = useRef<number | null>(null);
	const lastSeq = useRef<number | null>(null);
	const [fresh, setFresh] = useState(NO_CARDS);

	useEffect(() => {
		const before = previous.current;
		const turnBegan = mine && !wasMine.current;
		const dealSeq = [...events]
			.reverse()
			.find((event) => event.type === "deal")?.seq;
		const newestSeq = events.at(-1)?.seq ?? null;
		const dealt =
			(dealSeq !== undefined && dealSeq !== lastDeal.current) ||
			(newestSeq !== null &&
				lastSeq.current !== null &&
				newestSeq < lastSeq.current);
		previous.current = hand;
		wasMine.current = mine;
		lastDeal.current = dealSeq ?? lastDeal.current;
		lastSeq.current = newestSeq;
		const added =
			before && !dealt ? hand.filter((card) => !before.includes(card)) : [];
		setFresh((current) => {
			const kept =
				turnBegan || dealt
					? []
					: [...current].filter((card) => hand.includes(card));
			const next = [...kept, ...added];
			return next.length === current.size &&
				next.every((card) => current.has(card))
				? current
				: new Set(next);
		});
	}, [hand, mine, events]);

	return fresh;
}

/** Cards laid out to fill the width, overlapping only as much as they must. */
export function Hand({
	cards: hand,
	label,
	fresh,
	render,
}: {
	cards: readonly CardId[];
	label: string;
	/** Scrolled to on arrival: in a hand that scrolls, a draw can land out of sight. */
	fresh: ReadonlySet<CardId>;
	render: (
		card: CardId,
		style: CSSProperties,
		ref: { index: number; total: number },
	) => ReactNode;
}) {
	const scroller = useRef<HTMLUListElement>(null);
	const [metrics, setMetrics] = useState({ width: 0, card: 80 });
	const many = hand.length >= MANY_CARDS;

	// biome-ignore lint/correctness/useExhaustiveDependencies: `many` changes the card size being measured.
	useLayoutEffect(() => {
		const element = scroller.current;
		if (!element) {
			return;
		}
		const measure = () => {
			const style = getComputedStyle(element);
			const padding =
				Number.parseFloat(style.paddingLeft) +
				Number.parseFloat(style.paddingRight);
			const card = element.querySelector<HTMLElement>(".pc")?.offsetWidth ?? 80;
			setMetrics({ width: element.clientWidth - padding, card });
		};
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(element);
		return () => observer.disconnect();
	}, [many]);

	useEffect(() => {
		const list = scroller.current;
		const newest = [...fresh].at(-1);
		const card = newest && list?.querySelector(`[data-card-id="${newest}"]`);
		if (!list || !card) {
			return;
		}
		const { left, right } = card.getBoundingClientRect();
		const bounds = list.getBoundingClientRect();
		const past =
			left < bounds.left
				? left - bounds.left - FRESH_CARD_MARGIN
				: right > bounds.right
					? right - bounds.right + FRESH_CARD_MARGIN
					: 0;
		list.scrollBy({ left: past });
	}, [fresh]);

	const total = hand.length;
	// Wide enough to hit with a thumb: past this the hand scrolls instead of squeezing.
	const minStep = Math.max(30, metrics.card * 0.3);
	const ideal = metrics.card + 6;
	const fit = total > 1 ? (metrics.width - metrics.card) / (total - 1) : ideal;
	const step = Math.max(minStep, Math.min(ideal, fit));
	const overlap = step - metrics.card;
	const fanned = fit >= minStep && total > 1;
	const spread = Math.min(2.2, 22 / Math.max(total, 1));

	return (
		<div className="hand-wrap" data-zone="hand" data-many={many}>
			<ul
				ref={scroller}
				className="hand"
				data-scrolls={total > 1 && !fanned}
				aria-label={label}
				style={{ "--overlap": `${overlap}px` } as CSSProperties}
			>
				{hand.map((card, index) => {
					const middle = (total - 1) / 2;
					const offset = index - middle;
					return (
						<li key={card} className="contents">
							{render(
								card,
								{
									"--tilt": fanned ? `${offset * spread}deg` : "0deg",
									"--dip":
										fanned && middle > 0
											? ((offset / middle) ** 2 - 1) * 12
											: 0,
								} as CSSProperties,
								{ index, total },
							)}
						</li>
					);
				})}
			</ul>
		</div>
	);
}

/** Means little alone: "Anna misses a turn" doesn't say who played what. */
const FOLLOWS_A_PLAY: ReadonlySet<CardEvent["type"]> = new Set([
	"skip",
	"reverse",
	"again",
]);

/** The latest thing that happened. A polite live region narrates play for screen readers. */
export function EventTicker({
	events,
	table,
}: {
	events: readonly CardEvent[];
	table: CardTableBundle;
}) {
	const { locale } = useI18n();
	const cards = useMessages().games.cards;
	const cardName = useCardName();
	const latest = events.at(-1);
	const describe = (event: CardEvent) =>
		describeEvent(event, cards, locale, table, cardName);
	const before =
		latest && FOLLOWS_A_PLAY.has(latest.type)
			? events.slice(-3, -1).find((event) => event.type === "play")
			: null;
	const text = latest
		? [before, latest]
				.filter((event) => event != null)
				.map(describe)
				.join(" ")
		: "";
	return (
		<p className="ticker" aria-live="polite">
			{text}
		</p>
	);
}

/** The shared table: felt, header, opponents, and the family's middle and hand. */
export function TableFrame({
	game,
	rootRef,
	table,
	name,
	seats,
	center,
	status,
	hand,
	flightLayer,
	topExtra,
	overlays,
	error,
}: {
	game: CardGameDefinition;
	rootRef: RefObject<HTMLDivElement | null>;
	table: CardTableBundle;
	name: string;
	seats: ReactNode;
	center: ReactNode;
	status: ReactNode;
	hand: ReactNode;
	flightLayer: ReactNode;
	topExtra?: ReactNode;
	overlays?: ReactNode;
	error: string;
}) {
	const cards = useMessages().games.cards;
	const [rulesOpen, setRulesOpen] = useState(false);
	return (
		<FullscreenGameShell title={name}>
			<div ref={rootRef} className="cards-felt" data-felt={game.felt}>
				<CardSprite />
				<div className="table-grid" data-extra-controls={Boolean(topExtra)}>
					<header className="table-top">
						<CardCrumbs
							items={[
								{ label: cards.hub.kicker, to: "/cards" },
								{
									label: name,
									to: "/cards/$gameId",
									params: { gameId: game.id },
								},
								{ label: cards.table.crumb },
							]}
						/>
						<div className="table-top-actions">
							{topExtra}
							<button
								type="button"
								className="icon-chip"
								aria-label={cards.table.rules}
								onClick={() => setRulesOpen(true)}
							>
								<ScrollText className="h-4 w-4" aria-hidden="true" />
								<span>{cards.table.rules}</span>
							</button>
						</div>
					</header>
					{seats}
					<main className="table-center">
						<span className="felt-name" aria-hidden="true">
							{name}
						</span>
						{center}
					</main>
					<div className="table-status">{status}</div>
					{hand}
				</div>
				{table.you === null ? (
					<p className="seat-spectating">
						{cards.table.spectating}
						{table.session.joinCode ? (
							<a href={buildInviteUrl("", { code: table.session.joinCode })}>
								{cards.table.rejoin}
							</a>
						) : null}
					</p>
				) : null}
				{error ? (
					<p className="error-toast" role="alert">
						{error}
					</p>
				) : null}
				{flightLayer}
				{overlays}
			</div>
			<RulesSheet
				game={game}
				options={table.options}
				open={rulesOpen}
				onClose={() => setRulesOpen(false)}
			/>
		</FullscreenGameShell>
	);
}
