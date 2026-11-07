/**
 * What covers the table when a round or the game ends. It lives inside the
 * table rather than in a Modal, so it can't race a sheet that is already open,
 * and the header stays reachable to read the rules or leave.
 */
import { SUITS, type Suit } from "@arcadeclub/core/cards/deck";
import { useRouter } from "expo-router";
import { type ReactNode, useEffect, useRef } from "react";
import {
	AccessibilityInfo,
	ScrollView,
	StyleSheet,
	useWindowDimensions,
	View,
} from "react-native";
import Animated, {
	cancelAnimation,
	Easing,
	FadeIn,
	useAnimatedStyle,
	useReducedMotion,
	useSharedValue,
	withDelay,
	withRepeat,
	withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { haptics } from "../../../feedback/haptics";
import { useI18n } from "../../../i18n";
import { cardColors, radius, spacing } from "../../../theme";
import { SuitIcon } from "../deck/playing-card";
import { FeltText, TableButton } from "./felt-ui";
import type { CardTableBundle, CardTableControls } from "./use-card-table";

const CASCADE = Array.from({ length: 16 }, (_, index) => ({
	suit: SUITS[index % SUITS.length],
	x: (index * 37) % 100,
	size: 16 + ((index * 7) % 18),
	duration: 3400 + ((index * 3) % 5) * 500,
	wait: ((index * 11) % 20) * 100,
	spin: 150 + ((index * 43) % 240),
}));

function FallingSuit({
	suit,
	x,
	size,
	duration,
	wait,
	spin,
}: {
	suit: Suit;
	x: number;
	size: number;
	duration: number;
	wait: number;
	spin: number;
}) {
	const { width, height } = useWindowDimensions();
	const fall = useSharedValue(0);
	useEffect(() => {
		fall.value = withDelay(
			wait,
			withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1),
		);
		return () => cancelAnimation(fall);
	}, [fall, duration, wait]);
	const style = useAnimatedStyle(() => ({
		opacity: fall.value > 0 ? 1 : 0,
		transform: [
			{ translateY: -size + fall.value * (height + size * 2) },
			{ rotate: `${fall.value * spin}deg` },
		],
	}));
	return (
		<Animated.View style={[styles.falling, { left: (x / 100) * width }, style]}>
			<SuitIcon
				suit={suit}
				size={size}
				color={
					suit === "H" || suit === "D" ? cardColors.suitRed : cardColors.ivory
				}
			/>
		</Animated.View>
	);
}

/** The dimmed table with a panel on it. */
export function TablePanel({
	title,
	children,
	foot,
	testID,
}: {
	title: string;
	children?: ReactNode;
	foot?: ReactNode;
	testID: string;
}) {
	const insets = useSafeAreaInsets();
	const quiet = useReducedMotion();
	useEffect(() => {
		AccessibilityInfo.announceForAccessibility(title);
	}, [title]);
	return (
		<Animated.View
			entering={quiet ? undefined : FadeIn.duration(220)}
			accessibilityViewIsModal
			style={[
				styles.backdrop,
				{
					paddingTop: insets.top + 56,
					paddingBottom: insets.bottom + spacing.lg,
				},
			]}
			testID={testID}
		>
			<View style={styles.panel}>
				<ScrollView
					style={styles.scroll}
					contentContainerStyle={styles.body}
					alwaysBounceVertical={false}
				>
					<FeltText
						variant="title"
						accessibilityRole="header"
						style={styles.title}
					>
						{title}
					</FeltText>
					{children}
				</ScrollView>
				{foot ? <View style={styles.foot}>{foot}</View> : null}
			</View>
		</Animated.View>
	);
}

/** The final table: who won, a modest shower of suits for a win, and what next. */
export function EndPanel({
	table,
	winners,
	title,
	controls,
	children,
}: {
	table: CardTableBundle;
	winners: readonly number[];
	title: string;
	controls: CardTableControls;
	children?: ReactNode;
}) {
	const router = useRouter();
	const { t } = useI18n();
	const cards = t.games.cards;
	const quiet = useReducedMotion();
	const won = table.you !== null && winners.includes(table.you);
	const celebrated = useRef(false);
	useEffect(() => {
		if (won && !celebrated.current) {
			celebrated.current = true;
			haptics.gameWon();
		}
	}, [won]);
	return (
		<View style={StyleSheet.absoluteFill}>
			<TablePanel
				title={title}
				testID="cards-end"
				foot={
					<>
						{table.you !== null ? (
							<TableButton
								label={cards.table.playAgain}
								onPress={controls.rematch}
								disabled={controls.pending}
								testID="cards-rematch"
							/>
						) : (
							<FeltText variant="secondary" muted style={styles.waiting}>
								{cards.table.waitingRematch}
							</FeltText>
						)}
						<TableButton
							ghost
							label={cards.table.newGame}
							onPress={() => router.dismissTo("/cards")}
							testID="cards-other-games"
						/>
					</>
				}
			>
				{children}
			</TablePanel>
			{won && !quiet ? (
				<View
					pointerEvents="none"
					style={StyleSheet.absoluteFill}
					accessibilityElementsHidden
					importantForAccessibility="no-hide-descendants"
				>
					{CASCADE.map((item) => (
						<FallingSuit key={`${item.x}-${item.size}`} {...item} />
					))}
				</View>
			) : null}
		</View>
	);
}

const styles = StyleSheet.create({
	backdrop: {
		...StyleSheet.absoluteFill,
		alignItems: "center",
		justifyContent: "center",
		paddingHorizontal: spacing.lg,
		backgroundColor: cardColors.scrim,
	},
	panel: {
		width: "100%",
		maxWidth: 480,
		maxHeight: "100%",
		borderRadius: radius.xl,
		backgroundColor: cardColors.panel,
		borderWidth: 1,
		borderColor: cardColors.goldSoft,
		overflow: "hidden",
	},
	scroll: { flexGrow: 0 },
	body: { padding: spacing.xl, gap: spacing.md },
	title: { textAlign: "center", color: cardColors.gold },
	foot: {
		padding: spacing.lg,
		gap: spacing.sm,
		borderTopWidth: StyleSheet.hairlineWidth,
		borderTopColor: cardColors.line,
	},
	waiting: { textAlign: "center" },
	falling: { position: "absolute", top: 0 },
});
