/**
 * A score-sheet game in play: whose turn, the dice (tap to hold), the sheet
 * with what your open boxes would score, and the final standings.
 */
import { diceRules, type ScoresheetGame } from "@arcadeclub/core/dice/engine";
import type { ScoresheetView } from "@arcadeclub/core/dice/scoresheet";
import {
	diceSeatName,
	latestNews,
	standings,
	turnStep,
} from "@arcadeclub/core/dice/table-view";
import { seatIsSilent } from "@arcadeclub/core/table-engine";
import { Stack, useRouter } from "expo-router";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
	AccessibilityInfo,
	Pressable,
	ScrollView,
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

type Props = {
	game: ScoresheetGame;
	table: DiceTableBundle;
	view: ScoresheetView;
	controls: DiceTableControls;
};

const MAX_DIE = 64;
const DIE_GAP = spacing.sm;
const NAME_COLUMN = 124;
const SEAT_COLUMN = 64;
/** How often a silent seat is checked for. */
const PRESENCE_TICK_MS = 15_000;

function useNow() {
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		const timer = setInterval(() => setNow(Date.now()), PRESENCE_TICK_MS);
		return () => clearInterval(timer);
	}, []);
	return now;
}

export function ScoresheetTable({ game, table, view, controls }: Props) {
	const { t } = useI18n();
	const dice = t.games.dice;
	const text = dice.games[game.id];
	const [rulesOpen, setRulesOpen] = useState(false);
	const router = useRouter();
	const you = table.you;
	const news = latestNews({ dice, fmt }, table, view.events);
	const newsSeq = news?.seq;
	const newsText = news?.text;

	useEffect(() => {
		// Keyed on `seq` too, so a second identical roll is still read out.
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

	return (
		<>
			<Stack.Screen options={headerOptions} />
			<Screen>
				{view.phase === "finished" ? (
					<DiceEndPanel
						table={table}
						winners={view.winners}
						rows={standings(view).map(({ seat, total }) => ({
							seat,
							value: String(total),
						}))}
						controls={controls}
					/>
				) : null}
				<DiceTray table={table} view={view} controls={controls} />
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
				<ScoreSheet game={game} table={table} view={view} controls={controls} />
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

/** Whose turn, the dice, and the roll button. Holds stay on this phone until the roll. */
function DiceTray({ table, view, controls }: Omit<Props, "game">) {
	const { t, locale } = useI18n();
	const dice = t.games.dice;
	const tokens = useTokens();
	const styles = useThemedStyles(createStyles);
	const { width } = useWindowDimensions();
	const you = table.you;
	const step = turnStep(view, you);
	const rollKey = `${view.round}:${view.turn}:${view.rollsUsed}`;
	const [held, setHeld] = useState(view.held);
	const [heldFor, setHeldFor] = useState(rollKey);
	// A new roll or a new turn starts from what the server says is held.
	if (heldFor !== rollKey) {
		setHeldFor(rollKey);
		setHeld(view.held);
	}

	const mine = step === "start" || step === "hold" || step === "score";
	const wasMine = useRef(mine);
	useEffect(() => {
		// A nudge when it comes back round to you.
		if (mine && !wasMine.current) haptics.valueEntered();
		wasMine.current = mine;
	}, [mine]);

	const size = Math.min(
		MAX_DIE,
		Math.floor(
			(Math.min(width, metrics.contentMaxWidth) -
				metrics.screenGutter * 2 -
				spacing.lg * 2 -
				DIE_GAP * (view.diceCount - 1)) /
				view.diceCount,
		),
	);
	const rollsLeft = view.rollsPerTurn - view.rollsUsed;
	const canRoll =
		(step === "start" || step === "hold") &&
		!(step === "hold" && held.every(Boolean));
	const hint =
		step === "start"
			? dice.table.startHint
			: step === "hold"
				? dice.table.holdHint
				: step === "score"
					? dice.table.scoreHint
					: null;
	const autopilot = you !== null && table.seats[you]?.autopilot;

	return (
		<Card>
			<View style={styles.tray}>
				<AppText variant="label">
					{fmt(dice.table.round, {
						round: Math.min(view.round, view.rounds),
						rounds: view.rounds,
					}).toUpperCase()}
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
				{hint ? <AppText variant="secondary">{hint}</AppText> : null}
				{view.rollsUsed === 0 ? (
					<View style={[styles.diceRow, { minHeight: size }]}>
						<AppText variant="secondary">{dice.table.noDice}</AppText>
					</View>
				) : (
					<View
						style={styles.diceRow}
						accessibilityLabel={dice.table.diceLabel}
					>
						{view.dice.map((value, index) => {
							const label = fmt(dice.table.die, { index: index + 1, value });
							const isHeld =
								step === "hold" ? (held[index] ?? false) : view.held[index];
							return step === "hold" ? (
								<Pressable
									// The cup keeps its order, so a die's place is its identity.
									// biome-ignore lint/suspicious/noArrayIndexKey: see above
									key={index}
									accessibilityRole="togglebutton"
									accessibilityLabel={label}
									accessibilityState={{
										checked: isHeld,
										disabled: controls.pending,
									}}
									disabled={controls.pending}
									onPress={() => {
										haptics.selectionChanged();
										setHeld((current) =>
											current.map((on, at) => (at === index ? !on : on)),
										);
									}}
									testID={`dice-die-${index}`}
									style={[styles.die, isHeld && styles.dieHeld]}
								>
									<DieFace
										value={value}
										size={size}
										held={isHeld}
										ring={tokens.accent}
									/>
									<AppText variant="caption" style={styles.heldTag}>
										{isHeld ? dice.table.heldLabel : " "}
									</AppText>
								</Pressable>
							) : (
								<View
									// biome-ignore lint/suspicious/noArrayIndexKey: see above
									key={index}
									accessible
									accessibilityRole="image"
									accessibilityLabel={
										isHeld ? `${label}, ${dice.table.held}` : label
									}
									style={[styles.die, isHeld && styles.dieHeld]}
								>
									<DieFace
										value={value}
										size={size}
										held={isHeld}
										ring={tokens.accent}
									/>
									<AppText variant="caption" style={styles.heldTag}>
										{" "}
									</AppText>
								</View>
							);
						})}
					</View>
				)}
				{mine ? (
					<>
						<Button
							label={
								view.rollsUsed === 0 ? dice.table.roll : dice.table.rollAgain
							}
							disabled={!canRoll}
							busy={controls.pending}
							onPress={() => {
								haptics.moveMade();
								controls.act({
									type: "roll",
									keep:
										step === "hold"
											? held.flatMap((on, index) => (on ? [index] : []))
											: [],
								});
							}}
							testID="dice-roll"
							style={styles.roll}
						/>
						<AppText variant="caption">
							{rollsLeft > 0
								? plural(locale, rollsLeft, dice.table.rollsLeft)
								: dice.table.noRollsLeft}
						</AppText>
					</>
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

/** Every player's sheet side by side; your open boxes offer what the dice would score. */
function ScoreSheet({ game, table, view, controls }: Props) {
	const { t } = useI18n();
	const dice = t.games.dice;
	const tokens = useTokens();
	const styles = useThemedStyles(createStyles);
	const now = useNow();
	const [menuSeat, setMenuSeat] = useState<number | null>(null);
	const rules = diceRules(game, table.options);
	const you = table.you;
	const step = turnStep(view, you);
	const choosing = step === "hold" || step === "score";
	const seats = view.sheets.map((_, seat) => seat);
	const name = (seat: number) => diceSeatName(dice, table, seat);
	const upper = view.sheet.filter((entry) => entry.section === "upper");
	const lower = view.sheet.filter((entry) => entry.section === "lower");

	const cell = (seat: number, content: ReactNode, key?: string) => (
		<View
			key={key ?? seat}
			style={[styles.cell, view.turn === seat && styles.active]}
		>
			{content}
		</View>
	);

	const row = (entry: (typeof view.sheet)[number]) => {
		const category = dice.categories[entry.id];
		return (
			<View key={entry.id} style={styles.row}>
				<AppText variant="secondary" tone="default" style={styles.nameCell}>
					{category}
				</AppText>
				{seats.map((seat) => {
					const points = view.sheets[seat].scores[entry.id];
					const option =
						choosing && seat === you
							? view.options.find((choice) => choice.category === entry.id)
							: undefined;
					return cell(
						seat,
						points !== undefined ? (
							<AppText
								variant="body"
								accessibilityLabel={fmt(dice.table.cellLabel, {
									category,
									name: name(seat),
									points,
								})}
							>
								{String(points)}
							</AppText>
						) : option ? (
							<Pressable
								accessibilityRole="button"
								accessibilityLabel={fmt(dice.table.scoreFor, {
									points: option.points,
									category,
								})}
								accessibilityState={{ disabled: controls.pending }}
								disabled={controls.pending}
								onPress={() =>
									controls.act({ type: "score", category: entry.id })
								}
								testID={`dice-score-${entry.id}`}
								style={[
									styles.option,
									{
										borderColor:
											option.points > 0 ? tokens.accent : tokens.borderStrong,
									},
								]}
							>
								<AppText
									variant="body"
									style={{
										color: option.points > 0 ? tokens.accent : tokens.textMuted,
									}}
								>
									{String(option.points)}
								</AppText>
							</Pressable>
						) : (
							<AppText
								variant="caption"
								accessibilityLabel={fmt(dice.table.cellLabel, {
									category,
									name: name(seat),
									points: dice.table.empty,
								})}
							>
								·
							</AppText>
						),
					);
				})}
			</View>
		);
	};

	const totals = (
		label: string,
		value: (seat: number) => string,
		strong = false,
	) => (
		<View style={[styles.row, styles.totalRow]}>
			<AppText
				variant={strong ? "body" : "caption"}
				tone={strong ? "default" : "muted"}
				style={styles.nameCell}
			>
				{label}
			</AppText>
			{seats.map((seat) =>
				cell(
					seat,
					<AppText
						variant={strong ? "heading" : "caption"}
						tone={strong ? "default" : "muted"}
					>
						{value(seat)}
					</AppText>,
				),
			)}
		</View>
	);

	return (
		<Card>
			<AppText variant="label" accessibilityRole="header">
				{dice.table.sheetLabel.toUpperCase()}
			</AppText>
			<ScrollView horizontal showsHorizontalScrollIndicator={false}>
				<View>
					<View style={styles.row}>
						<AppText variant="caption" style={styles.nameCell}>
							{dice.table.category}
						</AppText>
						{seats.map((seat) => {
							const entry = table.seats[seat];
							const human = entry.botIndex === null;
							const silent = seatIsSilent(entry, now);
							const canManage =
								you !== null &&
								seat !== you &&
								human &&
								!entry.autopilot &&
								(table.isHost || silent);
							const label = (
								<>
									<AppText
										variant="caption"
										tone="default"
										numberOfLines={1}
										style={view.turn === seat ? { color: tokens.accent } : null}
									>
										{name(seat)}
									</AppText>
									{silent ? (
										<AppText variant="caption" numberOfLines={1}>
											{dice.table.offline}
										</AppText>
									) : null}
								</>
							);
							return canManage ? (
								<Pressable
									key={seat}
									accessibilityRole="button"
									accessibilityLabel={fmt(dice.table.seatMenu, {
										name: name(seat),
									})}
									onPress={() => setMenuSeat(seat)}
									testID={`dice-seat-${seat}`}
									style={[styles.cell, view.turn === seat && styles.active]}
								>
									{label}
								</Pressable>
							) : (
								cell(seat, label)
							);
						})}
					</View>
					{upper.map(row)}
					{totals(dice.table.upperSum, (seat) =>
						fmt(dice.table.bonusProgress, {
							have: view.sheets[seat].upper,
							needed: view.upperBonus.threshold,
						}),
					)}
					{totals(dice.table.bonus, (seat) =>
						String(view.sheets[seat].upperBonus),
					)}
					{lower.map(row)}
					{rules.extraAllSame
						? totals(dice.table.extra, (seat) =>
								String(view.sheets[seat].extra),
							)
						: null}
					{totals(
						dice.table.total,
						(seat) => String(view.sheets[seat].total),
						true,
					)}
				</View>
			</ScrollView>
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
			gap: DIE_GAP,
		},
		die: {
			alignItems: "center",
			gap: spacing.xxs,
			minWidth: metrics.hitTarget,
			minHeight: metrics.hitTarget,
		},
		dieHeld: { transform: [{ translateY: -4 }] },
		heldTag: { color: colors.accent, fontWeight: "700" },
		roll: { alignSelf: "stretch" },
		row: {
			flexDirection: "row",
			alignItems: "center",
			minHeight: metrics.hitTarget,
			borderBottomWidth: StyleSheet.hairlineWidth,
			borderBottomColor: colors.border,
		},
		totalRow: { backgroundColor: colors.surface2 },
		nameCell: { width: NAME_COLUMN, paddingRight: spacing.sm },
		cell: {
			width: SEAT_COLUMN,
			minHeight: metrics.hitTarget,
			alignItems: "center",
			justifyContent: "center",
		},
		active: { backgroundColor: colors.accentDim },
		option: {
			minWidth: metrics.hitTarget,
			minHeight: metrics.hitTarget - spacing.xs,
			alignItems: "center",
			justifyContent: "center",
			borderWidth: 1,
			borderStyle: "dashed",
			borderRadius: radius.sm,
		},
	});
