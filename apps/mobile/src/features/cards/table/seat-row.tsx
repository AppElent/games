/** The opponents around the top of the table, in the order play reaches them. */
import {
	opponentOrder,
	seatIsSilent,
	seatName,
} from "@arcadeclub/core/cards/table-view";
import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import Animated, {
	cancelAnimation,
	useAnimatedStyle,
	useReducedMotion,
	useSharedValue,
	withRepeat,
	withSequence,
	withSpring,
	withTiming,
} from "react-native-reanimated";
import { fmt, plural, useI18n } from "../../../i18n";
import { cardColors, spacing } from "../../../theme";
import { Icon } from "../../../ui/icon";
import { FeltText } from "./felt-ui";
import type { CardZones } from "./flights";
import type { CardTableBundle, CardTableControls } from "./use-card-table";

const FAN_SLOTS = [0, 1, 2, 3, 4];
const SILENCE_CHECK_MS = 15_000;

function initialOf(name: string) {
	return [...name.trim()][0]?.toUpperCase() ?? "?";
}

function Seat({
	seat,
	name,
	count,
	active,
	flash,
	silent,
	autopilot,
	note,
	arc,
	size,
	zones,
	onManage,
}: {
	seat: number;
	name: string;
	count: number;
	active: boolean;
	flash: boolean;
	silent: boolean;
	autopilot: boolean;
	note?: string;
	arc: number;
	size: number;
	zones: CardZones;
	onManage?: () => void;
}) {
	const { t, locale } = useI18n();
	const cards = t.games.cards;
	const quiet = useReducedMotion();
	const glow = useSharedValue(0.55);
	const bump = useSharedValue(1);

	useEffect(() => {
		if (active && !quiet) {
			glow.value = withRepeat(
				withSequence(
					withTiming(1, { duration: 800 }),
					withTiming(0.55, { duration: 800 }),
				),
				-1,
			);
		} else {
			cancelAnimation(glow);
			glow.value = 1;
		}
	}, [active, quiet, glow]);

	useEffect(() => {
		if (flash && !quiet) {
			bump.value = withSequence(
				withTiming(1.2, { duration: 120 }),
				withSpring(1),
			);
		}
	}, [flash, quiet, bump]);

	const ringStyle = useAnimatedStyle(() => ({ opacity: glow.value }));
	const bumpStyle = useAnimatedStyle(() => ({
		transform: [{ scale: bump.value }],
	}));
	const [toneA, toneB] =
		cardColors.seatTones[seat % cardColors.seatTones.length];
	const fan = FAN_SLOTS.slice(0, Math.min(count, FAN_SLOTS.length));
	const label = [
		name,
		plural(locale, count, cards.table.cardsLeft),
		active ? fmt(cards.table.theirTurn, { name }) : null,
		silent ? cards.table.offline : null,
		note,
	]
		.filter(Boolean)
		.join(", ");

	return (
		<View
			ref={zones.ref(`seat-${seat}`, 30)}
			collapsable={false}
			accessible={!onManage}
			accessibilityLabel={label}
			style={[styles.seat, { transform: [{ translateY: arc * 12 }] }]}
			testID={`seat-${seat}`}
		>
			<Animated.View
				style={[styles.discWrap, { width: size, height: size }, bumpStyle]}
			>
				<View style={[styles.fan, silent && styles.silent]}>
					{fan.map((slot) => (
						<View
							key={slot}
							style={[
								styles.fanCard,
								{
									transform: [
										{ rotate: `${(slot - (fan.length - 1) / 2) * 15}deg` },
									],
								},
							]}
						/>
					))}
				</View>
				{active ? (
					<Animated.View
						style={[styles.ring, { borderRadius: size }, ringStyle]}
					/>
				) : null}
				<View
					style={[
						styles.disc,
						{ borderRadius: size / 2 },
						silent && styles.silent,
						{ backgroundImage: `linear-gradient(135deg, ${toneA}, ${toneB})` },
					]}
				>
					{autopilot ? (
						<Icon
							ios="cpu"
							android="smart_toy"
							size={size * 0.5}
							color={cardColors.ivory}
						/>
					) : (
						<FeltText variant="seatInitial" maxFontSizeMultiplier={1}>
							{initialOf(name)}
						</FeltText>
					)}
				</View>
				<View style={styles.count}>
					<FeltText variant="checkerCount" maxFontSizeMultiplier={1}>
						{count}
					</FeltText>
				</View>
			</Animated.View>
			<FeltText
				variant="caption"
				numberOfLines={1}
				style={[styles.name, active && styles.nameActive]}
			>
				{name}
			</FeltText>
			{/* Always there in a family with notes, so the table doesn't shift when one appears. */}
			{silent || note !== undefined ? (
				<FeltText
					variant="boardLabel"
					muted
					numberOfLines={1}
					style={styles.note}
				>
					{silent ? cards.table.offline : note || " "}
				</FeltText>
			) : null}
			{onManage ? (
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={fmt(cards.table.seatMenu, { name })}
					onPress={onManage}
					hitSlop={12}
					style={styles.manage}
					testID={`seat-manage-${seat}`}
				>
					<Icon
						ios="ellipsis"
						android="more_horiz"
						size={14}
						color={cardColors.ivory}
					/>
				</Pressable>
			) : null}
		</View>
	);
}

export function SeatRow({
	table,
	handCounts,
	turn,
	flash,
	note,
	zones,
	controls,
}: {
	table: CardTableBundle;
	handCounts: readonly number[];
	turn: number | null;
	flash: number | null;
	/** Family-specific line under a name, such as a running score. */
	note?: (seat: number) => string | undefined;
	zones: CardZones;
	controls: CardTableControls;
}) {
	const { t } = useI18n();
	const cards = t.games.cards;
	const [now, setNow] = useState(() => Date.now());

	useEffect(() => {
		const timer = setInterval(() => setNow(Date.now()), SILENCE_CHECK_MS);
		return () => clearInterval(timer);
	}, []);

	const order = opponentOrder(table);
	const size = order.length > 4 ? 38 : 46;

	return (
		<View style={styles.row}>
			{order.map((seat, position) => {
				const entry = table.seats[seat];
				const name = seatName(cards, table, seat);
				const human = entry.botIndex === null;
				const silent = seatIsSilent(entry, now);
				const canManage =
					table.you !== null &&
					human &&
					!entry.autopilot &&
					(table.isHost || silent);
				const centred = (position + 0.5) / order.length;
				return (
					<Seat
						key={seat}
						seat={seat}
						name={name}
						count={handCounts[seat] ?? 0}
						active={turn === seat}
						flash={flash === seat}
						silent={silent}
						autopilot={entry.autopilot && human}
						note={note?.(seat)}
						arc={order.length > 2 ? (2 * centred - 1) ** 2 : 0}
						size={size}
						zones={zones}
						onManage={
							canManage
								? () =>
										Alert.alert(
											fmt(cards.table.seatMenu, { name }),
											undefined,
											[
												{
													text: fmt(cards.table.autopilotOn, { name }),
													onPress: () => controls.setAutopilot(seat, true),
												},
												{ text: t.common.actions.cancel, style: "cancel" },
											],
										)
								: undefined
						}
					/>
				);
			})}
		</View>
	);
}

const styles = StyleSheet.create({
	row: {
		flexDirection: "row",
		justifyContent: "space-evenly",
		alignItems: "flex-start",
		paddingHorizontal: spacing.xs,
		paddingTop: spacing.md,
		paddingBottom: spacing.md,
	},
	seat: {
		flex: 1,
		maxWidth: 110,
		minWidth: 0,
		alignItems: "center",
		gap: spacing.xxs,
	},
	discWrap: { alignItems: "center", justifyContent: "center" },
	fan: {
		position: "absolute",
		top: -9,
		alignSelf: "center",
		width: 14,
		height: 20,
	},
	fanCard: {
		position: "absolute",
		width: 14,
		height: 20,
		borderRadius: 2,
		backgroundColor: cardColors.cardBack,
		borderWidth: 1,
		borderColor: cardColors.gold,
		transformOrigin: "50% 130%",
	},
	ring: {
		position: "absolute",
		top: -4,
		bottom: -4,
		left: -4,
		right: -4,
		borderWidth: 3,
		borderColor: cardColors.gold,
		boxShadow: [
			{ offsetX: 0, offsetY: 0, blurRadius: 10, color: cardColors.gold },
		],
	},
	disc: {
		width: "100%",
		height: "100%",
		alignItems: "center",
		justifyContent: "center",
		overflow: "hidden",
		borderWidth: 1.5,
		borderColor: cardColors.chip,
	},
	silent: { opacity: 0.45 },
	count: {
		position: "absolute",
		right: -6,
		bottom: -4,
		minWidth: 20,
		height: 20,
		paddingHorizontal: spacing.xs,
		alignItems: "center",
		justifyContent: "center",
		borderRadius: 7,
		backgroundColor: cardColors.panel,
		borderWidth: 1,
		borderColor: cardColors.goldSoft,
	},
	name: { marginTop: spacing.xs, maxWidth: "96%", fontWeight: "600" },
	nameActive: { color: cardColors.gold, fontWeight: "800" },
	note: { maxWidth: "96%" },
	manage: {
		position: "absolute",
		top: spacing.md,
		right: 2,
		width: 22,
		height: 22,
		borderRadius: 11,
		alignItems: "center",
		justifyContent: "center",
		backgroundColor: cardColors.chip,
	},
});
