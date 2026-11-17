/** A table for Gin Rummy: two players, melds kept in hand until someone knocks. */
import type { CardId } from "@arcadeclub/core/cards/deck";
import { type CardGame, familyRules } from "@arcadeclub/core/cards/engine";
import type { GinView } from "@arcadeclub/core/cards/gin";
import type { Meld } from "@arcadeclub/core/cards/melds";
import {
	cardName,
	ginHint,
	ginLayoffOrder,
	ginResultText,
	ginTurn,
	groupGinHand,
	meldCardNames,
	seatName,
	sortCards,
} from "@arcadeclub/core/cards/table-view";
import { useEffect, useMemo, useRef, useState } from "react";
import {
	type HostInstance,
	Pressable,
	ScrollView,
	type ScrollViewInstance,
	StyleSheet,
	useWindowDimensions,
	View,
} from "react-native";
import { haptics } from "../../../feedback/haptics";
import { fmt, plural, useI18n } from "../../../i18n";
import { cardColors, metrics, radius, spacing } from "../../../theme";
import { Icon } from "../../../ui/icon";
import { AppText } from "../../../ui/text";
import { Sheet } from "../deck/sheet";
import { useCardWords } from "../deck/use-card-words";
import { FeltText, TableButton } from "./felt-ui";
import { useFlights } from "./flights";
import { Hand } from "./hand";
import { DeadwoodView, Fan, MeldView } from "./melds";
import { Piles } from "./piles";
import { EndPanel, TablePanel } from "./result-panel";
import { ScoreBoard } from "./score-board";
import { SeatRow } from "./seat-row";
import { EventTicker, TableFrame } from "./table-frame";
import type { CardTableBundle, CardTableControls } from "./use-card-table";
import { useFreshCards } from "./use-fresh-cards";

type Sort = "melds" | "suit";

const REVEAL_CARD = 34;
const REVEAL_STEP = 19;

export function GinTable({
	game,
	table,
	view,
	controls,
}: {
	game: CardGame;
	table: CardTableBundle;
	view: GinView;
	controls: CardTableControls;
}) {
	const { t, locale } = useI18n();
	const cards = t.games.cards;
	const words = useCardWords();
	const { width: screen } = useWindowDimensions();
	const [selected, setSelected] = useState<CardId[]>([]);
	const [sortBy, setSortBy] = useState<Sort>("melds");
	const [scoresOpen, setScoresOpen] = useState(false);
	const [resultShown, setResultShown] = useState(false);
	const meldScroller = useRef<ScrollViewInstance>(null);
	const meldTops = useRef(new Map<number, number>());
	const melds = view.melds;
	const meldCard = useMemo(
		() => (id: number) => melds.find((m) => m.id === id)?.cards[0] ?? null,
		[melds],
	);
	const flights = useFlights(
		view.events,
		table.you,
		table.seats.length,
		meldCard,
	);

	const rules = familyRules(game, table.options, table.seats.length, "gin");
	if (!rules) {
		throw new Error("GinTable needs a gin game");
	}
	const name = cards.games[game.id].name;
	const you = table.you;
	const turn = ginTurn({ view, rules, you, selected });
	const { live, mine, drawing, playing, layingOff, selection, singleCard } =
		turn;
	const knocker = view.knock ? seatName(cards, table, view.knock.seat) : "";

	// A rematch shows its own last hand again when that match ends.
	useEffect(() => {
		if (view.phase !== "finished") setResultShown(false);
	}, [view.phase]);

	// A selection belongs to one step of one turn.
	const step = playing ? "play" : layingOff ? "layoff" : "wait";
	// biome-ignore lint/correctness/useExhaustiveDependencies: clears when the step changes.
	useEffect(() => {
		setSelected([]);
	}, [step]);

	const fresh = useFreshCards(view.hand, mine, view.events);
	const handShown =
		sortBy === "melds"
			? groupGinHand(view.hand, rules)
			: sortCards(view.hand, "suit");

	// A lay-off target can sit below the fold.
	const targetId = melds.find((meld) => ginLayoffOrder(turn, meld))?.id;
	useEffect(() => {
		const y =
			targetId === undefined ? undefined : meldTops.current.get(targetId);
		if (y !== undefined) {
			meldScroller.current?.scrollTo({ y: Math.max(0, y - spacing.sm) });
		}
	}, [targetId]);

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

	function tap(card: CardId, element: HostInstance) {
		if (!playing && !layingOff) return false;
		// The flight leaves from where the card is now, whichever card it turns out to be.
		flights.noteOrigin(card, element);
		haptics.selectionChanged();
		setSelected((current) =>
			current.includes(card)
				? current.filter((item) => item !== card)
				: // A turn ends on one card, so picking another replaces it.
					playing
					? [card]
					: [...current, card],
		);
		return true;
	}

	function finishTurn(type: "discard" | "knock") {
		if (!singleCard) return;
		haptics.moveMade();
		controls.act({ type, card: singleCard });
		setSelected([]);
	}

	function layOff(meld: Meld, order: CardId[]) {
		haptics.moveMade();
		controls.act({ type: "layOff", meldId: meld.id, cards: order });
		setSelected([]);
	}

	const hint =
		ginHint(turn, view, {
			cards,
			fmt,
			serverErrors: t.serverErrors,
			knocker,
		}) ??
		(view.phase === "layoff" && !mine
			? fmt(cards.gin.layoffWait, { name: seatName(cards, table, view.turn) })
			: null);

	const meldKind = (meld: Meld) =>
		meld.kind === "set" ? cards.rummy.meldSet : cards.rummy.meldRun;

	const finished = view.phase === "finished";
	const handDone = view.phase === "handOver" || finished;
	const result = view.result;
	const best = Math.max(...view.totals);
	const standings = view.totals
		.map((total, seat) => ({ total, seat }))
		.sort((a, b) => b.total - a.total);
	const pileWidth = Math.round(Math.min(70, Math.max(52, screen * 0.14)));
	const meldCardWidth = Math.round(Math.min(52, Math.max(38, screen * 0.11)));
	const handLabel = fmt(cards.gin.handLabel, {
		round: view.round,
		target: view.targetScore,
	});

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
					turn={live ? view.turn : null}
					flash={flights.flash}
					zones={flights.zones}
					controls={controls}
					note={(seat) =>
						view.scores.length > 0
							? plural(locale, view.totals[seat], cards.rummy.totalPoints)
							: ""
					}
				/>
			}
			center={
				<View style={styles.board}>
					<View style={styles.boardTop}>
						<Piles
							width={pileWidth}
							stockCount={view.stockCount}
							top={view.top}
							underTop={view.underTop}
							landing={flights.landing}
							zones={flights.zones}
							stockAction={
								drawing
									? {
											label: cards.gin.drawStock,
											run: () => {
												haptics.valueEntered();
												controls.act({ type: "drawStock" });
											},
											pulse: true,
										}
									: undefined
							}
							discardAction={
								turn.canTakeDiscard && view.top
									? {
											label: fmt(cards.gin.takeDiscard, {
												card: cardName(cards, view.top),
											}),
											run: () => {
												haptics.valueEntered();
												controls.act({ type: "takeDiscard" });
											},
											pulse: true,
										}
									: undefined
							}
						/>
						<View style={styles.boardSide}>
							<FeltText variant="label" muted testID="cards-round">
								{handLabel.toUpperCase()}
							</FeltText>
							{you !== null ? (
								<Pressable
									accessibilityRole="button"
									accessibilityLabel={
										sortBy === "melds"
											? cards.table.sortBySuit
											: cards.gin.sortByMelds
									}
									onPress={() => {
										haptics.selectionChanged();
										setSortBy((current) =>
											current === "melds" ? "suit" : "melds",
										);
									}}
									testID="cards-sort"
									style={styles.sort}
								>
									<Icon
										ios="arrow.up.arrow.down"
										android="swap_vert"
										size={14}
										color={cardColors.ivory}
									/>
									<FeltText variant="caption" numberOfLines={1}>
										{sortBy === "melds"
											? cards.table.sortBySuit
											: cards.gin.sortByMelds}
									</FeltText>
								</Pressable>
							) : null}
						</View>
					</View>
					<ScrollView
						ref={meldScroller}
						style={styles.melds}
						contentContainerStyle={styles.meldsContent}
						testID="cards-melds"
					>
						{view.melds.map((meld) => {
							const order = ginLayoffOrder(turn, meld);
							const kind = meldKind(meld).toLowerCase();
							const faces = meldCardNames(cards, meld).join(", ");
							return (
								<MeldView
									key={meld.id}
									meld={meld}
									cardWidth={meldCardWidth}
									zones={flights.zones}
									target={order !== null}
									label={
										order
											? `${fmt(cards.gin.layOffOn, { kind })}: ${faces}`
											: `${fmt(cards.gin.knockerMelds, { name: knocker })}: ${meldKind(meld)}: ${faces}`
									}
									onPress={() => {
										if (order) layOff(meld, order);
									}}
									onLayoutY={(y) => meldTops.current.set(meld.id, y)}
								/>
							);
						})}
						{view.knockerDeadwood.length > 0 ? (
							<DeadwoodView
								cards={sortCards(view.knockerDeadwood, "suit")}
								cardWidth={meldCardWidth}
								label={`${fmt(cards.gin.knockerDeadwood, { name: knocker })}: ${view.knockerDeadwood
									.map((card) => cardName(cards, card))
									.join(", ")}`}
							/>
						) : null}
					</ScrollView>
				</View>
			}
			status={
				<>
					<FeltText
						variant="heading"
						numberOfLines={1}
						style={mine ? styles.mine : null}
						testID="cards-turn"
					>
						{!live
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
					{turn.deadwood !== null ? (
						<FeltText variant="caption" muted testID="cards-deadwood">
							{fmt(cards.gin.deadwood, { points: turn.deadwood })}
						</FeltText>
					) : null}
					<EventTicker events={view.events} table={table} />
					<View style={styles.actions}>
						{turn.canKnock ? (
							<TableButton
								label={
									turn.gin
										? cards.gin.goGin
										: fmt(cards.gin.knock, {
												deadwood: turn.knockDeadwood ?? 0,
											})
								}
								disabled={controls.pending}
								onPress={() => finishTurn("knock")}
								testID="cards-knock"
							/>
						) : null}
						{turn.canDiscard ? (
							<TableButton
								ghost={turn.canKnock}
								label={cards.gin.discardCard}
								disabled={controls.pending}
								onPress={() => finishTurn("discard")}
								testID="cards-discard-action"
							/>
						) : null}
						{layingOff ? (
							<TableButton
								label={cards.gin.finishLayoff}
								disabled={controls.pending}
								onPress={() => {
									haptics.moveMade();
									controls.act({ type: "finishLayoff" });
								}}
								testID="cards-finish-layoff"
							/>
						) : null}
						{selection.length > 1 ? (
							<TableButton
								ghost
								label={cards.rummy.clearSelection}
								onPress={() => setSelected([])}
								testID="cards-clear"
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
			}
			hand={
				<Hand
					cards={handShown}
					handSize={view.hand.length}
					fresh={fresh}
					zones={flights.zones}
					stateOf={(card) => ({
						selected: selection.includes(card),
						disabled: !playing && !layingOff,
					})}
					onTap={tap}
				/>
			}
			overlays={
				<>
					{handDone && result && !(finished && resultShown) ? (
						<TablePanel
							title={fmt(cards.gin.handOver, { round: view.round })}
							testID="cards-round-over"
							foot={
								!finished && you === null ? (
									<FeltText variant="secondary" muted style={styles.center}>
										{cards.gin.waitingNextHand}
									</FeltText>
								) : (
									<TableButton
										label={
											finished
												? cards.rummy.seeResult
												: fmt(cards.gin.nextHand, { round: view.round + 1 })
										}
										disabled={controls.pending}
										onPress={() =>
											finished
												? setResultShown(true)
												: controls.act({ type: "nextRound" })
										}
										testID="cards-next-round"
									/>
								)
							}
						>
							<FeltText variant="body" style={styles.center}>
								{ginResultText(result, words, table)}
							</FeltText>
							{result.shown.map((shown, seat) => (
								// biome-ignore lint/suspicious/noArrayIndexKey: seats are fixed during a game.
								<View key={seat} style={styles.revealed}>
									<FeltText
										variant="caption"
										muted
										numberOfLines={1}
										style={styles.revealedName}
									>
										{seatName(cards, table, seat)}
									</FeltText>
									<ScrollView
										horizontal
										showsHorizontalScrollIndicator={false}
										contentContainerStyle={styles.revealedCards}
									>
										{shown.melds.map((meld) => (
											<Fan
												key={meld.join()}
												cards={meld}
												width={REVEAL_CARD}
												step={REVEAL_STEP}
											/>
										))}
										{shown.deadwood.length > 0 ? (
											<DeadwoodView
												cards={sortCards(shown.deadwood, "suit")}
												cardWidth={REVEAL_CARD}
												label={plural(
													locale,
													result.deadwood[seat],
													cards.gin.deadwoodPoints,
												)}
											/>
										) : null}
									</ScrollView>
								</View>
							))}
							<ScoreBoard
								table={table}
								scores={view.scores}
								totals={view.totals}
								empty={cards.gin.noScores}
								totalLabel={cards.gin.scoreTotal}
								onFelt
							/>
						</TablePanel>
					) : null}
					{finished && resultShown ? (
						<EndPanel
							table={table}
							winners={view.winners}
							controls={controls}
							title={
								you !== null && view.winners.includes(you)
									? cards.rummy.matchYouWin
									: fmt(cards.rummy.matchWinner, {
											name: seatName(cards, table, view.winners[0]),
										})
							}
						>
							<FeltText variant="caption" muted style={styles.center}>
								{fmt(cards.gin.firstTo, { target: view.targetScore })}
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
										{plural(locale, total, cards.rummy.totalPoints)}
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
						<AppText variant="secondary">{handLabel}</AppText>
						<ScoreBoard
							table={table}
							scores={view.scores}
							totals={view.totals}
							empty={cards.gin.noScores}
							totalLabel={cards.gin.scoreTotal}
						/>
						<AppText variant="secondary">
							{fmt(cards.gin.firstTo, { target: view.targetScore })}
						</AppText>
					</Sheet>
				</>
			}
		/>
	);
}

const styles = StyleSheet.create({
	board: { flex: 1, minHeight: 0, gap: spacing.xs },
	boardTop: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		gap: spacing.md,
		paddingHorizontal: spacing.lg,
	},
	boardSide: { flexShrink: 1, alignItems: "flex-end", gap: spacing.sm },
	sort: {
		minHeight: metrics.hitTarget,
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.xs,
		paddingHorizontal: spacing.md,
		borderRadius: radius.pill,
		backgroundColor: cardColors.chip,
		borderWidth: 1,
		borderColor: cardColors.ivoryLine,
	},
	melds: { flex: 1, minHeight: 0 },
	meldsContent: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: spacing.sm,
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.sm,
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
	revealed: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
	revealedName: { width: 76 },
	revealedCards: { alignItems: "center", gap: spacing.sm },
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
