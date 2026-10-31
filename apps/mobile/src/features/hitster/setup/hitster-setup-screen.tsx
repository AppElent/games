/**
 * Hitster's front door: pick a mode, pack, target and timer, then open a
 * room friends join with its code. Hosting needs an account; joining a room
 * goes through the Join tab.
 */
import { gameErrorMessage } from "@games/core/errors";
import { HITSTER_MODES, type HitsterMode } from "@games/core/hitster";
import {
	getPlayableHitsterCards,
	listHitsterPacks,
} from "@games/core/hitster-packs";
import { useMutation } from "convex/react";
import { useRouter } from "expo-router";
import { type ReactNode, useState } from "react";
import { StyleSheet, View } from "react-native";
import { api } from "../../../convex/api";
import { haptics } from "../../../feedback/haptics";
import { fmt, plural, useI18n } from "../../../i18n";
import { spacing } from "../../../theme";
import { Button } from "../../../ui/button";
import { ChoiceList } from "../../../ui/choice-list";
import { Notice } from "../../../ui/notice";
import { Screen } from "../../../ui/screen";
import { Segmented } from "../../../ui/segmented";
import { AppText } from "../../../ui/text";
import { HostGate } from "../../sessions/host/host-gate";
import { useHostSession } from "../../sessions/host/use-host-session";
import { onlineSessionHref } from "../../sessions/session-links";

const TARGETS = ["5", "8", "10", "12", "15"] as const;
const TIMERS = ["0", "30", "60", "90"] as const;

export function HitsterSetupScreen() {
	const router = useRouter();
	const { t, locale } = useI18n();
	const copy = t.games.hitster;
	const hosting = useHostSession();
	const setup = useMutation(api.hitster.setup);
	const [mode, setMode] = useState<HitsterMode>("original");
	const [packId, setPackId] = useState("normal");
	const [target, setTarget] = useState<(typeof TARGETS)[number]>("10");
	const [timer, setTimer] = useState<(typeof TIMERS)[number]>("0");

	const packs = listHitsterPacks();

	const create = async () => {
		const session = await hosting.host(
			{ gameType: "hitster", joinMode: "room", title: t.catalog.hitster.title },
			(created) =>
				setup({
					sessionId: created.sessionId,
					participantId: created.participantId,
					mode,
					packId,
					targetCards: Number(target),
					turnTimerSeconds: timer === "0" ? undefined : Number(timer),
					playbackMode: "hostDevice",
				}),
		);
		if (!session) {
			haptics.actionFailed();
			return;
		}
		const href = onlineSessionHref("hitster", session.sessionId);
		if (href) router.replace(href);
	};

	return (
		<Screen>
			<AppText variant="secondary">{copy.newGame.intro}</AppText>
			{hosting.isSignedIn ? (
				<>
					<Section label={copy.setupForm.gameModeLabel}>
						<ChoiceList
							choices={HITSTER_MODES.map((value) => ({
								value,
								label: copy.modes[value].label,
								detail: copy.modes[value].summary,
							}))}
							value={mode}
							onChange={setMode}
							accessibilityLabel={copy.setupForm.gameModeLabel}
							testID="hitster-mode"
						/>
					</Section>
					<Section label={copy.setupForm.songPackLabel}>
						<ChoiceList
							choices={packs.map((pack) => ({
								value: pack.id,
								label: pack.title,
								detail: `${pack.description} ${plural(
									locale,
									getPlayableHitsterCards(pack.id, "hostDevice").length,
									copy.setupForm.packTracks,
								)}`,
							}))}
							value={packId}
							onChange={setPackId}
							accessibilityLabel={copy.setupForm.songPackLabel}
							testID="hitster-pack"
						/>
					</Section>
					<Section label={copy.setupForm.cardsToWinLabel}>
						<Segmented
							options={TARGETS.map((value) => ({ value, label: value }))}
							value={target}
							onChange={setTarget}
							accessibilityLabel={copy.setupForm.cardsToWinLabel}
						/>
					</Section>
					<Section label={copy.setupForm.turnTimerLabel}>
						<Segmented
							options={TIMERS.map((value) => ({
								value,
								label:
									value === "0"
										? copy.setupForm.noTimer
										: fmt(copy.setupForm.timerSecondsShort, { count: value }),
							}))}
							value={timer}
							onChange={setTimer}
							accessibilityLabel={copy.setupForm.turnTimerLabel}
						/>
					</Section>
					<AppText variant="caption">{copy.setupForm.playbackNote}</AppText>
					<Notice
						message={
							hosting.error
								? gameErrorMessage(
										t,
										hosting.error,
										copy.setupForm.createRoomError,
									)
								: null
						}
					/>
					<Button
						label={copy.setupForm.createRoom}
						onPress={create}
						busy={hosting.busy}
						disabled={!hosting.canHost}
						testID="hitster-create"
					/>
				</>
			) : (
				<HostGate />
			)}
			<Button
				variant="plain"
				label={copy.setupForm.joinInstead}
				onPress={() => router.push("/join")}
				testID="hitster-join-instead"
			/>
		</Screen>
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
