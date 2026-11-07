/** A table for the shedding family: match the pile and be first out. */

import { CARD_PAPER } from "@arcadeclub/core/cards/art";
import { type CardId, SUITS, type Suit } from "@arcadeclub/core/cards/deck";
import {
	type CardGameDefinition,
	type CardGameId,
	resolvedRules,
} from "@arcadeclub/core/cards/engine";
import { powerOf, type SheddingView } from "@arcadeclub/core/cards/shedding";
import {
	seatName,
	sheddingHint,
	sortCards,
} from "@arcadeclub/core/cards/table-view";
import { useEffect, useState } from "react";
import {
	type HostInstance,
	Pressable,
	StyleSheet,
	useWindowDimensions,
	View,
} from "react-native";
import { haptics } from "../../../feedback/haptics";
import { fmt, plural, useI18n } from "../../../i18n";
import { cardColors, metrics, opacity, radius, spacing } from "../../../theme";
import { Icon } from "../../../ui/icon";
import { AppText } from "../../../ui/text";
import { SuitIcon } from "../deck/playing-card";
import { useCardWords } from "../deck/use-card-words";
import { FeltText, Pill, PillRow, TableButton } from "./felt-ui";
import { useFlights } from "./flights";
import { Hand } from "./hand";
import { Piles } from "./piles";
import { EndPanel } from "./result-panel";
import { SeatRow } from "./seat-row";
import { EventTicker, TableFrame } from "./table-frame";
import type { CardTableBundle, CardTableControls } from "./use-card-table";
import { useFreshCards } from "./use-fresh-cards";

const NO_MELD = () => null;

export function SheddingTable({
	game,
	table,
	view,
	controls,
}: {
	game: CardGameDefinition;
	table: CardTableBundle;
	view: SheddingView;
	controls: CardTableControls;
}) {
	const { t, locale } = useI18n();
	const cards = t.games.cards;
	const words = useCardWords();
	const { width: screen } = useWindowDimensions();
	const [picking, setPicking] = useState<CardId | null>(null);
	const [armed, setArmed] = useState(false);
	const flights = useFlights(
		view.events,
		table.you,
		table.seats.length,
		NO_MELD,
	);

	const resolved = resolvedRules(game, table.options);
	const rules = resolved.family === "shedding" ? resolved.rules : null;
	const name = cards.games[game.id as CardGameId].name;
	const you = table.you;
	const playing = view.phase === "playing";
	const mine = playing && view.turn === you;
	const legal = new Set(view.legal);
	const callable =
		mine &&
		rules?.lastCardPenalty !== null &&
		view.hand.length === 2 &&
		view.legal.length > 0;

	// Armed for this last card only: drawing instead must not carry it to the next.
	useEffect(() => {
		if (!callable) setArmed(false);
	}, [callable]);

	useEffect(() => {
		if (!mine) setPicking(null);
	}, [mine]);

	function play(card: CardId, suit?: Suit) {
		haptics.moveMade();
		controls.act({
			type: "play",
			card,
			suit,
			callLast: callable && armed ? true : undefined,
		});
		setArmed(false);
	}

	function tap(card: CardId, element: HostInstance) {
		if (!mine || !legal.has(card) || controls.pending) return false;
		flights.noteOrigin(card, element);
		if (rules && powerOf(rules, card)?.kind === "chooseSuit") {
			haptics.selectionChanged();
			setPicking(card);
			return true;
		}
		setPicking(null);
		play(card);
		return true;
	}

	const hint = sheddingHint(view, mine, words);
	const fresh = useFreshCards(view.hand, mine, view.events);
	const debtor = view.lastCardDebtor;
	const catchable =
		you !== null && debtor !== null && debtor !== you ? debtor : null;
	const canDraw = mine && view.canDraw;
	const mustDraw = view.legal.length === 0 || view.pendingDraw > 0;
	const drawLabel =
		view.pendingDraw > 0
			? plural(locale, view.pendingDraw, cards.shedding.drawPenalty)
			: cards.shedding.draw;
	const draw = () => {
		setPicking(null);
		haptics.valueEntered();
		controls.act({ type: "draw" });
	};
	const pileWidth = Math.round(Math.min(112, Math.max(72, screen * 0.235)));

	return (
		<TableFrame
			game={game}
			table={table}
			name={name}
			mine={mine}
			zones={flights.zones}
			error={controls.error}
			flightLayer={flights.layer}
			seats={
				<SeatRow
					table={table}
					handCounts={view.handCounts}
					turn={playing ? view.turn : null}
					flash={flights.flash}
					zones={flights.zones}
					controls={controls}
				/>
			}
			center={
				<View style={styles.center}>
					<Piles
						width={pileWidth}
						stockCount={view.stockCount}
						top={view.top}
						underTop={view.underTop}
						landing={flights.landing}
						zones={flights.zones}
						stockAction={
							canDraw
								? { label: drawLabel, run: draw, pulse: mustDraw }
								: undefined
						}
					>
						{table.seats.length > 2 ? (
							<View
								accessible
								accessibilityRole="image"
								accessibilityLabel={
									view.direction === 1
										? cards.table.directionClockwise
										: cards.table.directionCounter
								}
							>
								<Icon
									ios={
										view.direction === 1
											? "arrow.clockwise"
											: "arrow.counterclockwise"
									}
									android={
										view.direction === 1 ? "rotate_right" : "rotate_left"
									}
									size={22}
									color={cardColors.ivoryMuted}
								/>
							</View>
						) : null}
					</Piles>
					<PillRow>
						{view.pendingDraw > 0 ? (
							<Pill tone="alert">
								{fmt(cards.shedding.pendingDraw, { count: view.pendingDraw })}
							</Pill>
						) : null}
						{view.activeSuit ? (
							<Pill
								icon={
									<SuitIcon
										suit={view.activeSuit}
										size={13}
										color={
											view.activeSuit === "H" || view.activeSuit === "D"
												? cardColors.suitRed
												: cardColors.ivory
										}
									/>
								}
							>
								{fmt(cards.shedding.chosenSuit, {
									suit: cards.suits[view.activeSuit],
								})}
							</Pill>
						) : null}
						{view.openTable && view.pendingDraw === 0 ? (
							<Pill>{cards.shedding.openTable}</Pill>
						) : null}
					</PillRow>
				</View>
			}
			status={
				<View style={styles.status}>
					{picking ? (
						<View style={styles.picker}>
							<FeltText variant="heading" accessibilityRole="header">
								{cards.shedding.chooseSuit}
							</FeltText>
							<View style={styles.suits}>
								{SUITS.map((suit) => (
									<Pressable
										key={suit}
										accessibilityRole="button"
										accessibilityLabel={cards.suits[suit]}
										onPress={() => {
											play(picking, suit);
											setPicking(null);
										}}
										testID={`cards-suit-${suit}`}
										style={({ pressed }) => [
											styles.suit,
											pressed && styles.pressed,
										]}
									>
										<SuitIcon suit={suit} size={26} />
										<AppText
											variant="caption"
											numberOfLines={1}
											adjustsFontSizeToFit
											style={styles.suitName}
										>
											{cards.suits[suit]}
										</AppText>
									</Pressable>
								))}
							</View>
							<TableButton
								ghost
								label={t.common.actions.cancel}
								onPress={() => setPicking(null)}
								testID="cards-suit-cancel"
							/>
						</View>
					) : (
						<>
							<FeltText
								variant="heading"
								numberOfLines={1}
								style={mine ? styles.mine : null}
								testID="cards-turn"
							>
								{!playing
									? " "
									: mine
										? cards.table.yourTurn
										: fmt(cards.table.theirTurn, {
												name: seatName(cards, table, view.turn),
											})}
							</FeltText>
							<FeltText
								variant="secondary"
								numberOfLines={2}
								style={styles.hint}
								testID="cards-hint"
							>
								{hint ?? " "}
							</FeltText>
							<EventTicker events={view.events} table={table} />
							<View style={styles.actions}>
								{view.canCallLast ? (
									<TableButton
										label={cards.shedding.callLast}
										onPress={() => {
											haptics.valueEntered();
											controls.act({ type: "callLast" });
										}}
										testID="cards-call-last"
									/>
								) : null}
								{catchable !== null ? (
									<TableButton
										label={fmt(cards.shedding.catch, {
											name: seatName(cards, table, catchable),
										})}
										onPress={() => {
											haptics.moveMade();
											controls.act({ type: "catch", target: catchable });
										}}
										testID="cards-catch"
									/>
								) : null}
								{callable ? (
									<TableButton
										ghost
										selected={armed}
										label={
											armed
												? cards.shedding.callLastArmed
												: cards.shedding.callLast
										}
										accessibilityHint={cards.shedding.callLastHint}
										onPress={() => {
											haptics.selectionChanged();
											setArmed((current) => !current);
										}}
										testID="cards-arm-last"
									/>
								) : null}
								{canDraw ? (
									<TableButton
										ghost={!mustDraw}
										label={drawLabel}
										disabled={controls.pending}
										onPress={draw}
										testID="cards-draw"
									/>
								) : null}
								{mine && view.canPass ? (
									<TableButton
										ghost
										label={cards.shedding.pass}
										disabled={controls.pending}
										onPress={() => controls.act({ type: "pass" })}
										testID="cards-pass"
									/>
								) : null}
								{you !== null && table.seats[you]?.autopilot ? (
									<TableButton
										label={cards.table.autopilotBack}
										onPress={() => controls.setAutopilot(you, false)}
										testID="cards-autopilot-back"
									/>
								) : null}
							</View>
						</>
					)}
				</View>
			}
			hand={
				<Hand
					cards={sortCards(view.hand, "suit")}
					handSize={view.hand.length}
					fresh={fresh}
					zones={flights.zones}
					stateOf={(card) => {
						const canPlay = mine && legal.has(card);
						return {
							playable: canPlay,
							dim: mine && !canPlay,
							disabled: !canPlay,
						};
					}}
					onTap={tap}
				/>
			}
			overlays={
				view.phase === "finished" ? (
					<EndPanel
						table={table}
						winners={view.winners}
						controls={controls}
						title={
							you !== null && view.winners.includes(you)
								? cards.shedding.youWin
								: fmt(cards.shedding.winner, {
										name: view.winners
											.map((seat) => seatName(cards, table, seat))
											.join(" & "),
									})
						}
					>
						<FeltText variant="label" muted>
							{cards.shedding.standings.toUpperCase()}
						</FeltText>
						{view.handCounts
							.map((count, seat) => ({ count, seat }))
							.sort((a, b) => a.count - b.count)
							.map(({ count, seat }) => (
								<View key={seat} style={styles.standing}>
									<FeltText variant="body" numberOfLines={1} style={styles.who}>
										{seatName(cards, table, seat)}
									</FeltText>
									<FeltText variant="body">
										{count === 0 ? cards.table.noCards : count}
									</FeltText>
								</View>
							))}
					</EndPanel>
				) : null
			}
		/>
	);
}

const styles = StyleSheet.create({
	center: { alignItems: "center", gap: spacing.md },
	// As tall as the suit picker, so the table doesn't jump when it opens.
	status: {
		alignSelf: "stretch",
		alignItems: "center",
		justifyContent: "flex-end",
		gap: spacing.xxs,
		minHeight: 170,
	},
	mine: { color: cardColors.gold },
	hint: { textAlign: "center", minHeight: 20 },
	actions: {
		flexDirection: "row",
		flexWrap: "wrap",
		justifyContent: "center",
		gap: spacing.sm,
		minHeight: metrics.hitTarget,
		marginTop: spacing.xs,
	},
	picker: { alignSelf: "stretch", alignItems: "center", gap: spacing.sm },
	suits: { flexDirection: "row", gap: spacing.sm, alignSelf: "stretch" },
	suit: {
		flex: 1,
		minHeight: 64,
		alignItems: "center",
		justifyContent: "center",
		gap: spacing.xxs,
		borderRadius: radius.md,
		backgroundColor: CARD_PAPER,
	},
	suitName: { color: cardColors.onGold },
	pressed: { opacity: opacity.pressed },
	standing: {
		flexDirection: "row",
		justifyContent: "space-between",
		gap: spacing.md,
	},
	who: { flexShrink: 1 },
});
