/**
 * A push-your-luck game in play (10.000): the dice just rolled (tap to set
 * aside), what is already set aside, the turn total, roll or bank, and
 * everyone's score against the target.
 */
import type { PushluckGame } from "@arcadeclub/core/dice/engine";
import type { PushluckView } from "@arcadeclub/core/dice/pushluck";
import {
	diceSeatName,
	lastBust,
	latestNews,
	pushluckPick,
	pushluckStep,
	standings,
} from "@arcadeclub/core/dice/table-view";
import { useCallback, useEffect, useRef, useState } from "react";
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
import { Notice } from "../../../ui/notice";
import { Screen } from "../../../ui/screen";
import { AppText } from "../../../ui/text";
import { DiceRulesSheet } from "../rules/dice-rules-sheet";
import { DiceEndPanel } from "./dice-end-panel";
import { DieFace } from "./die-face";
import {
	AutopilotNote,
	DiceTableHeader,
	SeatMenu,
	SpectatorNote,
	seatManagement,
	useAnnounce,
} from "./table-parts";
import type { DiceTableBundle, DiceTableControls } from "./use-dice-table";
import { useNow } from "./use-now";

type Props = {
	table: DiceTableBundle;
	view: PushluckView;
	controls: DiceTableControls;
};

const MAX_DIE = 56;
const DIE_GAP = spacing.xs;
const ASIDE_DIE = 28;

export function PushluckTable({
	game,
	table,
	view,
	controls,
}: Props & { game: PushluckGame }) {
	const { t, locale } = useI18n();
	const dice = t.games.dice;
	const words = dice.pushluck.table;
	const text = dice.games[game.id];
	const tokens = useTokens();
	const styles = useThemedStyles(createStyles);
	const [rulesOpen, setRulesOpen] = useState(false);
	const openRules = useCallback(() => setRulesOpen(true), []);
	const news = latestNews({ dice, fmt, locale }, table, view.events);
	useAnnounce(news);

	return (
		<>
			<DiceTableHeader name={text.name} onRules={openRules} />
			<Screen>
				{view.phase === "finished" ? (
					<DiceEndPanel
						table={table}
						winners={view.winners}
						rows={standings(view).map(({ seat, total }) => ({
							seat,
							value: total.toLocaleString(locale),
						}))}
						controls={controls}
					/>
				) : null}
				{view.finalRoundBy !== null && view.phase === "playing" ? (
					<View
						style={[styles.final, { borderColor: tokens.accent }]}
						accessibilityRole="alert"
					>
						<AppText variant="body" style={{ color: tokens.accent }}>
							{fmt(words.finalRound, {
								name: diceSeatName(dice, table, view.finalRoundBy),
							})}
						</AppText>
					</View>
				) : null}
				<PushTray table={table} view={view} controls={controls} />
				<SpectatorNote table={table} />
				<Notice message={controls.error} />
				{news ? (
					<AppText variant="caption" testID="dice-last-score">
						{news.text}
					</AppText>
				) : null}
				<Scoreboard table={table} view={view} controls={controls} />
			</Screen>
			<DiceRulesSheet
				game={game}
				options={table.options}
				open={rulesOpen}
				onClose={() => setRulesOpen(false)}
			/>
		</>
	);
}

/**
 * Whose turn, the dice just rolled, what is set aside, and the roll and bank
 * buttons. Picks stay on this phone until the player rolls or banks.
 */
function PushTray({ table, view, controls }: Props) {
	const { t, locale } = useI18n();
	const dice = t.games.dice;
	const words = dice.pushluck.table;
	const tokens = useTokens();
	const styles = useThemedStyles(createStyles);
	const { width } = useWindowDimensions();
	const num = (value: number) => value.toLocaleString(locale);
	const step = pushluckStep(view, table.you);
	const rollKey = String(view.events.at(-1)?.seq ?? -1);
	const [picked, setPicked] = useState<boolean[]>([]);
	const [pickedFor, setPickedFor] = useState(rollKey);
	// Every roll starts with nothing picked.
	if (pickedFor !== rollKey) {
		setPickedFor(rollKey);
		setPicked([]);
	}
	const pick = pushluckPick(view, picked);
	const mine = step === "start" || step === "pick";
	const bust = lastBust(view);

	const wasMine = useRef(mine);
	useEffect(() => {
		// A nudge when it comes back round to you.
		if (mine && !wasMine.current) haptics.valueEntered();
		wasMine.current = mine;
	}, [mine]);

	const count = view.rules.dice;
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
	const problem =
		step === "pick" && pick.problem
			? pick.problem === "needOpening"
				? fmt(words.needOpening, { needed: num(view.rules.openingScore) })
				: words[pick.problem]
			: null;

	return (
		<Card>
			<View style={styles.tray}>
				<AppText variant="label">
					{`${fmt(words.round, { round: view.round })} · ${fmt(words.target, {
						target: num(view.rules.target),
					})}`.toUpperCase()}
				</AppText>
				{view.phase === "finished" ? null : (
					<AppText
						variant="heading"
						accessibilityLiveRegion="polite"
						style={mine ? { color: tokens.accent } : undefined}
						testID="dice-turn"
					>
						{mine
							? dice.table.yourTurn
							: fmt(dice.table.theirTurn, {
									name: diceSeatName(dice, table, view.turn),
								})}
					</AppText>
				)}
				{step === "start" ? (
					<AppText variant="secondary">
						{fmt(words.startHint, { count })}
					</AppText>
				) : step === "pick" ? (
					<AppText variant="secondary">{words.pickHint}</AppText>
				) : null}
				<View style={styles.total} accessible>
					<AppText variant="label">{words.turnTotal.toUpperCase()}</AppText>
					<AppText variant="title" testID="dice-turn-total">
						{num(view.turnTotal)}
					</AppText>
					{step === "pick" && pick.points !== null ? (
						<AppText variant="body" style={{ color: tokens.accent }}>
							{fmt(words.selected, { points: num(pick.points) })}
						</AppText>
					) : null}
				</View>
				{view.dice.length > 0 ? (
					<View
						style={styles.diceRow}
						accessibilityLabel={dice.table.diceLabel}
					>
						{view.dice.map((value, index) => {
							const label = fmt(dice.table.die, { index: index + 1, value });
							const on = picked[index] ?? false;
							return step === "pick" ? (
								<Pressable
									// A roll keeps its order, so a die's place is its identity.
									// biome-ignore lint/suspicious/noArrayIndexKey: see above
									key={index}
									accessibilityRole="togglebutton"
									accessibilityLabel={label}
									accessibilityState={{
										checked: on,
										disabled: controls.pending,
									}}
									disabled={controls.pending}
									onPress={() => {
										haptics.selectionChanged();
										setPicked((current) => {
											const next = view.dice.map(
												(_, at) => current[at] ?? false,
											);
											next[index] = !next[index];
											return next;
										});
									}}
									testID={`dice-die-${index}`}
									style={[styles.die, on && styles.diePicked]}
								>
									<DieFace
										value={value}
										size={size}
										held={on}
										ring={tokens.accent}
									/>
									<AppText variant="caption" style={styles.pickTag}>
										{on ? words.pickTag : " "}
									</AppText>
								</Pressable>
							) : (
								<View
									// biome-ignore lint/suspicious/noArrayIndexKey: see above
									key={index}
									accessible
									accessibilityRole="image"
									accessibilityLabel={label}
									style={styles.die}
								>
									<DieFace value={value} size={size} />
									<AppText variant="caption" style={styles.pickTag}>
										{" "}
									</AppText>
								</View>
							);
						})}
					</View>
				) : bust ? (
					<View
						style={styles.bust}
						accessible
						accessibilityLabel={`${words.bust} ${bust.dice.join(", ")}`}
					>
						<View style={styles.diceRow}>
							{bust.dice.map((value, index) => (
								// A bust roll never changes, so its order is its identity.
								// biome-ignore lint/suspicious/noArrayIndexKey: see above
								<View key={index} style={styles.bustDie}>
									<DieFace value={value} size={size} />
								</View>
							))}
						</View>
						<AppText variant="heading" style={{ color: tokens.danger }}>
							{words.bust}
						</AppText>
						<AppText variant="secondary">
							{latestNews({ dice, fmt, locale }, table, view.events)?.text}
						</AppText>
					</View>
				) : (
					<View style={[styles.diceRow, { minHeight: size }]}>
						<AppText variant="secondary">{dice.table.noDice}</AppText>
					</View>
				)}
				<View style={styles.aside}>
					<AppText variant="label">{words.setAsideLabel.toUpperCase()}</AppText>
					{view.setAside.length > 0 ? (
						<View
							style={styles.asideDice}
							accessible
							accessibilityLabel={`${words.setAsideLabel}: ${view.setAside.join(", ")}`}
						>
							{view.setAside.map((value, index) => (
								// Set-aside dice only grow during a turn, so their order is their identity.
								// biome-ignore lint/suspicious/noArrayIndexKey: see above
								<DieFace key={index} value={value} size={ASIDE_DIE} />
							))}
						</View>
					) : (
						<AppText variant="caption">{words.nothingSetAside}</AppText>
					)}
				</View>
				{step === "start" ? (
					<Button
						label={words.roll}
						busy={controls.pending}
						onPress={() => {
							haptics.moveMade();
							controls.act({ type: "roll", keep: [] });
						}}
						testID="dice-roll"
						style={styles.stretch}
					/>
				) : step === "pick" ? (
					<>
						<View style={styles.buttons}>
							<Button
								label={
									pick.hotDice
										? fmt(words.hotDice, { count: pick.rollCount })
										: plural(locale, pick.rollCount, words.rollRest)
								}
								disabled={!pick.canRoll}
								busy={controls.pending}
								onPress={() => {
									haptics.moveMade();
									controls.act({ type: "roll", keep: pick.keep });
								}}
								testID="dice-roll"
								style={styles.flex}
							/>
							<Button
								variant="secondary"
								label={fmt(words.bank, { points: num(pick.total) })}
								disabled={!pick.canBank}
								busy={controls.pending}
								onPress={() => {
									haptics.moveMade();
									controls.act({ type: "bank", keep: pick.keep });
								}}
								testID="dice-bank"
								style={styles.flex}
							/>
						</View>
						<AppText
							variant="caption"
							accessibilityLiveRegion="polite"
							style={styles.problem}
						>
							{problem ?? " "}
						</AppText>
					</>
				) : null}
				<AutopilotNote table={table} controls={controls} />
			</View>
		</Card>
	);
}

/** Everyone's banked score against the target; the player rolling now shows the turn at stake. */
function Scoreboard({ table, view, controls }: Props) {
	const { t, locale } = useI18n();
	const dice = t.games.dice;
	const words = dice.pushluck.table;
	const tokens = useTokens();
	const styles = useThemedStyles(createStyles);
	const now = useNow();
	const [menuSeat, setMenuSeat] = useState<number | null>(null);
	const num = (value: number) => value.toLocaleString(locale);
	const target = view.rules.target;

	return (
		<Card>
			<AppText variant="label" accessibilityRole="header">
				{words.scoreboard.toUpperCase()}
			</AppText>
			{view.scores.map((score, seat) => {
				const name = diceSeatName(dice, table, seat);
				const { silent, canManage } = seatManagement(table, seat, now);
				const active = view.phase === "playing" && view.turn === seat;
				const note = [
					active && view.turnTotal > 0
						? fmt(words.selected, { points: num(view.turnTotal) })
						: score === 0 && view.rules.openingScore > 0
							? words.notOnBoard
							: null,
					silent ? dice.table.offline : null,
				]
					.filter(Boolean)
					.join(" · ");
				const content = (
					<>
						<View style={styles.seatLine}>
							<AppText
								variant="body"
								numberOfLines={1}
								style={[styles.flex, active && { color: tokens.accent }]}
							>
								{name}
							</AppText>
							<AppText variant="heading">{num(score)}</AppText>
						</View>
						<View style={styles.bar}>
							<View
								style={[
									styles.barFill,
									{ width: `${Math.min(100, (score / target) * 100)}%` },
								]}
							/>
						</View>
						{note ? <AppText variant="caption">{note}</AppText> : null}
					</>
				);
				const label = fmt(words.scoreLabel, {
					name,
					score: num(score),
					target: num(target),
				});
				return canManage ? (
					<Pressable
						// Seats never move during a game.
						// biome-ignore lint/suspicious/noArrayIndexKey: see above
						key={seat}
						accessibilityRole="button"
						accessibilityLabel={`${label}. ${fmt(dice.table.seatMenu, { name })}`}
						onPress={() => setMenuSeat(seat)}
						testID={`dice-seat-${seat}`}
						style={[styles.seat, active && styles.active]}
					>
						{content}
					</Pressable>
				) : (
					<View
						// biome-ignore lint/suspicious/noArrayIndexKey: see above
						key={seat}
						accessible
						accessibilityLabel={note ? `${label}. ${note}` : label}
						style={[styles.seat, active && styles.active]}
					>
						{content}
					</View>
				);
			})}
			<SeatMenu
				table={table}
				seat={menuSeat}
				controls={controls}
				onClose={() => setMenuSeat(null)}
			/>
		</Card>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		final: {
			padding: spacing.md,
			borderWidth: 1,
			borderRadius: radius.md,
			backgroundColor: colors.accentDim,
		},
		tray: { alignItems: "center", gap: spacing.sm },
		total: { alignItems: "center", gap: spacing.xxs },
		diceRow: {
			flexDirection: "row",
			justifyContent: "center",
			alignItems: "center",
			gap: DIE_GAP,
		},
		die: {
			alignItems: "center",
			gap: spacing.xxs,
			minWidth: metrics.hitTarget,
			minHeight: metrics.hitTarget,
		},
		diePicked: { transform: [{ translateY: -4 }] },
		pickTag: { color: colors.accent, fontWeight: "700" },
		bust: { alignItems: "center", gap: spacing.xs },
		bustDie: { opacity: 0.45 },
		aside: {
			alignSelf: "stretch",
			alignItems: "center",
			gap: spacing.xs,
			paddingTop: spacing.sm,
			borderTopWidth: StyleSheet.hairlineWidth,
			borderTopColor: colors.border,
		},
		asideDice: {
			flexDirection: "row",
			flexWrap: "wrap",
			justifyContent: "center",
			gap: spacing.xs,
		},
		buttons: {
			flexDirection: "row",
			alignSelf: "stretch",
			gap: spacing.sm,
		},
		stretch: { alignSelf: "stretch" },
		flex: { flex: 1 },
		problem: { textAlign: "center" },
		seat: {
			gap: spacing.xxs,
			minHeight: metrics.hitTarget,
			paddingVertical: spacing.sm,
			paddingHorizontal: spacing.md,
			borderRadius: radius.md,
			backgroundColor: colors.surface2,
		},
		active: { backgroundColor: colors.accentDim },
		seatLine: {
			flexDirection: "row",
			alignItems: "center",
			gap: spacing.md,
		},
		bar: {
			height: 6,
			borderRadius: 3,
			overflow: "hidden",
			backgroundColor: colors.border,
		},
		barFill: { height: "100%", backgroundColor: colors.accent },
	});
