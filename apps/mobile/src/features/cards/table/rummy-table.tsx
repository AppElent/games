/** A table for the rummy family: build sets and runs, keep your hand light. */
import type { CardId } from "@arcadeclub/core/cards/deck";
import {
	type CardGameDefinition,
	type CardGameId,
	resolvedRules,
} from "@arcadeclub/core/cards/engine";
import type { Meld } from "@arcadeclub/core/cards/melds";
import type { RummyView } from "@arcadeclub/core/cards/rummy";
import {
	cardName,
	meldCardNames,
	rummyHint,
	rummyMeldAction,
	rummyTurn,
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
import { PlayingCard } from "../deck/playing-card";
import { Sheet } from "../deck/sheet";
import { useCardWords } from "../deck/use-card-words";
import { FeltText, TableButton } from "./felt-ui";
import { type CardZones, useFlights } from "./flights";
import { Hand } from "./hand";
import { Piles } from "./piles";
import { EndPanel, TablePanel } from "./result-panel";
import { ScoreBoard } from "./score-board";
import { SeatRow } from "./seat-row";
import { EventTicker, TableFrame } from "./table-frame";
import type { CardTableBundle, CardTableControls } from "./use-card-table";
import { useFreshCards } from "./use-fresh-cards";

const MELD_STEP = 0.42;
const REVEAL_CARD = 34;
const REVEAL_STEP = 19;

function Fan({
	cards,
	width,
	step,
}: {
	cards: readonly CardId[];
	width: number;
	step: number;
}) {
	return (
		<View style={styles.fan}>
			{cards.map((card, index) => (
				<View
					key={card}
					style={index > 0 ? { marginLeft: step - width } : null}
				>
					<PlayingCard card={card} width={width} />
				</View>
			))}
		</View>
	);
}

function MeldView({
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

export function RummyTable({
	game,
	table,
	view,
	controls,
}: {
	game: CardGameDefinition;
	table: CardTableBundle;
	view: RummyView;
	controls: CardTableControls;
}) {
	const { t, locale } = useI18n();
	const cards = t.games.cards;
	const words = useCardWords();
	const { width: screen } = useWindowDimensions();
	const [selected, setSelected] = useState<CardId[]>([]);
	const [staged, setStaged] = useState<CardId[][]>([]);
	const [sortBy, setSortBy] = useState<"suit" | "rank">("suit");
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

	const resolved = resolvedRules(game, table.options);
	if (resolved.family !== "rummy") {
		throw new Error("RummyTable needs a rummy game");
	}
	const rules = resolved.rules;
	const name = cards.games[game.id as CardGameId].name;
	const you = table.you;
	const turn = rummyTurn({ view, rules, you, selected, staged });
	const {
		live,
		mine,
		drawing,
		playing,
		opened,
		inHand,
		selection,
		shape,
		shapePoints,
		stagedPoints,
		keepsOne,
		canOpen,
		openingWithShape,
		canOpenNow,
		singleCard,
		canDiscard,
		canTakeDiscard,
	} = turn;

	// A rematch shows its own last round again when that game ends.
	useEffect(() => {
		if (view.phase !== "finished") setResultShown(false);
	}, [view.phase]);

	// Anything selected or set aside belongs to this turn only.
	useEffect(() => {
		if (!playing) {
			setSelected([]);
			setStaged([]);
		}
	}, [playing]);

	const fresh = useFreshCards(view.hand, mine, view.events);
	const handShown = sortCards(inHand, sortBy);

	// A target can sit below the fold when the table is full of melds.
	const targetId = melds.find((meld) => rummyMeldAction(turn, meld))?.id;
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
		if (!playing) return false;
		// The flight leaves from where the card is now, whichever card it turns out to be.
		flights.noteOrigin(card, element);
		haptics.selectionChanged();
		setSelected((current) =>
			current.includes(card)
				? current.filter((item) => item !== card)
				: [...current, card],
		);
		return true;
	}

	function runMeldAction(
		meld: Meld,
		action: NonNullable<ReturnType<typeof rummyMeldAction>>,
	) {
		haptics.moveMade();
		controls.act(
			action.type === "add"
				? {
						type: "layDown",
						additions: [{ meldId: meld.id, cards: action.order }],
					}
				: {
						type: "layDown",
						swaps: [{ meldId: meld.id, card: selection[0] }],
					},
		);
		setSelected([]);
	}

	function layDown(groups: readonly (readonly CardId[])[]) {
		haptics.moveMade();
		controls.act({
			type: "layDown",
			melds: groups.map((group) => [...group]),
		});
		setStaged([]);
		setSelected([]);
	}

	function discard() {
		if (!singleCard) return;
		haptics.moveMade();
		controls.act({ type: "discard", card: singleCard });
		setSelected([]);
	}

	const hint = rummyHint(turn, view, rules, staged, {
		serverErrors: t.serverErrors,
		words,
	});

	const meldKind = (meld: Meld) =>
		meld.kind === "set" ? cards.rummy.meldSet : cards.rummy.meldRun;

	const finished = view.phase === "finished";
	const best = Math.min(...view.totals);
	const standings = view.totals
		.map((total, seat) => ({ total, seat }))
		.sort((a, b) => a.total - b.total);
	const pileWidth = Math.round(Math.min(70, Math.max(52, screen * 0.14)));
	const meldCardWidth = Math.round(Math.min(52, Math.max(38, screen * 0.11)));
	const roundLabel = fmt(cards.rummy.roundLabel, {
		round: view.round,
		total: view.totalRounds,
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
					note={(seat) => {
						const points =
							view.scores.length > 0
								? plural(locale, view.totals[seat], cards.rummy.totalPoints)
								: "";
						return view.opened[seat] ? `✓ ${points}`.trim() : points;
					}}
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
											label: cards.rummy.drawStock,
											run: () => {
												haptics.valueEntered();
												controls.act({ type: "drawStock" });
											},
											pulse: true,
										}
									: undefined
							}
							discardAction={
								canTakeDiscard && view.top
									? {
											label: fmt(cards.rummy.takeDiscard, {
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
								{roundLabel.toUpperCase()}
							</FeltText>
							{you !== null ? (
								<Pressable
									accessibilityRole="button"
									accessibilityLabel={
										sortBy === "suit"
											? cards.table.sortByRank
											: cards.table.sortBySuit
									}
									onPress={() => {
										haptics.selectionChanged();
										setSortBy((current) =>
											current === "suit" ? "rank" : "suit",
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
										{sortBy === "suit"
											? cards.table.sortByRank
											: cards.table.sortBySuit}
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
						{view.melds.length === 0 ? (
							<FeltText variant="secondary" muted style={styles.empty}>
								{cards.rummy.tableEmpty}
							</FeltText>
						) : null}
						{view.melds.map((meld) => {
							const action = rummyMeldAction(turn, meld);
							const kind = meldKind(meld).toLowerCase();
							const faces = meldCardNames(cards, meld).join(", ");
							return (
								<MeldView
									key={meld.id}
									meld={meld}
									cardWidth={meldCardWidth}
									zones={flights.zones}
									target={action !== null}
									label={
										action
											? `${fmt(
													action.type === "add"
														? cards.rummy.addToMeld
														: cards.rummy.swapOnMeld,
													{ kind },
												)}: ${faces}`
											: `${meldKind(meld)}: ${faces}`
									}
									onPress={() => {
										if (action) runMeldAction(meld, action);
									}}
									onLayoutY={(y) => meldTops.current.set(meld.id, y)}
								/>
							);
						})}
					</ScrollView>
				</View>
			}
			status={
				<>
					{staged.length > 0 ? (
						<View
							style={styles.staged}
							accessible
							accessibilityLabel={`${cards.rummy.stagedLabel}: ${staged
								.flat()
								.map((card) => cardName(cards, card))
								.join(", ")}`}
						>
							{staged.map((group) => (
								<Fan
									key={group.join()}
									cards={group}
									width={REVEAL_CARD}
									step={REVEAL_STEP}
								/>
							))}
						</View>
					) : null}
					{playing && !opened && staged.length > 0 ? (
						<View style={styles.opening}>
							<FeltText variant="caption" style={styles.center}>
								{fmt(cards.rummy.openingProgress, {
									have: stagedPoints,
									needed: rules.openingPoints,
								})}
							</FeltText>
							<View style={styles.meter}>
								<View
									style={[
										styles.meterFill,
										{
											width: `${Math.min(100, (stagedPoints / rules.openingPoints) * 100)}%`,
										},
									]}
								/>
							</View>
						</View>
					) : null}
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
					<EventTicker events={view.events} table={table} />
					<View style={styles.actions}>
						{canOpenNow ? (
							<TableButton
								label={fmt(cards.rummy.openingConfirm, {
									points: openingWithShape,
								})}
								disabled={controls.pending}
								onPress={() => layDown([...staged, selection])}
								testID="cards-open-now"
							/>
						) : null}
						{playing && !opened && shape ? (
							<TableButton
								ghost={canOpenNow}
								label={fmt(cards.rummy.stageMeld, { points: shapePoints })}
								onPress={() => {
									haptics.selectionChanged();
									setStaged((current) => [...current, selection]);
									setSelected([]);
								}}
								testID="cards-stage"
							/>
						) : null}
						{playing && opened && shape && keepsOne ? (
							<TableButton
								label={fmt(cards.rummy.layMeld, { points: shapePoints })}
								disabled={controls.pending}
								onPress={() => layDown([selection])}
								testID="cards-lay"
							/>
						) : null}
						{canOpen ? (
							<TableButton
								label={fmt(cards.rummy.openingConfirm, {
									points: stagedPoints,
								})}
								disabled={controls.pending}
								onPress={() => layDown(staged)}
								testID="cards-open-staged"
							/>
						) : null}
						{staged.length > 0 ? (
							<TableButton
								ghost
								label={cards.rummy.openingCancel}
								onPress={() => setStaged([])}
								testID="cards-take-back"
							/>
						) : null}
						{canDiscard ? (
							<TableButton
								label={cards.rummy.discardCard}
								disabled={controls.pending}
								onPress={discard}
								testID="cards-discard-action"
							/>
						) : null}
						{playing && selection.length > 1 ? (
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
						disabled: !playing,
					})}
					onTap={tap}
				/>
			}
			overlays={
				<>
					{view.phase === "roundOver" || (finished && !resultShown) ? (
						<TablePanel
							title={fmt(cards.rummy.roundOver, { round: view.round })}
							testID="cards-round-over"
							foot={
								!finished && you === null ? (
									<FeltText variant="secondary" muted style={styles.center}>
										{cards.rummy.waitingNextRound}
									</FeltText>
								) : (
									<TableButton
										label={
											finished
												? cards.rummy.seeResult
												: fmt(cards.rummy.nextRound, { round: view.round + 1 })
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
								{view.roundWinner === null
									? cards.rummy.roundNoWinner
									: view.roundWinner === you
										? cards.rummy.roundYouOut
										: fmt(cards.rummy.roundWinner, {
												name: seatName(cards, table, view.roundWinner),
											})}
							</FeltText>
							<ScoreBoard table={table} view={view} onFelt />
							{view.revealed?.map((hand, seat) => (
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
									{hand.length === 0 ? (
										<FeltText variant="caption">{cards.table.noCards}</FeltText>
									) : (
										<ScrollView
											horizontal
											showsHorizontalScrollIndicator={false}
										>
											<Fan
												cards={sortCards(hand, sortBy)}
												width={REVEAL_CARD}
												step={REVEAL_STEP}
											/>
										</ScrollView>
									)}
								</View>
							))}
						</TablePanel>
					) : null}
					{finished && resultShown ? (
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
								{cards.rummy.lowestWins}
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
						<AppText variant="secondary">{roundLabel}</AppText>
						<ScoreBoard table={table} view={view} />
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
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: cardColors.goldSoft,
	},
	melds: { flex: 1, minHeight: 0 },
	meldsContent: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: spacing.sm,
		paddingHorizontal: spacing.md,
		paddingVertical: spacing.sm,
	},
	empty: { flex: 1, textAlign: "center", paddingVertical: spacing.lg },
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
	staged: {
		flexDirection: "row",
		flexWrap: "wrap",
		justifyContent: "center",
		gap: spacing.sm,
	},
	opening: { alignSelf: "stretch", gap: spacing.xxs },
	meter: {
		height: 5,
		borderRadius: radius.pill,
		backgroundColor: cardColors.chip,
		overflow: "hidden",
	},
	meterFill: { height: "100%", backgroundColor: cardColors.gold },
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
