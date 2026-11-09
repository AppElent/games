import type { CardId } from "@arcadeclub/core/cards/deck";
import type { CardEvent } from "@arcadeclub/core/cards/events";
import {
	type ReactNode,
	type RefObject,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { eventsSince } from "./events";
import { cardTilt } from "./format";
import { CARD_HEIGHT, CARD_WIDTH, PlayingCard } from "./PlayingCard";
import {
	findCardFace,
	findZone,
	isSeatZone,
	meldZone,
	seatZone as otherSeatZone,
	type Zone,
} from "./zones";

type Spot = { x: number; y: number; width: number };
type Flight = {
	id: number;
	card: CardId | null;
	from: Spot;
	to: Spot;
	tilt: number;
	delay: number;
	toDiscard: boolean;
};

const DURATION_MS = 340;
const STEP_MS = 60;
const FALLBACK_WIDTH = 40;
const MAX_CARDS_PER_EVENT = 6;
const DEAL_CARDS_PER_SEAT = 3;

/** Where `element` sits inside `root`, at its own width. */
function spotIn(root: HTMLElement, element: HTMLElement, width: number): Spot {
	const base = root.getBoundingClientRect();
	const rect = element.getBoundingClientRect();
	return {
		x: rect.left + rect.width / 2 - base.left,
		y: rect.top + rect.height / 2 - base.top,
		width,
	};
}

function spotOf(root: HTMLElement, zone: Zone): Spot | null {
	const element = findZone(root, zone);
	if (!element) {
		return null;
	}
	const card = isSeatZone(zone) ? null : findCardFace(element);
	return spotIn(
		root,
		element,
		card?.getBoundingClientRect().width ?? FALLBACK_WIDTH,
	);
}

function FlightCard({
	flight,
	onDone,
}: {
	flight: Flight;
	onDone: (flight: Flight) => void;
}) {
	const height = (flight.to.width * CARD_HEIGHT) / CARD_WIDTH;
	return (
		<div
			className="flight"
			style={
				{
					left: flight.to.x - flight.to.width / 2,
					top: flight.to.y - height / 2,
					"--card-w": `${flight.to.width}px`,
				} as React.CSSProperties
			}
			ref={(element) => {
				if (!element || element.getAnimations().length > 0) {
					return;
				}
				const dx = flight.from.x - flight.to.x;
				const dy = flight.from.y - flight.to.y;
				const scale = flight.from.width / flight.to.width;
				element
					.animate(
						[
							{
								transform: `translate(${dx}px, ${dy}px) scale(${scale}) rotate(${flight.tilt - 14}deg)`,
							},
							{
								transform: `translate(0, 0) scale(1) rotate(${flight.tilt}deg)`,
							},
						],
						{
							duration: DURATION_MS,
							delay: flight.delay,
							easing: "cubic-bezier(.22,.7,.25,1)",
							fill: "both",
						},
					)
					.finished.then(
						() => onDone(flight),
						() => onDone(flight),
					);
			}}
		>
			<PlayingCard card={flight.card} />
		</div>
	);
}

/**
 * Turns new events into cards crossing the table. The state has already moved
 * on by the time we hear about it, so a card aimed at the discard pile hides
 * the real top card (`landing`) until it arrives.
 */
export function useFlights(
	rootRef: RefObject<HTMLElement | null>,
	events: readonly CardEvent[],
	you: number | null,
	seatCount: number,
	meldCard: (meldId: number) => CardId | null,
): {
	layer: ReactNode;
	landing: boolean;
	flash: number | null;
	/**
	 * Runs `move` for a card the player just played from `element`, so its
	 * flight starts where the card was rather than at the hand's centre.
	 */
	playFrom: (
		card: CardId,
		element: HTMLElement | null,
		move: () => void,
	) => void;
} {
	const lastSeq = useRef<number | null>(null);
	const nextId = useRef(0);
	const origins = useRef(new Map<CardId, Spot>());
	const [flights, setFlights] = useState<Flight[]>([]);
	const [flash, setFlash] = useState<number | null>(null);
	const newestSeq = events.at(-1)?.seq ?? 0;

	useLayoutEffect(() => {
		const previous = lastSeq.current;
		lastSeq.current = newestSeq;
		const root = rootRef.current;
		const quiet = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		if (previous === null || newestSeq === previous || !root || quiet) {
			return;
		}
		const fresh = eventsSince(events, previous);
		const seatZone = (seat: number): Zone =>
			seat === you ? "hand" : otherSeatZone(seat);
		const planned: Flight[] = [];
		let delay = 0;

		const fly = (
			card: CardId | null,
			fromZone: Zone,
			toZone: Zone,
			from?: Spot,
		) => {
			const start = from ?? spotOf(root, fromZone);
			const end = spotOf(root, toZone);
			if (!start || !end) {
				return;
			}
			planned.push({
				id: nextId.current++,
				card,
				from: start,
				to: end,
				tilt: toZone === "discard" && card ? cardTilt(card) : 0,
				delay,
				toDiscard: toZone === "discard",
			});
			delay += STEP_MS;
		};
		const flyBacks = (count: number, fromZone: Zone, seat: number) => {
			for (let i = 0; i < Math.min(count, MAX_CARDS_PER_EVENT); i += 1) {
				fly(null, fromZone, seatZone(seat));
			}
		};

		for (const event of fresh) {
			switch (event.type) {
				case "deal":
					for (let round = 0; round < DEAL_CARDS_PER_SEAT; round += 1) {
						for (let seat = 0; seat < seatCount; seat += 1) {
							fly(null, "stock", seatZone(seat));
						}
					}
					break;
				case "play":
				case "discard":
					fly(
						event.card,
						seatZone(event.seat),
						"discard",
						event.seat === you ? origins.current.get(event.card) : undefined,
					);
					delay += STEP_MS;
					break;
				case "draw":
					flyBacks(
						event.count,
						event.source === "discard" ? "discard" : "stock",
						event.seat,
					);
					break;
				case "penalty":
				case "caught":
				case "finishPenalty":
					flyBacks(event.count, "stock", event.seat);
					break;
				case "meld":
					for (const id of event.meldIds) {
						fly(meldCard(id), seatZone(event.seat), meldZone(id));
					}
					break;
				case "layoff":
					fly(
						event.cards[0] ?? null,
						seatZone(event.seat),
						meldZone(event.meldId),
					);
					break;
				case "swap":
					fly(event.card, seatZone(event.seat), meldZone(event.meldId));
					break;
				case "skip":
				case "again":
					setFlash(event.seat);
					break;
				default:
					break;
			}
		}
		origins.current.clear();
		if (planned.length > 0) {
			setFlights((current) => [...current, ...planned]);
		}
	}, [newestSeq, events, you, seatCount, rootRef, meldCard]);

	useLayoutEffect(() => {
		if (flash === null) {
			return;
		}
		const timer = window.setTimeout(() => setFlash(null), 500);
		return () => window.clearTimeout(timer);
	}, [flash]);

	const onDone = useRef((flight: Flight) => {
		setFlights((current) => current.filter((item) => item.id !== flight.id));
	}).current;

	return {
		landing: flights.some((flight) => flight.toDiscard),
		flash,
		playFrom: (card, element, move) => {
			const root = rootRef.current;
			if (root && element) {
				origins.current.set(
					card,
					spotIn(root, element, element.getBoundingClientRect().width),
				);
			}
			move();
		},
		layer: (
			<div className="flight-layer" aria-hidden="true">
				{flights.map((flight) => (
					<FlightCard key={flight.id} flight={flight} onDone={onDone} />
				))}
			</div>
		),
	};
}
