/** Fanned cards and the melds built from them, shared by the rummy and gin tables. */
import type { CardId } from "@arcadeclub/core/cards/deck";
import type { Meld } from "@arcadeclub/core/cards/melds";
import { Pressable, StyleSheet, View } from "react-native";
import { cardColors, radius, spacing } from "../../../theme";
import { PlayingCard } from "../deck/playing-card";
import type { CardZones } from "./flights";

const MELD_STEP = 0.42;

export function Fan({
	cards,
	width,
	step,
	laidOff,
}: {
	cards: readonly CardId[];
	width: number;
	step: number;
	/** Cards to lift and outline, such as those laid off on a meld. */
	laidOff?: readonly CardId[];
}) {
	return (
		<View style={styles.fan}>
			{cards.map((card, index) => {
				const raised = laidOff?.includes(card) ?? false;
				return (
					<View
						key={card}
						style={[
							index > 0 ? { marginLeft: step - width } : null,
							raised && styles.raised,
						]}
						testID={raised ? `laid-off-${card}` : undefined}
					>
						<PlayingCard card={card} width={width} />
						{raised ? (
							<View
								pointerEvents="none"
								style={[styles.laidOff, { borderRadius: width * 0.075 }]}
							/>
						) : null}
					</View>
				);
			})}
		</View>
	);
}

export function MeldView({
	meld,
	label,
	target,
	cardWidth,
	zones,
	onPress,
	onLayoutY,
}: {
	meld: Meld;
	label: string;
	target: boolean;
	cardWidth: number;
	zones: CardZones;
	onPress: () => void;
	onLayoutY: (y: number) => void;
}) {
	const step = cardWidth * MELD_STEP;
	const content = <Fan cards={meld.cards} width={cardWidth} step={step} />;
	const zone = zones.ref(`meld-${meld.id}`, cardWidth);
	return (
		<View
			ref={zone}
			collapsable={false}
			onLayout={(event) => onLayoutY(event.nativeEvent.layout.y)}
		>
			{target ? (
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={label}
					onPress={onPress}
					hitSlop={4}
					style={[styles.meld, styles.meldTarget]}
					testID={`meld-${meld.id}`}
				>
					{content}
				</Pressable>
			) : (
				<View
					accessible
					accessibilityLabel={label}
					style={styles.meld}
					testID={`meld-${meld.id}`}
				>
					{content}
				</View>
			)}
		</View>
	);
}

/** Cards left out of every meld, fanned inside a dashed outline. */
export function DeadwoodView({
	cards,
	label,
	cardWidth,
}: {
	cards: readonly CardId[];
	label: string;
	cardWidth: number;
}) {
	return (
		<View
			accessible
			accessibilityLabel={label}
			style={[styles.meld, styles.deadwood]}
		>
			<Fan cards={cards} width={cardWidth} step={cardWidth * MELD_STEP} />
		</View>
	);
}

const styles = StyleSheet.create({
	fan: { flexDirection: "row" },
	meld: {
		padding: spacing.xs,
		borderRadius: radius.sm,
		borderWidth: 1.5,
		borderColor: "transparent",
	},
	meldTarget: {
		borderColor: cardColors.gold,
		backgroundColor: cardColors.goldSoft,
	},
	raised: { transform: [{ translateY: -5 }] },
	laidOff: {
		...StyleSheet.absoluteFill,
		borderWidth: 2,
		borderColor: cardColors.gold,
	},
	deadwood: { borderStyle: "dashed", borderColor: cardColors.ivoryLine },
});
