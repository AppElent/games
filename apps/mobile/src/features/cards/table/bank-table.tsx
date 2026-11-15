/** A table for the bank family: everyone plays their own hand against the bank. */
import type { BankView } from "@arcadeclub/core/cards/bank";
import type { CardGame } from "@arcadeclub/core/cards/engine";
import {
	bankHint,
	bankSeatNote,
	cardName,
	seatName,
	signedPoints,
} from "@arcadeclub/core/cards/table-view";
import { useMemo, useState } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { haptics } from "../../../feedback/haptics";
import { fmt, plural, useI18n } from "../../../i18n";
import { cardColors, metrics, radius, spacing } from "../../../theme";
import { AppText } from "../../../ui/text";
import { PlayingCard } from "../deck/playing-card";
import { Sheet } from "../deck/sheet";
import { useCardWords } from "../deck/use-card-words";
import { FeltText, Pill, PillRow, TableButton } from "./felt-ui";
import { useFlights } from "./flights";
import { Hand } from "./hand";
import { EndPanel } from "./result-panel";
import { ScoreBoard } from "./score-board";
import { SeatRow } from "./seat-row";
import { EventTicker, TableFrame } from "./table-frame";
import type { CardTableBundle, CardTableControls } from "./use-card-table";
import { useFreshCards } from "./use-fresh-cards";

const NO_MELD = () => null;
const NO_CARDS: readonly string[] = [];
const BANK_STEP = 0.45;

export function BankTable({
	game,
	table,
	view,
	controls,
}: {
	game: CardGame;
	table: CardTableBundle;
	view: BankView;
	controls: CardTableControls;
}) {
	const { t, locale } = useI18n();
	const cards = t.games.cards;
	const words = useCardWords();
	const { width: screen } = useWindowDimensions();
	const [scoresOpen, setScoresOpen] = useState(false);
	const flights = useFlights(
		view.events,
		table.you,
		table.seats.length,
		NO_MELD,
	);

	const name = cards.games[game.id].name;
	const you = table.you;
	const playing = view.phase === "play";
	const mine = playing && view.turn === you;
	const hint = bankHint(view, you, words);
	const hand = you === null ? NO_CARDS : view.hands[you];
	const fresh = useFreshCards(hand, mine, view.events);
	const yourNote = you === null ? "" : bankSeatNote(words, view, you);
	const finished = view.phase === "finished";
	const best = Math.max(...view.totals);
	const standings = view.totals
		.map((total, seat) => ({ total, seat }))
		.sort((a, b) => b.total - a.total);
	const roundLabel = fmt(cards.rummy.roundLabel, {
		round: view.round,
		total: view.totalRounds,
	});
	const cardWidth = Math.round(Math.min(84, Math.max(58, screen * 0.18)));
	const stockWidth = Math.round(cardWidth * 0.7);
	const bankShown = view.bank.length > 0;
	const bankLabel = bankShown
		? `${cards.bank.bankName}: ${fmt(cards.bank.bankTotal, { total: view.bankTotal })}. ${view.bank
				.map((card) => (card ? cardName(cards, card) : cards.bank.hidden))
				.join(", ")}`
		: cards.bank.bankName;
	const stockLabel = `${cards.table.stock}: ${plural(locale, view.stockCount, cards.table.stockCount)}`;

	const scoresAction = useMemo(
		() => [
			{
				label: cards.rummy.scoresButton,
				ios: "list.number" as const,
				android: "format_list_numbered" as const,
				onPress: () => setScoresOpen(true),
				testID: "cards-scores",
			},
		],
		[cards.rummy.scoresButton],
	);

	return (
		<TableFrame
			game={game}
			table={table}
			name={name}
			mine={mine}
			zones={flights.zones}
			error={controls.error}
			flightLayer={flights.layer}
			headerActions={scoresAction}
			seats={
				<SeatRow
					table={table}
					handCounts={view.handCounts}
					turn={playing ? view.turn : null}
					flash={flights.flash}
					zones={flights.zones}
					controls={controls}
					note={(seat) => bankSeatNote(words, view, seat)}
				/>
			}
			center={
				<View style={styles.board}>
					<View style={styles.bankRow}>
						<View
							accessible
							accessibilityLabel={bankLabel}
							style={styles.bank}
							testID="cards-bank"
						>
							<FeltText variant="label" muted>
								{bankShown
									? `${cards.bank.bankName.toUpperCase()} · ${view.bankTotal}`
									: cards.bank.bankName.toUpperCase()}
							</FeltText>
							<View
								ref={flights.zones.ref("bank", cardWidth)}
								collapsable={false}
								style={[styles.fan, { minHeight: cardWidth * 1.4 }]}
							>
								{view.bank.map((card, index) => (
									<View
										key={card ?? "hole"}
										style={
											index > 0
												? { marginLeft: cardWidth * BANK_STEP - cardWidth }
												: null
										}
									>
										<PlayingCard card={card} width={cardWidth} />
									</View>
								))}
							</View>
						</View>
						<View
							ref={flights.zones.ref("stock", stockWidth)}
							collapsable={false}
							accessible
							accessibilityLabel={stockLabel}
							testID="cards-stock"
						>
							<PlayingCard card={null} width={stockWidth} />
						</View>
					</View>
					<FeltText variant="label" muted testID="cards-round">
						{roundLabel.toUpperCase()}
					</FeltText>
					<PillRow>{yourNote ? <Pill>{yourNote}</Pill> : null}</PillRow>
				</View>
			}
			status={
				<View style={styles.status}>
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
						{view.canStake
							? view.stakeOptions.map((amount) => (
									<TableButton
										key={amount}
										label={plural(locale, amount, cards.bank.stakeButton)}
										disabled={controls.pending}
										onPress={() => {
											haptics.selectionChanged();
											controls.act({ type: "stake", amount });
										}}
										testID={`cards-stake-${amount}`}
									/>
								))
							: null}
						{mine ? (
							<TableButton
								label={cards.bank.hit}
								disabled={controls.pending}
								onPress={() => {
									haptics.valueEntered();
									controls.act({ type: "hit" });
								}}
								testID="cards-hit"
							/>
						) : null}
						{mine ? (
							<TableButton
								ghost
								label={cards.bank.stand}
								disabled={controls.pending}
								onPress={() => {
									haptics.moveMade();
									controls.act({ type: "stand" });
								}}
								testID="cards-stand"
							/>
						) : null}
						{view.canDouble ? (
							<TableButton
								ghost
								label={cards.bank.double}
								disabled={controls.pending}
								onPress={() => {
									haptics.moveMade();
									controls.act({ type: "double" });
								}}
								testID="cards-double"
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
				</View>
			}
			hand={
				<Hand
					cards={hand}
					handSize={hand.length}
					fresh={fresh}
					zones={flights.zones}
				/>
			}
			overlays={
				<>
					{finished ? (
						<EndPanel
							table={table}
							winners={view.winners}
							controls={controls}
							title={
								view.winners.length > 1
									? cards.rummy.matchTie
									: you !== null && view.winners.includes(you)
										? cards.rummy.matchYouWin
										: fmt(cards.rummy.matchWinner, {
												name: seatName(cards, table, view.winners[0]),
											})
							}
						>
							<FeltText variant="caption" muted style={styles.center}>
								{cards.bank.highestWins}
							</FeltText>
							{standings.map(({ total, seat }) => (
								<View
									key={seat}
									style={[styles.standing, total === best && styles.best]}
								>
									<FeltText variant="body" numberOfLines={1} style={styles.who}>
										{seatName(cards, table, seat)}
									</FeltText>
									<FeltText variant="body">
										{signedPoints(words, total)}
									</FeltText>
								</View>
							))}
						</EndPanel>
					) : null}
					<Sheet
						open={scoresOpen}
						title={cards.rummy.scoresHeading}
						onClose={() => setScoresOpen(false)}
					>
						<AppText variant="secondary">{roundLabel}</AppText>
						<ScoreBoard
							table={table}
							scores={view.results}
							totals={view.totals}
							empty={cards.rummy.noScores}
							totalLabel={cards.rummy.scoreTotal}
						/>
						<AppText variant="secondary">{cards.bank.highestWins}</AppText>
					</Sheet>
				</>
			}
		/>
	);
}

const styles = StyleSheet.create({
	board: { alignItems: "center", gap: spacing.md },
	bankRow: {
		flexDirection: "row",
		alignItems: "flex-end",
		justifyContent: "center",
		gap: spacing.xl,
	},
	bank: { alignItems: "center", gap: spacing.sm },
	fan: { flexDirection: "row", alignItems: "center" },
	status: {
		alignSelf: "stretch",
		alignItems: "center",
		justifyContent: "flex-end",
		gap: spacing.xxs,
	},
	mine: { color: cardColors.gold },
	hint: { textAlign: "center", minHeight: 20 },
	center: { textAlign: "center" },
	actions: {
		flexDirection: "row",
		flexWrap: "wrap",
		justifyContent: "center",
		gap: spacing.sm,
		minHeight: metrics.hitTarget,
		marginTop: spacing.xs,
	},
	standing: {
		flexDirection: "row",
		justifyContent: "space-between",
		gap: spacing.md,
		paddingHorizontal: spacing.sm,
		paddingVertical: spacing.xs,
		borderRadius: radius.sm,
	},
	best: { backgroundColor: cardColors.goldSoft },
	who: { flexShrink: 1 },
});
