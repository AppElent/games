/**
 * Before the start, once the host has picked a mode: the room code and who
 * has joined, the host's Start button, and the mode's rules.
 */
import {
	type HitsterModeConfig,
	hitsterMinPlayers,
} from "@arcadeclub/core/hitster";
import { StyleSheet, View } from "react-native";
import { fmt, useI18n } from "../../../i18n";
import { spacing } from "../../../theme";
import { Button } from "../../../ui/button";
import { Card } from "../../../ui/card";
import { AppText } from "../../../ui/text";
import { LobbyRoster } from "./lobby-roster";
import { type HitsterBundle, lobbyPlayers } from "./room-view";
import { RulesPanel } from "./rules-panel";

export function LobbyPanel({
	bundle,
	config,
	modeLabel,
	target,
	isHost,
	busy,
	onStart,
}: {
	bundle: HitsterBundle;
	config: HitsterModeConfig;
	modeLabel: string;
	/** Cards on a timeline to win. */
	target: number;
	isHost: boolean;
	busy: boolean;
	onStart: () => void;
}) {
	const { t } = useI18n();
	const copy = t.games.hitster.hostView;
	const enough = lobbyPlayers(bundle).length >= hitsterMinPlayers(config);
	return (
		<>
			<LobbyRoster bundle={bundle} />
			{isHost ? (
				<>
					{enough ? null : (
						<AppText variant="caption">{copy.needPlayers}</AppText>
					)}
					<Button
						label={copy.startGame}
						onPress={onStart}
						disabled={!enough}
						busy={busy}
						testID="hitster-start"
					/>
				</>
			) : (
				<AppText variant="secondary">
					{t.games.hitster.stage.statusWaitingForHost}
				</AppText>
			)}
			<Card>
				<View style={styles.section}>
					<AppText variant="heading" accessibilityRole="header">
						{fmt(t.games.hitster.stage.howItWorksHeading, { mode: modeLabel })}
					</AppText>
					<RulesPanel config={config} target={target} />
				</View>
			</Card>
		</>
	);
}

const styles = StyleSheet.create({
	section: { gap: spacing.sm },
});
