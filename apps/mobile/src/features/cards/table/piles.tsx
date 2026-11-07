/** The stock and the discard pile. Either is a button when it is yours to take. */
import { CARD_ASPECT } from "@arcadeclub/core/cards/art";
import type { CardId } from "@arcadeclub/core/cards/deck";
import { cardName, cardTilt } from "@arcadeclub/core/cards/table-view";
import { type ReactNode, useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
	cancelAnimation,
	useAnimatedStyle,
	useReducedMotion,
	useSharedValue,
	withRepeat,
	withSequence,
	withTiming,
} from "react-native-reanimated";
import { plural, useI18n } from "../../../i18n";
import { cardColors, spacing } from "../../../theme";
import { PlayingCard } from "../deck/playing-card";
import { FeltText } from "./felt-ui";
import type { CardZones } from "./flights";

type PileAction = { label: string; run: () => void; pulse?: boolean };

function PulseRing({ width }: { width: number }) {
	const quiet = useReducedMotion();
	const glow = useSharedValue(1);
	useEffect(() => {
		if (quiet) return;
		glow.value = withRepeat(
			withSequence(
				withTiming(0.35, { duration: 700 }),
				withTiming(1, { duration: 700 }),
			),
			-1,
		);
		return () => cancelAnimation(glow);
	}, [quiet, glow]);
	const style = useAnimatedStyle(() => ({ opacity: glow.value }));
	return (
		<Animated.View
			pointerEvents="none"
			style={[styles.ring, { borderRadius: width * 0.1 }, style]}
		/>
	);
}

function Pile({
	action,
	label,
	width,
	children,
	testID,
}: {
	action?: PileAction;
	label: string;
	width: number;
	children: ReactNode;
	testID: string;
}) {
	const box = { width, height: width * CARD_ASPECT };
	if (action) {
		return (
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={action.label}
				accessibilityHint={label}
				onPress={action.run}
				style={box}
				testID={testID}
			>
				{children}
				{action.pulse ? <PulseRing width={width} /> : null}
			</Pressable>
		);
	}
	return (
		<View accessible accessibilityLabel={label} style={box} testID={testID}>
			{children}
		</View>
	);
}

export function Piles({
	width,
	stockCount,
	top,
	underTop,
	landing,
	stockAction,
	discardAction,
	zones,
	children,
}: {
	width: number;
	stockCount: number;
	top: CardId | null;
	underTop: readonly CardId[];
	landing: boolean;
	stockAction?: PileAction;
	discardAction?: PileAction;
	zones: CardZones;
	/** Sits between the two piles, such as the direction of play. */
	children?: ReactNode;
}) {
	const { t, locale } = useI18n();
	const cards = t.games.cards;
	const countLabel = plural(locale, stockCount, cards.table.stockCount);
	const lean = (card: CardId) => ({
		transform: [{ rotate: `${cardTilt(card)}deg` }],
	});
	return (
		<View style={styles.row}>
			<View style={styles.column}>
				<View ref={zones.ref("stock", width)} collapsable={false}>
					<Pile
						action={stockAction}
						label={`${cards.table.stock}: ${countLabel}`}
						width={width}
						testID="cards-stock"
					>
						{stockCount === 0 ? <View style={styles.empty} /> : null}
						{stockCount > 2 ? (
							<View style={[styles.layer, styles.deep]}>
								<PlayingCard card={null} width={width} />
							</View>
						) : null}
						{stockCount > 1 ? (
							<View style={[styles.layer, styles.shallow]}>
								<PlayingCard card={null} width={width} />
							</View>
						) : null}
						{stockCount > 0 ? (
							<View style={styles.layer}>
								<PlayingCard card={null} width={width} />
							</View>
						) : null}
					</Pile>
				</View>
				<FeltText variant="caption" muted numberOfLines={1}>
					{countLabel}
				</FeltText>
			</View>
			{children}
			<View style={styles.column}>
				<View ref={zones.ref("discard", width)} collapsable={false}>
					<Pile
						action={discardAction}
						label={
							top
								? `${cards.table.discard}: ${cardName(cards, top)}`
								: cards.table.discard
						}
						width={width}
						testID="cards-discard"
					>
						{top === null ? <View style={styles.empty} /> : null}
						{underTop.map((card) => (
							<View key={card} style={[styles.layer, lean(card)]}>
								<PlayingCard card={card} width={width} />
							</View>
						))}
						{top && !landing ? (
							<View key={top} style={[styles.layer, lean(top)]}>
								<PlayingCard card={top} width={width} />
							</View>
						) : null}
					</Pile>
				</View>
				<FeltText variant="caption" muted numberOfLines={1}>
					{cards.table.discard}
				</FeltText>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	row: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: spacing.xl,
	},
	column: { alignItems: "center", gap: spacing.sm },
	layer: { position: "absolute", top: 0, left: 0 },
	deep: { top: -4, left: -4 },
	shallow: { top: -2, left: -2 },
	empty: {
		flex: 1,
		borderRadius: 6,
		borderWidth: 1.5,
		borderStyle: "dashed",
		borderColor: cardColors.goldSoft,
	},
	ring: {
		position: "absolute",
		top: -5,
		bottom: -5,
		left: -7,
		right: -5,
		borderWidth: 2.5,
		borderColor: cardColors.gold,
		boxShadow: [
			{ offsetX: 0, offsetY: 0, blurRadius: 10, color: cardColors.gold },
		],
	},
});
