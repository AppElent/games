/** A table for the trick-taking family: follow suit, and take the tricks you want. */
import { isRedSuit } from "@arcadeclub/core/cards/art";
import type { CardId } from "@arcadeclub/core/cards/deck";
import { type CardGame, familyRules } from "@arcadeclub/core/cards/engine";
import {
	bidTotal,
	cardName,
	cardTilt,
	openTrickSlots,
	seatName,
	sortCards,
	tricksChoices,
	tricksHint,
	tricksRoundLabel,
	tricksSeatNote,
	tricksWinsLine,
} from "@arcadeclub/core/cards/table-view";
import type { TricksAction, TricksView } from "@arcadeclub/core/cards/tricks";
import { useEffect, useMemo, useState } from "react";
import {
	type HostInstance,
	StyleSheet,
	useWindowDimensions,
	View,
} from "react-native";
import { haptics } from "../../../feedback/haptics";
import { fmt, plural, useI18n } from "../../../i18n";
import { cardColors, metrics, radius, spacing } from "../../../theme";
import { AppText } from "../../../ui/text";
import { PlayingCard, SuitIcon } from "../deck/playing-card";
import { Sheet } from "../deck/sheet";
import { useCardWords } from "../deck/use-card-words";
import { BidPicker } from "./bid-picker";
import { FeltText, Pill, PillRow, TableButton } from "./felt-ui";
import { type CardZones, useFlights } from "./flights";
import { Hand } from "./hand";
import { EndPanel, TablePanel } from "./result-panel";
import { ScoreBoard } from "./score-board";
import { SeatRow } from "./seat-row";
import { EventTicker, TableFrame } from "./table-frame";
import type { CardTableBundle, CardTableControls } from "./use-card-table";
import { useFreshCards } from "./use-fresh-cards";

const NO_MELD = () => null;
/** Keeps a line's height while it has nothing to say. */
const BLANK = " ";

/**
 * The cards on the table: the trick being played, or the last one with its
 * taker until the next card goes down. Played cards fly to it as "discard".
 */
function TrickArea({
	table,
	view,
	width,
	landing,
	zones,
}: {
	table: CardTableBundle;
	view: TricksView;
	width: number;
	landing: boolean;
	zones: CardZones;
}) {
	const { t } = useI18n();
	const cards = t.games.cards;
	const live = view.trick.length > 0 || !view.lastTrick;
	const plays = live ? view.trick : (view.lastTrick?.plays ?? []);
	const winner = live ? null : (view.lastTrick?.winner ?? null);
	const open = openTrickSlots(view);
	const height = width * 1.4;
	return (
		<View style={styles.trickWrap}>
			<View
				ref={zones.ref("discard", width)}
				collapsable={false}
				accessible
				accessibilityLabel={[
					cards.tricks.trickLabel,
					...plays.map(
						(play) =>
							`${seatName(cards, table, play.seat)}: ${cardName(cards, play.card)}`,
					),
				].join(". ")}
				style={styles.trick}
				testID="cards-trick"
			>
				{plays.map((play, index) => {
					const hidden = landing && index === plays.length - 1;
					const won = play.seat === winner;
					return (
						<View
							key={play.card}
							style={[styles.play, winner !== null && !won && styles.faded]}
						>
							<View
								style={[
									{ width, height },
									won && styles.winner,
									{ transform: [{ rotate: `${cardTilt(play.card) / 2}deg` }] },
								]}
							>
								{hidden ? null : <PlayingCard card={play.card} width={width} />}
							</View>
							<FeltText
								variant="caption"
								muted={!won}
								numberOfLines={1}
								style={[styles.caption, { maxWidth: width + spacing.md }]}
							>
								{seatName(cards, table, play.seat)}
							</FeltText>
						</View>
					);
				})}
				{live
					? Array.from({ length: open }, (_, index) => (
							<View
								// biome-ignore lint/suspicious/noArrayIndexKey: empty places have nothing else to tell them apart.
								key={index}
								style={styles.play}
							>
								<View
									style={[
										styles.slot,
										{ width, height, borderRadius: width * 0.075 },
									]}
								/>
								<FeltText variant="caption">{BLANK}</FeltText>
							</View>
						))
					: null}
			</View>
			<FeltText
				variant="secondary"
				numberOfLines={1}
				style={styles.taker}
				testID="cards-trick-taker"
			>
				{winner === null
					? BLANK
					: winner === table.you
						? cards.tricks.youTookTrick
						: fmt(cards.tricks.tookTrick, {
								name: seatName(cards, table, winner),
							})}
			</FeltText>
		</View>
	);
}

export function TricksTable({
	game,
	table,
	view,
	controls,
}: {
	game: CardGame;
	table: CardTableBundle;
	view: TricksView;
	controls: CardTableControls;
}) {
	const { t, locale } = useI18n();
	const cards = t.games.cards;
	const tt = cards.tricks;
	const words = useCardWords();
	const { width: screen } = useWindowDimensions();
	const [selected, setSelected] = useState<CardId[]>([]);
	const [scoresOpen, setScoresOpen] = useState(false);
	const [resultShown, setResultShown] = useState(false);
	const flights = useFlights(
		view.events,
		table.you,
		table.seats.length,
		NO_MELD,
	);

	const rules = familyRules(game, table.options, "tricks");
	if (!rules) {
		throw new Error("TricksTable needs a trick-taking game");
	}
	const name = cards.games[game.id].name;
	const you = table.you;
	const playing = view.phase === "playing";
	const bidding = view.phase === "bidding";
	// Someone has the turn: to bid, or to play a card.
	const live = playing || bidding;
	const mine = playing && view.turn === you;
	const myBid = bidding && view.turn === you;
	const choosing = view.phase === "passing" && you !== null && !view.passed;
	const legal = new Set(view.legal);
	const finished = view.phase === "finished";
	const firstTrick = view.tricksTaken.every((count) => count === 0);
	const choices = tricksChoices(view, you);
	const sittingOut = you !== null && (view.out[you] || view.folded[you]);

	useEffect(() => {
		if (!choosing) setSelected([]);
	}, [choosing]);

	// A rematch shows its own last round again when that game ends.
	useEffect(() => {
		if (!finished) setResultShown(false);
	}, [finished]);

	const arrived = useFreshCards(view.hand, mine, view.events);
	// Cards passed in stay marked until the first trick is played.
	const fresh = useMemo(
		() =>
			firstTrick && view.received.length > 0
				? new Set([...arrived, ...view.received])
				: arrived,
		[arrived, firstTrick, view.received],
	);

	const scoresAction = useMemo(
		() => [
			{
				label: tt.scoresButton,
				ios: "list.number" as const,
				android: "format_list_numbered" as const,
				onPress: () => setScoresOpen(true),
				testID: "cards-scores",
			},
		],
		[tt.scoresButton],
	);

	function tap(card: CardId, element: HostInstance) {
		if (choosing) {
			if (!selected.includes(card) && selected.length >= view.passCount) {
				return false;
			}
			haptics.selectionChanged();
			setSelected((current) =>
				current.includes(card)
					? current.filter((item) => item !== card)
					: [...current, card],
			);
			return true;
		}
		if (!mine || !legal.has(card) || controls.pending) return false;
		flights.noteOrigin(card, element);
		haptics.moveMade();
		controls.act({ type: "play", card });
		return true;
	}

	function pass() {
		haptics.moveMade();
		// The selection clears once the pass is in, and survives a refusal.
		controls.act({ type: "passCards", cards: selected });
	}

	const hint = tricksHint(view, you, words, rules);
	function choose(action: TricksAction) {
		haptics.moveMade();
		controls.act(action);
	}
	const roundLabel =
		view.deals === null
			? tricksRoundLabel(view, words)
			: `${fmt(tt.dealLabel, { round: view.round, deals: view.deals })} · ${plural(locale, view.handSize, tt.cardsEach)}`;
	const highWins = rules.highWins === true;
	const best = highWins ? Math.max(...view.totals) : Math.min(...view.totals);
	const standings = view.totals
		.map((total, seat) => ({ total, seat }))
		.sort((a, b) => (highWins ? b.total - a.total : a.total - b.total));
	const lastRound = view.scores.at(-1);
	const bids = bidTotal(view);
	const winsLine = tricksWinsLine(view, rules, words);
	const trump = view.trump;
	// In a bidding game each seat's line says what it bid and took.
	const roundName = (seat: number) => {
		const name = seatName(cards, table, seat);
		return view.bids
			? `${name} · ${fmt(tt.roundBid, { bid: view.bids[seat] ?? 0, taken: view.tricksTaken[seat] })}`
			: name;
	};
	const seats = table.seats.length;
	const trickWidth = Math.round(
		Math.min(
			84,
			Math.max(40, (screen - spacing.lg * 2) / seats - spacing.sm * 1.5),
		),
	);
	const breaking = rules.breaking;

	return (
		<TableFrame
			game={game}
			table={table}
			name={name}
			mine={mine || myBid}
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
					note={(seat) => tricksSeatNote(view, seat, words)}
				/>
			}
			center={
				<View style={styles.center}>
					<TrickArea
						table={table}
						view={view}
						width={trickWidth}
						landing={flights.landing}
						zones={flights.zones}
					/>
					<PillRow>
						<Pill>{roundLabel}</Pill>
						{view.stake !== null ? (
							<Pill>{fmt(tt.stakePill, { stake: view.stake })}</Pill>
						) : null}
						{rules.trumpChoice !== "none" && live ? (
							trump ? (
								<Pill
									icon={
										view.turnedUp ? (
											<View
												accessible
												accessibilityLabel={fmt(tt.turnedUpLabel, {
													card: cardName(cards, view.turnedUp),
												})}
											>
												<PlayingCard card={view.turnedUp} width={14} />
											</View>
										) : (
											<SuitIcon
												suit={trump}
												size={13}
												color={
													isRedSuit(trump)
														? cardColors.suitRed
														: cardColors.ivory
												}
											/>
										)
									}
								>
									{fmt(tt.trumpPill, { suit: cards.suits[trump] })}
								</Pill>
							) : (
								<Pill>{tt.noTrumpPill}</Pill>
							)
						) : null}
						{bids !== null && live ? (
							<Pill>{fmt(tt.bidsPill, { bids, tricks: view.handSize })}</Pill>
						) : null}
						{view.phase === "passing" ? (
							<Pill>
								{fmt(tt.passPill, {
									direction: tt.directions[view.passDirection],
								})}
							</Pill>
						) : null}
						{playing &&
						firstTrick &&
						rules.passing &&
						view.passDirection === "keep" ? (
							<Pill>{tt.keepPill}</Pill>
						) : null}
						{view.broken && breaking && playing ? (
							<Pill
								icon={
									<SuitIcon
										suit={breaking.suit}
										size={13}
										color={
											isRedSuit(breaking.suit)
												? cardColors.suitRed
												: cardColors.ivory
										}
									/>
								}
							>
								{fmt(tt.broken, { suit: cards.suits[breaking.suit] })}
							</Pill>
						) : null}
					</PillRow>
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
						{!live
							? " "
							: mine || myBid
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
						{myBid ? (
							<BidPicker
								key={`${view.round}-${view.blockedBid}`}
								view={view}
								pending={controls.pending}
								onBid={(count) => controls.act({ type: "bid", count })}
							/>
						) : null}
						{choosing ? (
							<TableButton
								label={tt.passButton}
								disabled={
									controls.pending || selected.length !== view.passCount
								}
								onPress={pass}
								testID="cards-pass-cards"
							/>
						) : null}
						{choices.answer ? (
							<>
								<TableButton
									label={tt.stayButton}
									disabled={controls.pending}
									onPress={() => choose({ type: "stay" })}
									testID="cards-stay"
								/>
								<TableButton
									label={tt.foldButton}
									ghost
									disabled={controls.pending}
									onPress={() => choose({ type: "fold" })}
									testID="cards-fold"
								/>
							</>
						) : null}
						{choices.knock ? (
							<TableButton
								label={tt.knockButton}
								disabled={controls.pending}
								onPress={() => choose({ type: "knock" })}
								testID="cards-knock"
							/>
						) : null}
						{choices.swap ? (
							<TableButton
								label={tt.swapButton}
								ghost
								disabled={controls.pending}
								onPress={() => choose({ type: "swapHand" })}
								testID="cards-swap-hand"
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
					cards={sortCards(view.hand, "suit")}
					handSize={view.hand.length}
					fresh={fresh}
					zones={flights.zones}
					stateOf={(card) => {
						if (choosing) {
							return { selected: selected.includes(card) };
						}
						const canPlay = mine && legal.has(card);
						return {
							playable: canPlay,
							dim: (mine && !canPlay) || sittingOut,
							disabled: !canPlay,
						};
					}}
					onTap={tap}
				/>
			}
			overlays={
				<>
					{view.phase === "roundOver" || (finished && !resultShown) ? (
						<TablePanel
							title={fmt(tt.roundOver, { round: view.round })}
							testID="cards-round-over"
							foot={
								!finished && you === null ? (
									<FeltText variant="secondary" muted style={styles.centered}>
										{tt.waitingNextRound}
									</FeltText>
								) : (
									<TableButton
										label={
											finished
												? tt.seeResult
												: fmt(tt.nextRound, { round: view.round + 1 })
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
							{view.moon !== null ? (
								<FeltText variant="body" style={styles.centered}>
									{view.moon === you
										? tt.youMoon
										: fmt(tt.moon, {
												name: seatName(cards, table, view.moon),
											})}
								</FeltText>
							) : null}
							{view.dealWinner !== null ? (
								<FeltText variant="body" style={styles.centered}>
									{view.dealWinner === you
										? tt.youDealWinner
										: fmt(tt.dealWinner, {
												name: seatName(cards, table, view.dealWinner),
											})}
								</FeltText>
							) : null}
							{lastRound ? (
								<View accessibilityLabel={tt.roundSummary}>
									{lastRound.map((points, seat) => (
										<View
											// biome-ignore lint/suspicious/noArrayIndexKey: seats are fixed during a game.
											key={seat}
											style={styles.standing}
										>
											<FeltText
												variant="body"
												numberOfLines={1}
												style={styles.who}
											>
												{roundName(seat)}
											</FeltText>
											<FeltText variant="body">
												{plural(locale, points, tt.totalPoints)}
												{view.out[seat] ? ` · ${tt.outNote}` : ""}
											</FeltText>
										</View>
									))}
								</View>
							) : null}
							<ScoreBoard
								table={table}
								scores={view.scores}
								totals={view.totals}
								empty={tt.noScores}
								totalLabel={tt.scoreTotal}
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
								view.winners.length > 1
									? tt.matchTie
									: you !== null && view.winners.includes(you)
										? tt.matchYouWin
										: fmt(tt.matchWinner, {
												name: seatName(cards, table, view.winners[0]),
											})
							}
						>
							<FeltText variant="caption" muted style={styles.centered}>
								{winsLine}
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
										{plural(locale, total, tt.totalPoints)}
									</FeltText>
								</View>
							))}
						</EndPanel>
					) : null}
					<Sheet
						open={scoresOpen}
						title={tt.scoresHeading}
						onClose={() => setScoresOpen(false)}
					>
						<AppText variant="secondary">{roundLabel}</AppText>
						<ScoreBoard
							table={table}
							scores={view.scores}
							totals={view.totals}
							empty={tt.noScores}
							totalLabel={tt.scoreTotal}
						/>
						<AppText variant="secondary">{winsLine}</AppText>
					</Sheet>
				</>
			}
		/>
	);
}

const styles = StyleSheet.create({
	center: { alignItems: "center", gap: spacing.md, alignSelf: "stretch" },
	trickWrap: { alignItems: "center", alignSelf: "stretch", gap: spacing.xs },
	trick: {
		flexDirection: "row",
		flexWrap: "wrap",
		justifyContent: "center",
		gap: spacing.sm,
		paddingHorizontal: spacing.lg,
	},
	play: { alignItems: "center", gap: spacing.xxs },
	faded: { opacity: 0.6 },
	winner: {
		shadowColor: cardColors.gold,
		shadowOpacity: 0.9,
		shadowRadius: 8,
		shadowOffset: { width: 0, height: 0 },
		elevation: 6,
	},
	caption: { textAlign: "center" },
	slot: {
		borderWidth: 2,
		borderStyle: "dashed",
		borderColor: cardColors.line,
	},
	taker: { textAlign: "center", minHeight: 20 },
	status: {
		alignSelf: "stretch",
		alignItems: "center",
		justifyContent: "flex-end",
		gap: spacing.xxs,
	},
	mine: { color: cardColors.gold },
	hint: { textAlign: "center", minHeight: 20 },
	centered: { textAlign: "center" },
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
