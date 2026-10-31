/** Before the start: the room code to share, who has joined, the rules. */
import type { HitsterModeConfig } from "@games/core/hitster";
import { StyleSheet, View } from "react-native";
import { fmt, plural, useI18n } from "../../../i18n";
import { spacing } from "../../../theme";
import { Button } from "../../../ui/button";
import { Card } from "../../../ui/card";
import { AppText } from "../../../ui/text";
import { shareInvite } from "../../sessions/host/share-invite";
import type { HitsterBundle } from "./room-view";
import { RulesPanel } from "./rules-panel";

export function LobbyPanel({
	bundle,
	config,
	modeLabel,
	isHost,
	busy,
	onStart,
}: {
	bundle: HitsterBundle;
	config: HitsterModeConfig;
	modeLabel: string;
	isHost: boolean;
	busy: boolean;
	onStart: () => void;
}) {
	const { t, locale } = useI18n();
	const copy = t.games.hitster.hostView;
	const players = bundle.participants.filter(
		(participant) => participant.role !== "watcher" && !participant.kickedAt,
	);
	const enough = players.length >= (config.shared ? 1 : 2);
	const code = bundle.session.joinCode;
	return (
		<>
			{code ? (
				<Card>
					<View style={styles.section}>
						<AppText variant="label">
							{t.common.session.roomCode.toUpperCase()}
						</AppText>
						<AppText variant="code" selectable testID="hitster-room-code">
							{code}
						</AppText>
						<Button
							variant="secondary"
							label={copy.shareCode}
							onPress={() =>
								void shareInvite(t, t.catalog.hitster.title, { code })
							}
							testID="hitster-share-code"
						/>
					</View>
				</Card>
			) : null}
			<Card>
				<View style={styles.section}>
					<AppText variant="label">
						{`${t.common.participants.heading} · ${plural(locale, players.length, t.common.session.players)}`.toUpperCase()}
					</AppText>
					{players.map((player) => (
						<AppText key={player._id} variant="body">
							{player.displayName}
							{player.role === "host" ? ` · ${t.common.session.host}` : ""}
						</AppText>
					))}
				</View>
			</Card>
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
					<RulesPanel
						config={config}
						target={bundle.state?.targetCards ?? 10}
					/>
				</View>
			</Card>
		</>
	);
}

const styles = StyleSheet.create({
	section: { gap: spacing.sm },
});
