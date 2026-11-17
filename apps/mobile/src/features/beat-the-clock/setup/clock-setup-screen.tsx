/**
 * Beat the Clock's front door: pick a word pack, the time per turn, the
 * points to win and the number of teams, then open a room friends join with
 * its code. Players pick their team in the lobby.
 */
import {
	CLOCK_DEFAULTS,
	CLOCK_TARGETS,
	CLOCK_TEAM_COUNTS,
	CLOCK_TURN_SECONDS,
} from "@arcadeclub/core/beat-the-clock";
import {
	CLOCK_PACK_IDS,
	type ClockPackId,
	clockPackCards,
} from "@arcadeclub/core/beat-the-clock-packs";
import { gameErrorMessage } from "@arcadeclub/core/errors";
import { Stack, useRouter } from "expo-router";
import { type ReactNode, useState } from "react";
import { StyleSheet, View } from "react-native";
import { fmt, plural, useI18n } from "../../../i18n";
import { spacing } from "../../../theme";
import { Button } from "../../../ui/button";
import { ChoiceList } from "../../../ui/choice-list";
import { Notice } from "../../../ui/notice";
import { Screen } from "../../../ui/screen";
import { Segmented } from "../../../ui/segmented";
import { AppText } from "../../../ui/text";
import { onlineSessionHref } from "../../play/app-games";
import { HostGate } from "../../sessions/host/host-gate";
import { useHostSession } from "../../sessions/host/use-host-session";

export function ClockSetupScreen() {
	const router = useRouter();
	const { t, locale } = useI18n();
	const copy = t.games.beatTheClock;
	const hosting = useHostSession("beat-the-clock");
	const [packId, setPackId] = useState<ClockPackId>("everyday");
	const [seconds, setSeconds] = useState(String(CLOCK_DEFAULTS.turnSeconds));
	const [target, setTarget] = useState(String(CLOCK_DEFAULTS.target));
	const [teamCount, setTeamCount] = useState(String(CLOCK_DEFAULTS.teamCount));

	const create = async () => {
		const session = await hosting.host({
			title: copy.title,
			packId,
			locale,
			turnSeconds: Number(seconds),
			target: Number(target),
			teamCount: Number(teamCount),
		});
		if (session)
			router.replace(onlineSessionHref("beat-the-clock", session.sessionId));
	};

	const numbers = (values: readonly number[], label?: string) =>
		values.map((value) => ({
			value: String(value),
			label: label ? fmt(label, { n: value }) : String(value),
		}));

	return (
		<>
			<Stack.Screen options={{ title: copy.title }} />
			<Screen>
				{hosting.isSignedIn ? (
					<>
						<Section label={copy.settings.pack}>
							<ChoiceList
								choices={CLOCK_PACK_IDS.map((id) => ({
									value: id,
									label: copy.settings.packs[id],
									detail: plural(
										locale,
										clockPackCards(id, locale),
										copy.settings.cards,
									),
								}))}
								value={packId}
								onChange={setPackId}
								accessibilityLabel={copy.settings.pack}
								testID="clock-pack"
							/>
						</Section>
						<Section label={copy.settings.timer}>
							<Segmented
								options={numbers(CLOCK_TURN_SECONDS, copy.settings.seconds)}
								value={seconds}
								onChange={setSeconds}
								accessibilityLabel={copy.settings.timer}
							/>
						</Section>
						<Section label={copy.settings.target}>
							<Segmented
								options={numbers(CLOCK_TARGETS)}
								value={target}
								onChange={setTarget}
								accessibilityLabel={copy.settings.target}
							/>
						</Section>
						<Section label={copy.settings.teams}>
							<Segmented
								options={numbers(CLOCK_TEAM_COUNTS)}
								value={teamCount}
								onChange={setTeamCount}
								accessibilityLabel={copy.settings.teams}
							/>
						</Section>
						<AppText variant="caption">{copy.settings.note}</AppText>
						<Notice
							message={
								hosting.error
									? gameErrorMessage(
											t,
											hosting.error,
											copy.settings.createError,
										)
									: null
							}
						/>
						<Button
							label={copy.settings.create}
							onPress={create}
							busy={hosting.busy}
							disabled={!hosting.canHost}
							testID="clock-create"
						/>
					</>
				) : (
					<HostGate />
				)}
			</Screen>
		</>
	);
}

function Section({ label, children }: { label: string; children: ReactNode }) {
	return (
		<View style={styles.section}>
			<AppText variant="label" accessibilityRole="header">
				{label.toUpperCase()}
			</AppText>
			{children}
		</View>
	);
}

const styles = StyleSheet.create({
	section: { gap: spacing.sm },
});
