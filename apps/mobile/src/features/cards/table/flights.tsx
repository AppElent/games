/**
 * Turns new events into cards crossing the table. The state has already moved
 * on by the time we hear about it, so a card aimed at the discard pile hides
 * the real top card (`landing`) until it arrives.
 */
import { CARD_ASPECT } from "@arcadeclub/core/cards/art";
import type { CardId } from "@arcadeclub/core/cards/deck";
import type { CardEvent } from "@arcadeclub/core/cards/events";
import {
	cardTilt,
	eventsSince,
	planFlights,
} from "@arcadeclub/core/cards/table-view";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { type HostInstance, StyleSheet, View } from "react-native";
import Animated, {
	Easing,
	interpolate,
	useAnimatedStyle,
	useReducedMotion,
	useSharedValue,
	withDelay,
	withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { PlayingCard } from "../deck/playing-card";

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
const CURVE = Easing.bezier(0.22, 0.7, 0.25, 1);
const FLASH_MS = 500;

/** Synchronous under the new architecture, which is the only one this app runs. */
function rectOf(view: HostInstance) {
	let rect: { x: number; y: number; width: number; height: number } | null =
		null;
	view.measureInWindow((x, y, width, height) => {
		rect = { x, y, width, height };
	});
	return rect as { x: number; y: number; width: number; height: number } | null;
}

/** The places cards travel between, found by name when a flight is planned. */
function createZones() {
	const views = new Map<string, HostInstance>();
	const widths = new Map<string, number>();
	const refs = new Map<string, (view: HostInstance | null) => void>();
	let root: HostInstance | null = null;
	const spotOfView = (view: HostInstance, cardWidth?: number): Spot | null => {
		const base = root ? rectOf(root) : null;
		const rect = rectOf(view);
		if (!base || !rect) return null;
		return {
			x: rect.x + rect.width / 2 - base.x,
			y: rect.y + rect.height / 2 - base.y,
			width: cardWidth ?? rect.width,
		};
	};
	return {
		rootRef: (view: HostInstance | null) => {
			root = view;
		},
		/** `cardWidth` is how large a card is when it arrives here. */
		ref(name: string, cardWidth: number) {
			widths.set(name, cardWidth);
			let ref = refs.get(name);
			if (!ref) {
				ref = (view) => {
					if (view) views.set(name, view);
					else views.delete(name);
				};
				refs.set(name, ref);
			}
			return ref;
		},
		spot(name: string) {
			const view = views.get(name);
			return view ? spotOfView(view, widths.get(name)) : null;
		},
		spotOfView,
	};
}

export type CardZones = ReturnType<typeof createZones>;

function FlightCard({
	flight,
	onDone,
}: {
	flight: Flight;
	onDone: (id: number) => void;
}) {
	const progress = useSharedValue(0);
	useEffect(() => {
		progress.value = withDelay(
			flight.delay,
			withTiming(1, { duration: DURATION_MS, easing: CURVE }, () => {
				scheduleOnRN(onDone, flight.id);
			}),
		);
	}, [flight.delay, flight.id, onDone, progress]);
	const { from, to, tilt } = flight;
	const scale = from.width / to.width;
	const motion = useAnimatedStyle(() => ({
		opacity: progress.value > 0 ? 1 : 0,
		transform: [
			{ translateX: interpolate(progress.value, [0, 1], [from.x - to.x, 0]) },
			{ translateY: interpolate(progress.value, [0, 1], [from.y - to.y, 0]) },
			{ scale: interpolate(progress.value, [0, 1], [scale, 1]) },
			{
				rotate: `${interpolate(progress.value, [0, 1], [tilt - 14, tilt])}deg`,
			},
		],
	}));
	return (
		<Animated.View
			style={[
				styles.flight,
				{
					left: to.x - to.width / 2,
					top: to.y - (to.width * CARD_ASPECT) / 2,
				},
				motion,
			]}
		>
			<PlayingCard card={flight.card} width={to.width} />
		</Animated.View>
	);
}

export function useFlights(
	events: readonly CardEvent[],
	you: number | null,
	seatCount: number,
	meldCard: (meldId: number) => CardId | null,
) {
	const zones = useMemo(createZones, []);
	const quiet = useReducedMotion();
	const lastSeq = useRef<number | null>(null);
	const nextId = useRef(0);
	const origins = useRef(new Map<CardId, Spot>());
	const [flights, setFlights] = useState<Flight[]>([]);
	const [flash, setFlash] = useState<number | null>(null);
	const newestSeq = events.at(-1)?.seq ?? 0;

	useLayoutEffect(() => {
		const previous = lastSeq.current;
		lastSeq.current = newestSeq;
		if (previous === null || newestSeq === previous || quiet) return;
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
					: undefined) ?? zones.spot(flight.from);
			const end = zones.spot(flight.to);
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
		if (plan.flash !== null) setFlash(plan.flash);
		origins.current.clear();
		if (planned.length > 0) setFlights((current) => [...current, ...planned]);
	}, [newestSeq, events, you, seatCount, meldCard, quiet, zones]);

	useEffect(() => {
		if (flash === null) return;
		const timer = setTimeout(() => setFlash(null), FLASH_MS);
		return () => clearTimeout(timer);
	}, [flash]);

	const onDone = useRef((id: number) => {
		setFlights((current) => current.filter((item) => item.id !== id));
	}).current;

	return {
		zones,
		flash,
		landing: flights.some((flight) => flight.toDiscard),
		noteOrigin: (card: CardId, view: HostInstance) => {
			const spot = zones.spotOfView(view);
			if (spot) origins.current.set(card, spot);
		},
		layer: (
			<View
				pointerEvents="none"
				style={StyleSheet.absoluteFill}
				accessibilityElementsHidden
				importantForAccessibility="no-hide-descendants"
			>
				{flights.map((flight) => (
					<FlightCard key={flight.id} flight={flight} onDone={onDone} />
				))}
			</View>
		),
	};
}

const styles = StyleSheet.create({
	flight: { position: "absolute" },
});
