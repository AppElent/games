/**
 * This player's cards, laid out to fill the width and overlapping only as much
 * as they must. Past a thumb's width per card the hand scrolls instead.
 */
import { CARD_ASPECT } from "@arcadeclub/core/cards/art";
import type { CardId } from "@arcadeclub/core/cards/deck";
import { cardName } from "@arcadeclub/core/cards/table-view";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	type HostInstance,
	Pressable,
	ScrollView,
	type ScrollViewInstance,
	StyleSheet,
	useWindowDimensions,
	View,
} from "react-native";
import Animated, {
	Easing,
	useAnimatedStyle,
	useReducedMotion,
	useSharedValue,
	withSequence,
	withTiming,
} from "react-native-reanimated";
import { haptics } from "../../../feedback/haptics";
import { useI18n } from "../../../i18n";
import { cardColors } from "../../../theme";
import { PlayingCard } from "../deck/playing-card";
import type { CardZones } from "./flights";

/** Room above the cards for a lifted one, clear of the scroll view's clipping. */
const TOP_ROOM = 32;
const BOTTOM_ROOM = 14;
const GUTTER = 20;
const EDGE_SLOP = 4;
const TIGHT_GUTTER = 12;
const MANY_CARDS = 12;
const MOVE_MS = 220;
const SELECT_LIFT = 20;
const PLAYABLE_LIFT = 8;
const FRESH_MARGIN = 24;

export type HandCardState = {
	dim?: boolean;
	selected?: boolean;
	playable?: boolean;
	disabled?: boolean;
};

function HandCard({
	card,
	width,
	x,
	y,
	tilt,
	state,
	fresh,
	label,
	onTap,
}: {
	card: CardId;
	width: number;
	x: number;
	y: number;
	tilt: number;
	state: HandCardState;
	fresh: boolean;
	label: string;
	/** False refuses the tap, which shakes the card. */
	onTap: (card: CardId, view: HostInstance) => boolean;
}) {
	const quiet = useReducedMotion();
	const view = useRef<HostInstance>(null);
	const lift = state.selected
		? SELECT_LIFT
		: state.playable
			? PLAYABLE_LIFT
			: 0;
	const left = useSharedValue(x);
	const top = useSharedValue(y - lift);
	const lean = useSharedValue(tilt);
	const shake = useSharedValue(0);

	useEffect(() => {
		const timing = {
			duration: quiet ? 0 : MOVE_MS,
			easing: Easing.out(Easing.cubic),
		};
		left.value = withTiming(x, timing);
		top.value = withTiming(y - lift, timing);
		lean.value = withTiming(tilt, timing);
	}, [x, y, lift, tilt, quiet, left, top, lean]);

	const motion = useAnimatedStyle(() => ({
		transform: [
			{ translateX: left.value + shake.value },
			{ translateY: top.value },
			{ rotate: `${lean.value}deg` },
		],
	}));
	const borderRadius = width * 0.075;

	return (
		<Animated.View style={[styles.card, motion]}>
			<Pressable
				ref={view}
				accessibilityRole="button"
				accessibilityLabel={label}
				accessibilityState={{
					selected: state.selected,
					disabled: state.disabled,
				}}
				onPress={() => {
					if (view.current && onTap(card, view.current)) return;
					haptics.moveRejected();
					if (quiet) return;
					shake.value = withSequence(
						withTiming(-6, { duration: 45 }),
						withTiming(6, { duration: 70 }),
						withTiming(-4, { duration: 60 }),
						withTiming(0, { duration: 45 }),
					);
				}}
				testID={`hand-${card}`}
			>
				<PlayingCard card={card} width={width} />
				{state.dim ? (
					<View pointerEvents="none" style={[styles.dim, { borderRadius }]} />
				) : null}
				{state.selected || fresh ? (
					<View
						pointerEvents="none"
						style={[
							styles.outline,
							{ borderRadius },
							!state.selected && styles.outlineFresh,
						]}
					/>
				) : null}
			</Pressable>
		</Animated.View>
	);
}

export function Hand({
	cards: hand,
	handSize,
	fresh,
	zones,
	stateOf,
	onTap,
}: {
	cards: readonly CardId[];
	/** Everything held, staged cards too, so staging doesn't resize the hand. */
	handSize: number;
	fresh: ReadonlySet<CardId>;
	zones: CardZones;
	stateOf: (card: CardId) => HandCardState;
	onTap: (card: CardId, view: HostInstance) => boolean;
}) {
	const { t } = useI18n();
	const copy = t.games.cards;
	const { width: screen } = useWindowDimensions();
	const scroller = useRef<ScrollViewInstance>(null);
	const many = handSize >= MANY_CARDS;
	const cardWidth = Math.round(
		many
			? Math.min(84, Math.max(60, screen * 0.165))
			: Math.min(108, Math.max(76, screen * 0.235)),
	);
	const cardHeight = cardWidth * CARD_ASPECT;
	const gutter = many ? TIGHT_GUTTER : GUTTER;
	const available = screen - gutter * 2;
	const total = hand.length;
	// A card's rank and suit stay readable and tappable down to here; past it the
	// hand scrolls instead of squeezing.
	const minStep = 23;
	const ideal = cardWidth + 6;
	const fit = total > 1 ? (available - cardWidth) / (total - 1) : ideal;
	const step = Math.max(minStep, Math.min(ideal, fit));
	const fanned = fit >= minStep && total > 1;
	const spread = Math.min(2.2, 14 / Math.max(total, 1));
	const span = cardWidth + step * Math.max(total - 1, 0);
	const start = gutter + Math.max(0, (available - span) / 2);
	const middle = (total - 1) / 2;

	// In a hand that scrolls, a draw can land out of sight.
	const newest = [...fresh].at(-1);
	const newestIndex = newest ? hand.indexOf(newest) : -1;
	useEffect(() => {
		if (newestIndex < 0 || fanned) return;
		scroller.current?.scrollTo({
			x: Math.max(0, start + newestIndex * step - FRESH_MARGIN),
		});
	}, [newestIndex, fanned, start, step]);

	// A hand that scrolls fades at each edge with more cards past it.
	const scrollX = useRef(0);
	const [edges, setEdges] = useState({ start: false, end: false });
	const noteScroll = useCallback(
		(x: number, content: number) => {
			scrollX.current = x;
			const start = x > EDGE_SLOP;
			const end = x + screen < content - EDGE_SLOP;
			setEdges((now) =>
				now.start === start && now.end === end ? now : { start, end },
			);
		},
		[screen],
	);

	return (
		<View
			ref={zones.ref("hand", cardWidth)}
			collapsable={false}
			accessibilityLabel={copy.table.handLabel}
		>
			<ScrollView
				ref={scroller}
				horizontal
				scrollEnabled={!fanned && total > 1}
				showsHorizontalScrollIndicator={false}
				scrollEventThrottle={64}
				onScroll={(event) =>
					noteScroll(
						event.nativeEvent.contentOffset.x,
						event.nativeEvent.contentSize.width,
					)
				}
				onContentSizeChange={(content) => noteScroll(scrollX.current, content)}
				contentContainerStyle={{
					width: Math.max(screen, span + gutter * 2),
					height: TOP_ROOM + cardHeight + BOTTOM_ROOM,
				}}
			>
				{hand.map((card, index) => {
					const offset = index - middle;
					return (
						<HandCard
							key={card}
							card={card}
							width={cardWidth}
							x={start + index * step}
							y={
								TOP_ROOM +
								(fanned && middle > 0
									? ((offset / middle) ** 2 - 1) * 12 + 6
									: 0)
							}
							tilt={fanned ? offset * spread : 0}
							state={stateOf(card)}
							fresh={fresh.has(card)}
							label={cardName(copy, card)}
							onTap={onTap}
						/>
					);
				})}
			</ScrollView>
			{edges.start ? (
				<View pointerEvents="none" style={[styles.fade, styles.fadeStart]} />
			) : null}
			{edges.end ? (
				<View pointerEvents="none" style={[styles.fade, styles.fadeEnd]} />
			) : null}
		</View>
	);
}

const styles = StyleSheet.create({
	card: { position: "absolute", left: 0, top: 0, transformOrigin: "50% 100%" },
	dim: { ...StyleSheet.absoluteFill, backgroundColor: cardColors.dim },
	outline: {
		...StyleSheet.absoluteFill,
		borderWidth: 2.5,
		borderColor: cardColors.gold,
		boxShadow: [
			{ offsetX: 0, offsetY: 0, blurRadius: 6, color: cardColors.gold },
		],
	},
	fade: { position: "absolute", top: TOP_ROOM, bottom: 0, width: 32 },
	fadeStart: {
		left: 0,
		backgroundImage: `linear-gradient(to right, ${cardColors.scrim}, transparent)`,
	},
	fadeEnd: {
		right: 0,
		backgroundImage: `linear-gradient(to left, ${cardColors.scrim}, transparent)`,
	},
	outlineFresh: { borderWidth: 1.5, borderColor: cardColors.goldTop },
});
