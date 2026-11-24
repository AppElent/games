/**
 * What every dice table shows whatever its family: the header, the
 * spectator's way back in, news read out to screen readers, the seat menu,
 * and the autopilot note. The end of the game is `DiceEndPanel`.
 */
import { diceSeatName } from "@arcadeclub/core/dice/table-view";
import { seatIsSilent } from "@arcadeclub/core/table-engine";
import { Stack, useRouter } from "expo-router";
import { useEffect, useMemo } from "react";
import { AccessibilityInfo, StyleSheet, View } from "react-native";
import { fmt, useI18n } from "../../../i18n";
import { spacing } from "../../../theme";
import { Button, HeaderButton } from "../../../ui/button";
import { Sheet } from "../../../ui/sheet";
import { AppText } from "../../../ui/text";
import type { DiceTableBundle, DiceTableControls } from "./use-dice-table";

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

const styles = StyleSheet.create({
	spectator: { alignItems: "center", gap: spacing.xs },
});
