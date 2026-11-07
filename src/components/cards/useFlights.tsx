import type { CardId } from "@arcadeclub/core/cards/deck";
import type { CardEvent } from "@arcadeclub/core/cards/events";
import {
	cardTilt,
	eventsSince,
	planFlights,
} from "@arcadeclub/core/cards/table-view";
import {
	type ReactNode,
	type RefObject,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { PlayingCard } from "./PlayingCard";

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
const FALLBACK_WIDTH = 40;

function zoneOf(root: HTMLElement, zone: string) {
	return root.querySelector<HTMLElement>(`[data-zone="${zone}"]`);
}

function spotOf(root: HTMLElement, zone: string): Spot | null {
	const element = zoneOf(root, zone);
	if (!element) {
		return null;
	}
	const base = root.getBoundingClientRect();
	const rect = element.getBoundingClientRect();
	const card = zone.startsWith("seat")
		? null
		: element.querySelector<HTMLElement>(".pc");
	return {
		x: rect.left + rect.width / 2 - base.left,
		y: rect.top + rect.height / 2 - base.top,
		width: card?.getBoundingClientRect().width ?? FALLBACK_WIDTH,
	};
}

function FlightCard({
	flight,
	onDone,
}: {
	flight: Flight;
	onDone: (flight: Flight) => void;
}) {
	const height = (flight.to.width * 140) / 100;
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
	noteOrigin: (card: CardId, element: HTMLElement) => void;
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
		const plan = planFlights(eventsSince(events, previous), {
			you,
			seatCount,
			meldCard,
		});
		const planned: Flight[] = [];
		for (const flight of plan.flights) {
			const start =
				(flight.fromHandCard && flight.card
					? origins.current.get(flight.card)
					: undefined) ?? spotOf(root, flight.from);
			const end = spotOf(root, flight.to);
			if (start && end) {
				planned.push({
					id: nextId.current++,
					card: flight.card,
					from: start,
					to: end,
					tilt:
						flight.to === "discard" && flight.card ? cardTilt(flight.card) : 0,
					delay: flight.delay,
					toDiscard: flight.to === "discard",
				});
			}
		}
		if (plan.flash !== null) {
			setFlash(plan.flash);
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
		noteOrigin: (card, element) => {
			const root = rootRef.current;
			if (!root) {
				return;
			}
			const base = root.getBoundingClientRect();
			const rect = element.getBoundingClientRect();
			origins.current.set(card, {
				x: rect.left + rect.width / 2 - base.left,
				y: rect.top + rect.height / 2 - base.top,
				width: rect.width,
			});
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
