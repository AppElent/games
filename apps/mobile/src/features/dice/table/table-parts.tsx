/**
 * What every dice table shows whatever its family: the header, the
 * spectator's way back in, news read out to screen readers, the seat menu,
 * the autopilot note and the end of the game.
 */
import type { DiceView } from "@arcadeclub/core/dice/engine";
import { diceSeatName, standings } from "@arcadeclub/core/dice/table-view";
import { seatIsSilent } from "@arcadeclub/core/table-engine";
import { Stack, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { AccessibilityInfo, StyleSheet, View } from "react-native";
import { haptics } from "../../../feedback/haptics";
import { fmt, useI18n } from "../../../i18n";
import { metrics, spacing } from "../../../theme";
import { Button, HeaderButton } from "../../../ui/button";
import { Card } from "../../../ui/card";
import { AppText } from "../../../ui/text";
import { Sheet } from "../../cards/deck/sheet";
import type { DiceTableBundle, DiceTableControls } from "./use-dice-table";

/** How often a silent seat is checked for. */
const PRESENCE_TICK_MS = 15_000;

export function useNow() {
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		const timer = setInterval(() => setNow(Date.now()), PRESENCE_TICK_MS);
		return () => clearInterval(timer);
	}, []);
	return now;
}

/** Reads the latest news out once; keyed on `seq` too, so a second identical roll is still read. */
export function useAnnounce(news: { seq: number; text: string } | null) {
	const seq = news?.seq;
	const text = news?.text;
	useEffect(() => {
		if (seq !== undefined && text) {
			AccessibilityInfo.announceForAccessibility(text);
		}
	}, [seq, text]);
}

/** The screen title with the rules button beside it. */
export function DiceTableHeader({
	name,
	onRules,
}: {
	name: string;
	onRules: () => void;
}) {
	const dice = useI18n().t.games.dice;
	const options = useMemo(
		() => ({
			title: name,
			headerRight: () => (
				<HeaderButton
					label={dice.table.rules}
					onPress={onRules}
					testID="dice-table-rules"
				/>
			),
		}),
		[name, dice.table.rules, onRules],
	);
	return <Stack.Screen options={options} />;
}

/** Tells a viewer without a seat they are watching, with the way back in. */
export function SpectatorNote({ table }: { table: DiceTableBundle }) {
	const router = useRouter();
	const dice = useI18n().t.games.dice;
	const code = table.session.joinCode;
	if (table.you !== null) {
		return null;
	}
	return (
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
	);
}

/** Who may hand a seat to the computer: the host, or anyone once it goes quiet. */
export function seatManagement(
	table: DiceTableBundle,
	seat: number,
	now: number,
) {
	const entry = table.seats[seat];
	const human = entry.botIndex === null;
	const silent = seatIsSilent(entry, now);
	return {
		human,
		silent,
		canManage:
			table.you !== null &&
			seat !== table.you &&
			human &&
			!entry.autopilot &&
			(table.isHost || silent),
	};
}

/** The sheet that hands someone's seat to the computer. */
export function SeatMenu({
	table,
	seat,
	controls,
	onClose,
}: {
	table: DiceTableBundle;
	seat: number | null;
	controls: DiceTableControls;
	onClose: () => void;
}) {
	const dice = useI18n().t.games.dice;
	const name = seat === null ? "" : diceSeatName(dice, table, seat);
	return (
		<Sheet
			open={seat !== null}
			title={seat === null ? "" : fmt(dice.table.seatMenu, { name })}
			onClose={onClose}
		>
			{seat === null ? null : (
				<Button
					label={fmt(dice.table.autopilotOn, { name })}
					onPress={() => {
						controls.setAutopilot(seat, true);
						onClose();
					}}
					testID="dice-autopilot-on"
				/>
			)}
		</Sheet>
	);
}

/** Tells a player the computer has their seat, with the way to take it back. */
export function AutopilotNote({
	table,
	controls,
}: {
	table: DiceTableBundle;
	controls: DiceTableControls;
}) {
	const dice = useI18n().t.games.dice;
	const you = table.you;
	if (you === null || !table.seats[you]?.autopilot) {
		return null;
	}
	return (
		<>
			<AppText variant="secondary">{dice.table.autopilotActive}</AppText>
			<Button
				variant="secondary"
				label={dice.table.autopilotBack}
				onPress={() => controls.setAutopilot(you, false)}
				testID="dice-autopilot-back"
			/>
		</>
	);
}

/** The end of any dice game: who won, everyone's total, and what next. */
export function EndPanel({
	table,
	view,
	controls,
}: {
	table: DiceTableBundle;
	view: DiceView;
	controls: DiceTableControls;
}) {
	const router = useRouter();
	const { t, locale } = useI18n();
	const dice = t.games.dice;
	const you = table.you;
	const won = you !== null && view.winners.includes(you);
	const title =
		view.winners.length > 1
			? dice.table.tie
			: won
				? dice.table.youWin
				: fmt(dice.table.winner, {
						name: diceSeatName(dice, table, view.winners[0]),
					});

	useEffect(() => {
		AccessibilityInfo.announceForAccessibility(title);
		if (won) haptics.gameWon();
	}, [title, won]);

	return (
		<Card testID="dice-end">
			<AppText variant="title" accessibilityRole="header">
				{title}
			</AppText>
			<AppText variant="label">{dice.table.standings.toUpperCase()}</AppText>
			{standings(view).map(({ seat, total }) => (
				<View key={seat} style={styles.standing}>
					<AppText variant="body" numberOfLines={1} style={styles.flex}>
						{diceSeatName(dice, table, seat)}
					</AppText>
					<AppText variant="heading">{total.toLocaleString(locale)}</AppText>
				</View>
			))}
			{you !== null ? (
				<Button
					label={dice.table.playAgain}
					busy={controls.pending}
					onPress={controls.rematch}
					testID="dice-rematch"
				/>
			) : (
				<AppText variant="secondary">{dice.table.waitingRematch}</AppText>
			)}
			<Button
				variant="secondary"
				label={dice.table.newGame}
				onPress={() => router.dismissTo("/dice")}
				testID="dice-new-game"
			/>
		</Card>
	);
}

const styles = StyleSheet.create({
	spectator: { alignItems: "center", gap: spacing.xs },
	standing: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.md,
		minHeight: metrics.hitTarget,
	},
	flex: { flex: 1 },
});
