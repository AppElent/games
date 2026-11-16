/**
 * A liar's dice game in play: your cup (only you see it), the bid to beat,
 * the picker for your bid or call, every player's dice left, and the reveal.
 */
import {
	type Bid,
	type BiddingView,
	countMatching,
	minimumQuantity,
	type Reveal,
} from "@arcadeclub/core/dice/bidding";
import type { DiceGameOf } from "@arcadeclub/core/dice/engine";
import {
	biddingNews,
	biddingStandings,
	biddingStep,
	bidText,
	defaultBid,
	diceSeatName,
	revealSentences,
	winnerTitle,
} from "@arcadeclub/core/dice/table-view";
import { seatIsSilent } from "@arcadeclub/core/table-engine";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { haptics } from "../../../feedback/haptics";
import { fmt, plural, useI18n } from "../../../i18n";
import {
	metrics,
	radius,
	spacing,
	type Tokens,
	useThemedStyles,
	useTokens,
} from "../../../theme";
import { Button } from "../../../ui/button";
import { Card } from "../../../ui/card";
import { AppText } from "../../../ui/text";
import { CountStepper } from "../../table/setup-fields";
import { DieFace } from "./die-face";
import {
	AutopilotNotice,
	DiceEndPanel,
	DiceTableFrame,
	useNow,
	useSeatMenu,
} from "./table-parts";
import type { DiceTableBundle, DiceTableControls } from "./use-dice-table";

type Props = {
	game: DiceGameOf<"bidding">;
	table: DiceTableBundle;
	view: BiddingView;
	controls: DiceTableControls;
};

type PanelProps = Omit<Props, "game">;

const FACES = [1, 2, 3, 4, 5, 6] as const;
const MAX_DIE = 56;
const DIE_GAP = spacing.sm;
const SMALL_DIE = 22;

export function BiddingTable({ game, table, view, controls }: Props) {
	const { t, locale } = useI18n();
	const dice = t.games.dice;
	const styles = useThemedStyles(createStyles);
	const won = table.you !== null && view.winners.includes(table.you);
	return (
		<DiceTableFrame
			game={game}
			table={table}
			controls={controls}
			news={biddingNews({ dice, locale }, table, view)}
			end={
				view.phase === "finished" ? (
					<DiceEndPanel
						table={table}
						controls={controls}
						title={winnerTitle(dice, table, view.winners)}
						won={won}
						heading={dice.bidding.standings}
					>
						{biddingStandings(view).map(({ seat, outIn }) => (
							<View key={seat} style={styles.standing}>
								<AppText variant="body" numberOfLines={1} style={styles.flex}>
									{diceSeatName(dice, table, seat)}
								</AppText>
								<AppText variant="secondary">
									{view.winners.includes(seat) || outIn === null
										? dice.bidding.lastStanding
										: fmt(dice.bidding.outIn, { round: outIn })}
								</AppText>
							</View>
						))}
					</DiceEndPanel>
				) : null
			}
			tray={<YourCup table={table} view={view} controls={controls} />}
		>
			<BidBoard table={table} view={view} controls={controls} />
		</DiceTableFrame>
	);
}

/** Your own dice and the bid or call you make with them. */
function YourCup({ table, view, controls }: PanelProps) {
	const { t } = useI18n();
	const dice = t.games.dice;
	const bidding = dice.bidding;
	const tokens = useTokens();
	const styles = useThemedStyles(createStyles);
	const { width } = useWindowDimensions();
	const you = table.you;
	const step = biddingStep(view, you);
	const mine = step === "open" || step === "raise";
	const wasMine = useRef(mine);
	useEffect(() => {
		// A nudge when it comes back round to you.
		if (mine && !wasMine.current) haptics.valueEntered();
		wasMine.current = mine;
	}, [mine]);

	const count = Math.max(view.yourDice.length, 1);
	const size = Math.min(
		MAX_DIE,
		Math.floor(
			(Math.min(width, metrics.contentMaxWidth) -
				metrics.screenGutter * 2 -
				spacing.lg * 2 -
				DIE_GAP * (count - 1)) /
				count,
		),
	);
	const status =
		step === "over"
			? null
			: step === "open"
				? bidding.yourTurnOpen
				: step === "raise"
					? bidding.yourTurnRaise
					: fmt(bidding.theirTurn, {
							name: diceSeatName(dice, table, view.turn),
						});

	return (
		<Card>
			<View style={styles.tray}>
				<AppText variant="label">
					{fmt(bidding.round, { round: view.round }).toUpperCase()}
				</AppText>
				{status ? (
					<AppText
						variant="heading"
						accessibilityLiveRegion="polite"
						style={mine ? { color: tokens.accent } : undefined}
						testID="dice-turn"
					>
						{status}
					</AppText>
				) : null}
				{you === null ? null : step === "out" ? (
					<AppText variant="secondary">{bidding.outOfDice}</AppText>
				) : (
					<>
						<View
							accessible
							accessibilityRole="image"
							accessibilityLabel={fmt(bidding.yourDiceLabel, {
								dice: view.yourDice.join(", "),
							})}
							style={styles.diceRow}
							testID="dice-your-cup"
						>
							{view.yourDice.map((value, index) => (
								// biome-ignore lint/suspicious/noArrayIndexKey: a cup's dice have no identity
								<DieFace key={index} value={value} size={size} />
							))}
						</View>
						<AppText variant="caption">{bidding.yourDiceHint}</AppText>
					</>
				)}
				{view.rules.wildOnes ? (
					<AppText variant="caption">{bidding.wildNote}</AppText>
				) : null}
				{mine ? (
					// A new bid starts the picker over from the new lowest bid.
					<BidPicker
						key={`${view.round}:${view.bids.length}`}
						view={view}
						controls={controls}
					/>
				) : null}
				<AutopilotNotice table={table} controls={controls} />
			</View>
		</Card>
	);
}

/** How many dice and which face, never lower than the bid to beat; or call it. */
function BidPicker({
	view,
	controls,
}: {
	view: BiddingView;
	controls: DiceTableControls;
}) {
	const { t, locale } = useI18n();
	const dice = t.games.dice;
	const bidding = dice.bidding;
	const tokens = useTokens();
	const styles = useThemedStyles(createStyles);
	const previous = view.bids.at(-1) ?? null;
	const start = defaultBid(view);
	const [face, setFace] = useState(start?.face ?? previous?.face ?? 2);
	const least = minimumQuantity(previous, face, view.rules);
	const [chosen, setChosen] = useState(start?.quantity ?? least);
	const quantity = Math.max(chosen, least);
	const bid: Bid = { quantity, face };

	return (
		<View style={styles.picker}>
			<AppText variant="label">{bidding.face.toUpperCase()}</AppText>
			<View style={styles.faces}>
				{FACES.map((value) => {
					const disabled =
						minimumQuantity(previous, value, view.rules) > view.totalDice;
					const selected = face === value;
					return (
						<Pressable
							key={value}
							accessibilityRole="radio"
							accessibilityLabel={fmt(bidding.faceButton, { face: value })}
							accessibilityState={{ checked: selected, disabled }}
							disabled={disabled}
							onPress={() => {
								haptics.selectionChanged();
								setFace(value);
								setChosen(minimumQuantity(previous, value, view.rules));
							}}
							testID={`dice-bid-face-${value}`}
							style={[styles.face, disabled && styles.faceDisabled]}
						>
							<DieFace
								value={value}
								size={metrics.hitTarget - spacing.xs}
								held={selected}
								ring={tokens.accent}
							/>
						</Pressable>
					);
				})}
			</View>
			<AppText variant="label">{bidding.quantity.toUpperCase()}</AppText>
			<CountStepper
				value={quantity}
				min={least}
				max={view.totalDice}
				label={String(quantity)}
				fewer={bidding.fewer}
				more={bidding.more}
				onChange={setChosen}
				testID="dice-bid-quantity"
			/>
			<Button
				label={fmt(bidding.placeBid, { bid: bidText({ dice, locale }, bid) })}
				disabled={quantity > view.totalDice}
				busy={controls.pending}
				onPress={() => {
					haptics.moveMade();
					controls.act({ type: "bid", quantity, face });
				}}
				testID="dice-bid-place"
				style={styles.stretch}
			/>
			{previous ? (
				<View style={styles.calls}>
					<Button
						variant="secondary"
						label={bidding.liar}
						disabled={controls.pending}
						onPress={() => {
							haptics.moveMade();
							controls.act({ type: "liar" });
						}}
						testID="dice-bid-liar"
						style={styles.flex}
					/>
					{view.rules.spotOn ? (
						<Button
							variant="secondary"
							label={bidding.spotOn}
							disabled={controls.pending}
							onPress={() => {
								haptics.moveMade();
								controls.act({ type: "spotOn" });
							}}
							testID="dice-bid-spot-on"
							style={styles.flex}
						/>
					) : null}
				</View>
			) : null}
		</View>
	);
}

/** The bid to beat, who is still in with how many dice, and how the last round ended. */
function BidBoard({ table, view, controls }: PanelProps) {
	const { t, locale } = useI18n();
	const dice = t.games.dice;
	const bidding = dice.bidding;
	const tokens = useTokens();
	const styles = useThemedStyles(createStyles);
	const now = useNow();
	const menu = useSeatMenu(table, controls, now);
	const words = { dice, locale };
	const name = (seat: number) => diceSeatName(dice, table, seat);
	const current = view.bids.at(-1);
	const seats = view.diceCounts.map((_, seat) => seat);

	return (
		<Card>
			<AppText variant="label" accessibilityRole="header">
				{bidding.currentBid.toUpperCase()}
			</AppText>
			{current ? (
				<View style={styles.current} testID="dice-current-bid">
					<DieFace value={current.face} size={36} />
					<View style={styles.flex}>
						<AppText variant="title">{bidText(words, current)}</AppText>
						<AppText variant="secondary">
							{fmt(bidding.bidBy, { name: name(current.seat) })}
						</AppText>
					</View>
				</View>
			) : (
				<AppText variant="secondary">{bidding.noBid}</AppText>
			)}
			<AppText variant="caption">
				{plural(locale, view.totalDice, bidding.onTable)}
			</AppText>

			<AppText variant="label" accessibilityRole="header">
				{bidding.players.toUpperCase()}
			</AppText>
			{seats.map((seat) => {
				const count = view.diceCounts[seat];
				const active = view.phase === "playing" && view.turn === seat;
				const silent = seatIsSilent(table.seats[seat], now);
				const label = `${name(seat)}, ${
					count === 0 ? bidding.out : plural(locale, count, bidding.diceLeft)
				}`;
				const content = (
					<>
						<View style={styles.flex}>
							<AppText
								variant="body"
								numberOfLines={1}
								style={active ? { color: tokens.accent } : undefined}
							>
								{name(seat)}
							</AppText>
							{silent ? (
								<AppText variant="caption">{dice.table.offline}</AppText>
							) : null}
						</View>
						<AppText
							variant="secondary"
							tone={count === 0 ? "muted" : "default"}
						>
							{count === 0
								? bidding.out
								: plural(locale, count, bidding.diceLeft)}
						</AppText>
					</>
				);
				return menu.canManage(seat) ? (
					<Pressable
						key={seat}
						accessibilityRole="button"
						accessibilityLabel={`${label}. ${fmt(dice.table.seatMenu, {
							name: name(seat),
						})}`}
						onPress={() => menu.open(seat)}
						testID={`dice-seat-${seat}`}
						style={[styles.seat, active && styles.active]}
					>
						{content}
					</Pressable>
				) : (
					<View
						key={seat}
						accessible
						accessibilityLabel={label}
						style={[styles.seat, active && styles.active]}
					>
						{content}
					</View>
				);
			})}

			{view.bids.length > 0 ? (
				<>
					<AppText variant="label" accessibilityRole="header">
						{bidding.history.toUpperCase()}
					</AppText>
					{view.bids.map((bid) => (
						<AppText
							// Each bid outranks the last, so no two in a round are alike.
							key={`${bid.seat}:${bid.quantity}:${bid.face}`}
							variant="secondary"
							tone="default"
						>
							{fmt(bidding.historyEntry, {
								name: name(bid.seat),
								bid: bidText(words, bid),
							})}
						</AppText>
					))}
				</>
			) : null}

			{view.reveal ? (
				<RevealPanel table={table} view={view} reveal={view.reveal} />
			) : null}
			{menu.sheet}
		</Card>
	);
}

/** Every cup lifted at the last call, with the dice that counted picked out. */
function RevealPanel({
	table,
	view,
	reveal,
}: {
	table: DiceTableBundle;
	view: BiddingView;
	reveal: Reveal;
}) {
	const { t, locale } = useI18n();
	const dice = t.games.dice;
	const bidding = dice.bidding;
	const tokens = useTokens();
	const styles = useThemedStyles(createStyles);
	const name = (seat: number) => diceSeatName(dice, table, seat);
	const counts = (value: number) =>
		countMatching([value], reveal.bid.face, view.rules) > 0;

	return (
		<View style={styles.reveal} testID="dice-reveal">
			<AppText variant="label" accessibilityRole="header">
				{bidding.revealHeading.toUpperCase()}
			</AppText>
			{revealSentences({ dice, locale }, table, reveal).map((sentence) => (
				<AppText key={sentence} variant="secondary" tone="default">
					{sentence}
				</AppText>
			))}
			{reveal.cups.map((cup, seat) => (
				<View
					// biome-ignore lint/suspicious/noArrayIndexKey: seats are fixed during a game.
					key={seat}
					accessible
					accessibilityLabel={
						cup.length === 0
							? fmt(bidding.cupOut, { name: name(seat) })
							: fmt(bidding.cupOf, { name: name(seat), dice: cup.join(", ") })
					}
					style={styles.cup}
				>
					<AppText
						variant="caption"
						tone="default"
						numberOfLines={1}
						style={[
							styles.cupName,
							reveal.losers.includes(seat) && { color: tokens.danger },
						]}
					>
						{name(seat)}
					</AppText>
					<View style={styles.cupDice}>
						{cup.map((value, index) => (
							<View
								// biome-ignore lint/suspicious/noArrayIndexKey: a cup's dice have no identity
								key={index}
								style={counts(value) ? undefined : styles.dim}
							>
								<DieFace
									value={value}
									size={SMALL_DIE}
									held={counts(value)}
									ring={tokens.accent}
								/>
							</View>
						))}
					</View>
					{/* The sentences above already say who lost a die. */}
					{reveal.losers.includes(seat) ? (
						<AppText variant="caption" tone="default" style={styles.lostMark}>
							{bidding.lostMark}
						</AppText>
					) : null}
				</View>
			))}
		</View>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		tray: { alignItems: "center", gap: spacing.sm },
		diceRow: {
			flexDirection: "row",
			justifyContent: "center",
			alignItems: "center",
			gap: DIE_GAP,
		},
		picker: {
			alignSelf: "stretch",
			gap: spacing.sm,
			paddingTop: spacing.sm,
			borderTopWidth: StyleSheet.hairlineWidth,
			borderTopColor: colors.border,
		},
		faces: {
			flexDirection: "row",
			justifyContent: "space-between",
			gap: spacing.xs,
		},
		face: {
			minWidth: metrics.hitTarget,
			minHeight: metrics.hitTarget,
			alignItems: "center",
			justifyContent: "center",
		},
		faceDisabled: { opacity: 0.35 },
		stretch: { alignSelf: "stretch" },
		calls: { flexDirection: "row", gap: spacing.sm },
		current: {
			flexDirection: "row",
			alignItems: "center",
			gap: spacing.md,
		},
		seat: {
			flexDirection: "row",
			alignItems: "center",
			gap: spacing.md,
			minHeight: metrics.hitTarget,
			paddingHorizontal: spacing.sm,
			borderRadius: radius.sm,
		},
		active: { backgroundColor: colors.accentDim },
		reveal: {
			gap: spacing.xs,
			paddingTop: spacing.sm,
			borderTopWidth: StyleSheet.hairlineWidth,
			borderTopColor: colors.border,
		},
		cup: {
			flexDirection: "row",
			alignItems: "center",
			gap: spacing.sm,
			minHeight: metrics.hitTarget,
		},
		cupName: { width: 96 },
		cupDice: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xxs },
		lostMark: {
			color: colors.danger,
			backgroundColor: colors.dangerDim,
			fontWeight: "700",
			paddingHorizontal: spacing.xs,
			borderRadius: 999,
			overflow: "hidden",
		},
		dim: { opacity: 0.4 },
		standing: {
			flexDirection: "row",
			alignItems: "center",
			gap: spacing.md,
			minHeight: metrics.hitTarget,
		},
		flex: { flex: 1 },
	});
