/**
 * What every dice table in play shares, whatever its family: the header with
 * the rules, the spectator's rejoin, the error notice, the news a screen
 * reader hears, the seat menu, autopilot, and the end-of-game panel.
 */
import type { DiceGame } from "@arcadeclub/core/dice/engine";
import { diceSeatName } from "@arcadeclub/core/dice/table-view";
import { seatIsSilent } from "@arcadeclub/core/table-engine";
import { Stack, useRouter } from "expo-router";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { AccessibilityInfo, StyleSheet, View } from "react-native";
import { haptics } from "../../../feedback/haptics";
import { fmt, useI18n } from "../../../i18n";
import { spacing } from "../../../theme";
import { Button, HeaderButton } from "../../../ui/button";
import { Card } from "../../../ui/card";
import { Notice } from "../../../ui/notice";
import { Screen } from "../../../ui/screen";
import { AppText } from "../../../ui/text";
import { Sheet } from "../../cards/deck/sheet";
import { DiceRulesSheet } from "../rules/dice-rules-sheet";
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

type News = { seq: number; text: string } | null;

export function DiceTableFrame({
	game,
	table,
	controls,
	news,
	end,
	tray,
	children,
}: {
	game: DiceGame;
	table: DiceTableBundle;
	controls: DiceTableControls;
	news: News;
	end: ReactNode;
	/** What the player acts with, above the spectator's note and the news. */
	tray: ReactNode;
	children: ReactNode;
}) {
	const { t } = useI18n();
	const dice = t.games.dice;
	const text = dice.games[game.id];
	const [rulesOpen, setRulesOpen] = useState(false);
	const router = useRouter();
	const newsSeq = news?.seq;
	const newsText = news?.text;

	useEffect(() => {
		// Keyed on `seq` too, so a second identical move is still read out.
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
				{end}
				{tray}
				{table.you === null ? (
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
				{children}
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

/** While the computer plays your seat: say so, and offer it back. */
export function AutopilotNotice({
	table,
	controls,
}: {
	table: DiceTableBundle;
	controls: DiceTableControls;
}) {
	const { t } = useI18n();
	const dice = t.games.dice;
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

/**
 * Who may hand another player's seat to the computer: the host at any time,
 * anyone once that player stops responding. `sheet` is the menu to render.
 */
export function useSeatMenu(
	table: DiceTableBundle,
	controls: DiceTableControls,
	now: number,
) {
	const { t } = useI18n();
	const dice = t.games.dice;
	const [menuSeat, setMenuSeat] = useState<number | null>(null);
	const name = (seat: number) => diceSeatName(dice, table, seat);

	const canManage = (seat: number) => {
		const entry = table.seats[seat];
		return (
			table.you !== null &&
			seat !== table.you &&
			entry.botIndex === null &&
			!entry.autopilot &&
			(table.isHost || seatIsSilent(entry, now))
		);
	};

	const sheet = (
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
	);

	return { canManage, open: setMenuSeat, sheet };
}

/** Who won and in what order, then play again or pick another game. */
export function DiceEndPanel({
	table,
	controls,
	title,
	won,
	heading,
	children,
}: {
	table: DiceTableBundle;
	controls: DiceTableControls;
	title: string;
	won: boolean;
	heading: string;
	children: ReactNode;
}) {
	const router = useRouter();
	const { t } = useI18n();
	const dice = t.games.dice;

	useEffect(() => {
		AccessibilityInfo.announceForAccessibility(title);
		if (won) haptics.gameWon();
	}, [title, won]);

	return (
		<Card testID="dice-end">
			<AppText variant="title" accessibilityRole="header">
				{title}
			</AppText>
			<AppText variant="label">{heading.toUpperCase()}</AppText>
			{children}
			{table.you !== null ? (
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
});
