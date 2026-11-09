/** The lobby's room code to share and who has joined so far. */
import { StyleSheet, View } from "react-native";
import { plural, useI18n } from "../../../i18n";
import { spacing } from "../../../theme";
import { Button } from "../../../ui/button";
import { Card } from "../../../ui/card";
import { AppText } from "../../../ui/text";
import { InviteQr } from "../../sessions/host/invite-qr";
import { shareInvite } from "../../sessions/host/share-invite";
import { webJoinUrl } from "../../sessions/session-links";
import { type HitsterBundle, lobbyPlayers } from "./room-view";

export function LobbyRoster({ bundle }: { bundle: HitsterBundle }) {
	const { t, locale } = useI18n();
	const players = lobbyPlayers(bundle);
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
						<InviteQr value={webJoinUrl({ code }) ?? code} size={176} />
						<Button
							variant="secondary"
							label={t.games.hitster.hostView.shareCode}
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
		</>
	);
}

const styles = StyleSheet.create({
	section: { gap: spacing.sm },
});
