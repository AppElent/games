/**
 * A Mexen game in play: whose turn, the two dice with keep or throw again,
 * every player's lives (or points) and kept throw, and the final standings.
 */
import type { MexenGame } from "@arcadeclub/core/dice/engine";
import type { MexenView } from "@arcadeclub/core/dice/mexen";
import {
	diceSeatName,
	latestNews,
	mexenStandings,
	mexenThrowLabel,
	mexenTurnStep,
} from "@arcadeclub/core/dice/table-view";
import { seatIsSilent } from "@arcadeclub/core/table-engine";
import { Stack, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
	AccessibilityInfo,
	Pressable,
	StyleSheet,
	useWindowDimensions,
	View,
} from "react-native";
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
import { Button, HeaderButton } from "../../../ui/button";
import { Card } from "../../../ui/card";
import { Notice } from "../../../ui/notice";
import { Screen } from "../../../ui/screen";
import { AppText } from "../../../ui/text";
import { Sheet } from "../../cards/deck/sheet";
import { DiceRulesSheet } from "../rules/dice-rules-sheet";
import { DiceEndPanel } from "./dice-end-panel";
import { DieFace } from "./die-face";
import type { DiceTableBundle, DiceTableControls } from "./use-dice-table";
import { useNow } from "./use-now";

type Props = {
	game: MexenGame;
	table: DiceTableBundle;
	view: MexenView;
	controls: DiceTableControls;
};

const MAX_DIE = 72;
const PIP = 8;
/** How often a silent seat is checked for. */
export function MexenTable({ game, table, view, controls }: Props) {
	const { t, locale } = useI18n();
	const dice = t.games.dice;
	const text = dice.games[game.id];
	const [rulesOpen, setRulesOpen] = useState(false);
	const router = useRouter();
	const you = table.you;
	const news = latestNews({ dice, fmt }, table, view.events);
	const newsSeq = news?.seq;
	const newsText = news?.text;

	useEffect(() => {
		// Keyed on `seq` too, so a second identical throw is still read out.
		if (newsSeq !== undefined && newsText) {
			AccessibilityInfo.announceForAccessibility(newsText);
		}
	}, [newsSeq, newsText]);

	const headerOptions = useMemo(
		() => ({
			title: text.name,
			headerRight: () => (
				<HeaderButton
					label={dice.table.rules}
					onPress={() => setRulesOpen(true)}
					testID="dice-table-rules"
				/>
			),
		}),
		[text.name, dice.table.rules],
	);
	const code = table.session.joinCode;
	const standingValue = (seat: number) =>
		view.scoring === "lives"
			? plural(locale, view.livesLeft[seat], dice.mexen.lives)
			: plural(locale, view.penalties[seat], dice.mexen.points);

	return (
		<>
			<Stack.Screen options={headerOptions} />
			<Screen>
				{view.phase === "finished" ? (
					<DiceEndPanel
						table={table}
						winners={view.winners}
						rows={mexenStandings(view).map((seat) => ({
							seat,
							value: standingValue(seat),
						}))}
						controls={controls}
					/>
				) : null}
				<MexenTray table={table} view={view} controls={controls} />
				{you === null ? (
					<View style={styles.spectator}>
						<AppText variant="secondary">{dice.table.spectating}</AppText>
						{code ? (
							<Button
								variant="plain"
								compact
								label={dice.table.rejoin}
								onPress={() =>
									router.replace({ pathname: "/join", params: { code } })
								}
								testID="dice-rejoin"
							/>
						) : null}
					</View>
				) : null}
				<Notice message={controls.error} />
				{news ? (
					<AppText variant="caption" testID="dice-last-score">
						{news.text}
					</AppText>
				) : null}
				<MexenSeats table={table} view={view} controls={controls} />
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

/** Whose turn, the two dice, and the choice between keeping and throwing again. */
function MexenTray({ table, view, controls }: Omit<Props, "game">) {
	const { t, locale } = useI18n();
	const dice = t.games.dice;
	const words = dice.mexen;
	const tokens = useTokens();
	const styles = useThemedStyles(createStyles);
	const { width } = useWindowDimensions();
	const you = table.you;
	const step = mexenTurnStep(view, you);
	const mine = step === "start" || step === "decide";
	const name = (seat: number) => diceSeatName(dice, table, seat);
	const wasMine = useRef(mine);
	useEffect(() => {
		// A nudge when it comes back round to you.
		if (mine && !wasMine.current) haptics.valueEntered();
		wasMine.current = mine;
	}, [mine]);

	const size = Math.min(
		MAX_DIE,
		Math.floor(
			(Math.min(width, metrics.contentMaxWidth) - metrics.screenGutter * 2) / 4,
		),
	);
	const current = view.current
		? mexenThrowLabel(dice, fmt, view.current)
		: null;
	const isLeader = view.turn === view.leader && !view.throwOff;
	const hint =
		step === "start"
			? view.throwOff
				? words.throwOffHint
				: isLeader
					? fmt(words.leaderHint, { cap: view.throwCap })
					: plural(locale, view.throwCap, words.startHint)
			: step === "decide"
				? words.decideHint
				: null;
	const limit = view.throwOff
		? null
		: view.limitSet
			? plural(locale, view.throwCap, words.limit)
			: view.leader === you
				? words.yourLimitPending
				: fmt(words.limitPending, { name: name(view.leader) });
	const autopilot = you !== null && table.seats[you]?.autopilot;
	// Between throws the table is empty; show the throw kept last, so one
	// kept as it landed (the last allowed) is still seen.
	const kept =
		view.dice.length === 0 && view.lastKept && view.phase === "playing"
			? view.lastKept
			: null;
	const shown = kept ? kept.dice : view.dice;
	const shownKind = kept ? kept.kind : view.current?.kind;
	const throwLine = current
		? current
		: kept
			? fmt(words.lastStand, {
					name: name(kept.seat),
					throw: mexenThrowLabel(dice, fmt, kept),
				})
			: null;

	return (
		<Card>
			<View style={styles.tray}>
				<AppText variant="label">
					{(view.throwOff
						? `${fmt(words.round, { round: view.round })} · ${words.throwOff}`
						: fmt(words.round, { round: view.round })
					).toUpperCase()}
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
							: fmt(words.theirTurn, { name: name(view.turn) })}
					</AppText>
				)}
				{hint ? <AppText variant="secondary">{hint}</AppText> : null}
				{shown.length === 0 ? (
					<View style={[styles.diceRow, { minHeight: size }]}>
						<AppText variant="secondary">{dice.table.noDice}</AppText>
					</View>
				) : (
					<View style={styles.diceRow}>
						{shown.map((value, index) => (
							<View
								// Two dice that never move: a die's place is its identity.
								// biome-ignore lint/suspicious/noArrayIndexKey: see above
								key={index}
								accessible
								accessibilityRole="image"
								accessibilityLabel={fmt(dice.table.die, {
									index: index + 1,
									value,
								})}
								testID={`dice-die-${index}`}
							>
								<DieFace value={value} size={size} />
							</View>
						))}
					</View>
				)}
				{throwLine ? (
					<AppText
						variant="title"
						style={
							shownKind === "mex" || shownKind === "littleMex"
								? { color: tokens.accent }
								: undefined
						}
						testID="mexen-throw"
					>
						{throwLine}
					</AppText>
				) : null}
				{view.rollsUsed > 0 ? (
					<AppText variant="caption">
						{fmt(words.throwCount, {
							used: view.rollsUsed,
							cap: view.throwCap,
						})}
					</AppText>
				) : null}
				{mine ? (
					<>
						<Button
							label={view.rollsUsed === 0 ? words.throw : words.throwAgain}
							disabled={view.rollsUsed >= view.throwCap}
							busy={controls.pending}
							onPress={() => {
								haptics.moveMade();
								controls.act({ type: "roll", keep: [] });
							}}
							testID="dice-roll"
							style={styles.wide}
						/>
						{step === "decide" && current ? (
							<Button
								variant="secondary"
								label={fmt(words.keep, { throw: current })}
								disabled={controls.pending}
								onPress={() => {
									haptics.selectionChanged();
									controls.act({ type: "stand" });
								}}
								testID="mexen-keep"
								style={styles.wide}
							/>
						) : null}
					</>
				) : null}
				{limit && view.phase === "playing" ? (
					<AppText variant="caption">{limit}</AppText>
				) : null}
				{view.scoring === "points" && view.phase === "playing" ? (
					<AppText variant="caption">
						{fmt(words.pointLimit, { limit: view.lives })}
					</AppText>
				) : null}
				{view.doubled && view.mexDoubles && view.phase === "playing" ? (
					<AppText variant="secondary" style={{ color: tokens.accent }}>
						{words.doubled}
					</AppText>
				) : null}
				{autopilot && you !== null ? (
					<>
						<AppText variant="secondary">{dice.table.autopilotActive}</AppText>
						<Button
							variant="secondary"
							label={dice.table.autopilotBack}
							onPress={() => controls.setAutopilot(you, false)}
							testID="dice-autopilot-back"
						/>
					</>
				) : null}
			</View>
		</Card>
	);
}

/** Every player round the table: lives (or points), and the throw they kept this round. */
function MexenSeats({ table, view, controls }: Omit<Props, "game">) {
	const { t, locale } = useI18n();
	const dice = t.games.dice;
	const words = dice.mexen;
	const tokens = useTokens();
	const styles = useThemedStyles(createStyles);
	const now = useNow();
	const [menuSeat, setMenuSeat] = useState<number | null>(null);
	const you = table.you;
	const name = (seat: number) => diceSeatName(dice, table, seat);

	const status = (seat: number) => {
		const result = view.results[seat];
		if (view.out[seat]) {
			return words.out;
		}
		if (view.phase === "finished") {
			return null;
		}
		if (seat === view.turn) {
			return words.throwing;
		}
		if (result) {
			return fmt(words.kept, { throw: mexenThrowLabel(dice, fmt, result) });
		}
		if (view.order.includes(seat)) {
			return view.throwOff ? words.inThrowOff : words.toThrow;
		}
		return null;
	};

	return (
		<Card>
			<AppText variant="label" accessibilityRole="header">
				{words.seatsLabel.toUpperCase()}
			</AppText>
			{table.seats.map((entry, seat) => {
				const human = entry.botIndex === null;
				const silent = seatIsSilent(entry, now);
				const canManage =
					you !== null &&
					seat !== you &&
					human &&
					!entry.autopilot &&
					(table.isHost || silent);
				const active = view.phase === "playing" && view.turn === seat;
				const score =
					view.scoring === "lives"
						? plural(locale, view.livesLeft[seat], words.lives)
						: plural(locale, view.penalties[seat], words.points);
				const leads =
					seat === view.leader && !view.throwOff && view.phase === "playing";
				const line = [
					leads ? words.leader : null,
					status(seat),
					silent ? dice.table.offline : null,
				]
					.filter(Boolean)
					.join(" · ");
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
							{line ? (
								<AppText variant="caption" numberOfLines={1}>
									{line}
								</AppText>
							) : null}
						</View>
						<View style={styles.score}>
							{view.scoring === "lives" ? (
								<View
									style={styles.pips}
									accessibilityElementsHidden
									importantForAccessibility="no-hide-descendants"
								>
									{Array.from({ length: view.lives }, (_, life) => (
										<View
											// biome-ignore lint/suspicious/noArrayIndexKey: pips are interchangeable
											key={life}
											style={[
												styles.pip,
												life < view.livesLeft[seat]
													? { backgroundColor: tokens.danger }
													: { borderColor: tokens.borderStrong },
											]}
										/>
									))}
								</View>
							) : null}
							<AppText variant="caption" tone="default">
								{score}
							</AppText>
						</View>
					</>
				);
				const rowStyle = [
					styles.seat,
					active && styles.active,
					view.out[seat] && styles.out,
				];
				const label = [name(seat), line, score].filter(Boolean).join(", ");
				return canManage ? (
					<Pressable
						// biome-ignore lint/suspicious/noArrayIndexKey: seats never move, so a seat's index is its identity
						key={seat}
						accessibilityRole="button"
						accessibilityLabel={`${label}. ${fmt(dice.table.seatMenu, {
							name: name(seat),
						})}`}
						onPress={() => setMenuSeat(seat)}
						testID={`dice-seat-${seat}`}
						style={rowStyle}
					>
						{content}
					</Pressable>
				) : (
					<View
						// biome-ignore lint/suspicious/noArrayIndexKey: seats never move, so a seat's index is its identity
						key={seat}
						accessible
						accessibilityLabel={label}
						accessibilityState={{ selected: active }}
						testID={`dice-seat-${seat}`}
						style={rowStyle}
					>
						{content}
					</View>
				);
			})}
			<Sheet
				open={menuSeat !== null}
				title={
					menuSeat === null
						? ""
						: fmt(dice.table.seatMenu, { name: name(menuSeat) })
				}
				onClose={() => setMenuSeat(null)}
			>
				{menuSeat === null ? null : (
					<Button
						label={fmt(dice.table.autopilotOn, { name: name(menuSeat) })}
						onPress={() => {
							controls.setAutopilot(menuSeat, true);
							setMenuSeat(null);
						}}
						testID="dice-autopilot-on"
					/>
				)}
			</Sheet>
		</Card>
	);
}

const styles = StyleSheet.create({
	spectator: { alignItems: "center", gap: spacing.xs },
});

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		tray: { alignItems: "center", gap: spacing.sm },
		diceRow: {
			flexDirection: "row",
			justifyContent: "center",
			alignItems: "center",
			gap: spacing.md,
		},
		wide: { alignSelf: "stretch" },
		seat: {
			flexDirection: "row",
			alignItems: "center",
			gap: spacing.md,
			minHeight: metrics.hitTarget + spacing.sm,
			paddingHorizontal: spacing.sm,
			borderRadius: radius.sm,
			borderBottomWidth: StyleSheet.hairlineWidth,
			borderBottomColor: colors.border,
		},
		active: { backgroundColor: colors.accentDim },
		out: { opacity: 0.55 },
		flex: { flex: 1, minWidth: 0 },
		score: { alignItems: "flex-end", gap: spacing.xxs },
		pips: {
			flexDirection: "row",
			flexWrap: "wrap",
			justifyContent: "flex-end",
			gap: 3,
			maxWidth: (PIP + 3) * 5,
		},
		pip: {
			width: PIP,
			height: PIP,
			borderRadius: PIP / 2,
			borderWidth: 1,
			borderColor: "transparent",
		},
	});
