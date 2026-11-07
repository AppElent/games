/** The shared table: felt, header, opponents, and the family's middle and hand. */
import type { CardGameDefinition } from "@arcadeclub/core/cards/engine";
import type { CardEvent } from "@arcadeclub/core/cards/events";
import { latestEventText } from "@arcadeclub/core/cards/table-view";
import { useAuth } from "@clerk/expo";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { haptics } from "../../../feedback/haptics";
import { useI18n } from "../../../i18n";
import { cardColors, metrics, radius, spacing } from "../../../theme";
import { Icon } from "../../../ui/icon";
import { Felt } from "../deck/felt";
import { RulesSheet } from "../deck/rules-sheet";
import { useCardWords } from "../deck/use-card-words";
import { FeltText } from "./felt-ui";
import type { CardZones } from "./flights";
import type { CardTableBundle } from "./use-card-table";

/** The inline navigation bar on a phone in portrait. */
const NAV_BAR_HEIGHT = 44;

type HeaderIcon = Parameters<typeof Icon>[0]["ios"];
type HeaderAndroidIcon = Parameters<typeof Icon>[0]["android"];

export type HeaderAction = {
	label: string;
	ios: HeaderIcon;
	android: HeaderAndroidIcon;
	onPress: () => void;
	testID: string;
};

function HeaderActions({ actions }: { actions: readonly HeaderAction[] }) {
	return (
		<View style={styles.headerActions}>
			{actions.map((action) => (
				<Pressable
					key={action.testID}
					accessibilityRole="button"
					accessibilityLabel={action.label}
					onPress={action.onPress}
					testID={action.testID}
					style={styles.headerAction}
				>
					<Icon
						ios={action.ios}
						android={action.android}
						size={20}
						color={cardColors.ivory}
					/>
				</Pressable>
			))}
		</View>
	);
}

/** The latest thing that happened, read out to screen readers as it happens. */
export function EventTicker({
	events,
	table,
}: {
	events: readonly CardEvent[];
	table: CardTableBundle;
}) {
	const words = useCardWords();
	const text = latestEventText(events, words, table);
	useEffect(() => {
		if (text) AccessibilityInfo.announceForAccessibility(text);
	}, [text]);
	return (
		<FeltText
			variant="caption"
			muted
			numberOfLines={2}
			style={styles.ticker}
			testID="cards-ticker"
		>
			{text}
		</FeltText>
	);
}

export function TableFrame({
	game,
	table,
	name,
	mine,
	zones,
	seats,
	center,
	status,
	hand,
	flightLayer,
	headerActions,
	overlays,
	error,
}: {
	game: CardGameDefinition;
	table: CardTableBundle;
	name: string;
	mine: boolean;
	zones: CardZones;
	seats: ReactNode;
	center: ReactNode;
	status: ReactNode;
	hand: ReactNode;
	flightLayer: ReactNode;
	headerActions?: readonly HeaderAction[];
	overlays?: ReactNode;
	error: string;
}) {
	const router = useRouter();
	const { isSignedIn } = useAuth();
	const { t } = useI18n();
	const cards = t.games.cards;
	const insets = useSafeAreaInsets();
	const [rulesOpen, setRulesOpen] = useState(false);
	const wasMine = useRef(mine);

	// A nudge in the hand when it comes back round to you.
	useEffect(() => {
		if (mine && !wasMine.current) haptics.valueEntered();
		wasMine.current = mine;
	}, [mine]);

	const actions = useMemo(
		() => [
			...(headerActions ?? []),
			{
				label: cards.table.rules,
				ios: "book.closed" as const,
				android: "menu_book" as const,
				onPress: () => setRulesOpen(true),
				testID: "cards-rules",
			},
		],
		[headerActions, cards.table.rules],
	);
	const options = useMemo(
		() => ({
			title: name,
			headerTransparent: true,
			headerTintColor: cardColors.ivory,
			headerStyle: { backgroundColor: "transparent" },
			headerTitleStyle: { color: cardColors.ivory },
			headerRight: () => <HeaderActions actions={actions} />,
		}),
		[name, actions],
	);
	const code = table.session.joinCode;

	return (
		<View ref={zones.rootRef} collapsable={false} style={styles.root}>
			<Stack.Screen options={options} />
			<StatusBar style="light" />
			<Felt felt={game.felt} />
			<View
				style={[
					styles.grid,
					{
						paddingTop: insets.top + NAV_BAR_HEIGHT,
						paddingBottom: Math.max(insets.bottom - spacing.md, 0),
					},
				]}
			>
				{seats}
				<View style={styles.center}>{center}</View>
				<View style={styles.status}>{status}</View>
				{table.you === null ? (
					<View style={styles.spectator}>
						<FeltText variant="secondary">{cards.table.spectating}</FeltText>
						{code && isSignedIn ? (
							<Pressable
								accessibilityRole="link"
								hitSlop={12}
								onPress={() =>
									router.replace({ pathname: "/join", params: { code } })
								}
								testID="cards-rejoin"
							>
								<FeltText variant="secondary" style={styles.rejoin}>
									{cards.table.rejoin}
								</FeltText>
							</Pressable>
						) : null}
					</View>
				) : (
					hand
				)}
			</View>
			{flightLayer}
			{overlays}
			{error ? (
				<Animated.View
					entering={FadeIn.duration(150)}
					exiting={FadeOut.duration(150)}
					style={[
						styles.toast,
						{ top: insets.top + NAV_BAR_HEIGHT + spacing.sm },
					]}
					accessibilityRole="alert"
					accessibilityLiveRegion="assertive"
				>
					<FeltText variant="secondary">{error}</FeltText>
				</Animated.View>
			) : null}
			<RulesSheet
				game={game}
				options={table.options}
				open={rulesOpen}
				onClose={() => setRulesOpen(false)}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: cardColors.panel },
	grid: { flex: 1 },
	center: {
		flex: 1,
		minHeight: 0,
		alignItems: "stretch",
		justifyContent: "center",
	},
	status: {
		alignItems: "center",
		gap: spacing.xxs,
		paddingHorizontal: metrics.screenGutter,
		paddingTop: spacing.xs,
	},
	ticker: { textAlign: "center", minHeight: 16 },
	headerActions: { flexDirection: "row" },
	headerAction: {
		minWidth: metrics.hitTarget,
		minHeight: metrics.hitTarget,
		alignItems: "center",
		justifyContent: "center",
	},
	spectator: {
		alignItems: "center",
		gap: spacing.xs,
		paddingVertical: spacing.xl,
	},
	rejoin: { color: cardColors.gold, fontWeight: "700" },
	toast: {
		position: "absolute",
		alignSelf: "center",
		maxWidth: "88%",
		paddingHorizontal: spacing.lg,
		paddingVertical: spacing.sm,
		borderRadius: radius.md,
		backgroundColor: cardColors.panel,
		borderWidth: 1,
		borderColor: cardColors.alert,
	},
});
