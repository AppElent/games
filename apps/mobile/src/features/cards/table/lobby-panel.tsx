/** The table before the deal: invite people, fill seats, and the host deals. */
import type {
	CardGameDefinition,
	CardGameId,
} from "@arcadeclub/core/cards/engine";
import { seatName } from "@arcadeclub/core/cards/table-view";
import { Stack, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { fmt, plural, useI18n } from "../../../i18n";
import { metrics, radius, spacing, useTokens } from "../../../theme";
import { Button } from "../../../ui/button";
import { Card } from "../../../ui/card";
import { Icon } from "../../../ui/icon";
import { Notice } from "../../../ui/notice";
import { QrCode } from "../../../ui/qr-code";
import { Screen } from "../../../ui/screen";
import { AppText } from "../../../ui/text";
import { shareInvite } from "../../sessions/host/share-invite";
import { webJoinUrl } from "../../sessions/session-links";
import { RulesSheet } from "../deck/rules-sheet";
import type { CardTableBundle, CardTableControls } from "./use-card-table";

export function LobbyPanel({
	game,
	table,
	controls,
}: {
	game: CardGameDefinition;
	table: CardTableBundle;
	controls: CardTableControls;
}) {
	const router = useRouter();
	const { t, locale } = useI18n();
	const tokens = useTokens();
	const cards = t.games.cards;
	const text = cards.games[game.id as CardGameId];
	const [rulesOpen, setRulesOpen] = useState(false);
	const code = table.session.joinCode ?? "";
	const optionText = text.options as Record<string, { label: string }>;
	const missing = Math.max(0, game.players.min - table.seats.length);
	const canAdd = table.seats.length < game.players.max;
	const headerOptions = useMemo(() => ({ title: text.name }), [text.name]);

	return (
		<>
			<Stack.Screen options={headerOptions} />
			<Screen>
				{table.you === null && canAdd ? (
					<Card>
						<AppText variant="body">{cards.lobby.joinPrompt}</AppText>
						<Button
							label={cards.lobby.joinButton}
							onPress={() =>
								router.replace({ pathname: "/join", params: { code } })
							}
							testID="cards-lobby-join"
						/>
					</Card>
				) : null}
				<Card>
					<View style={styles.section}>
						<AppText variant="label">
							{cards.lobby.codeLabel.toUpperCase()}
						</AppText>
						<AppText
							variant="code"
							selectable
							style={styles.code}
							testID="cards-room-code"
						>
							{code}
						</AppText>
						<View style={styles.qr}>
							<QrCode
								value={webJoinUrl({ code }) ?? code}
								size={176}
								accessibilityLabel={t.common.joinPanel.scanQrLabel}
							/>
						</View>
						<Button
							variant="secondary"
							label={cards.lobby.inviteLabel}
							onPress={() => void shareInvite(t, text.name, { code })}
							testID="cards-share"
						/>
					</View>
				</Card>
				<Card>
					<View style={styles.section}>
						<AppText variant="label" accessibilityRole="header">
							{`${cards.lobby.seatsHeading} · ${fmt(cards.lobby.seatsCount, {
								count: table.seats.length,
								max: game.players.max,
							})}`.toUpperCase()}
						</AppText>
						{table.seats.map((seat, index) => {
							const name = seatName(cards, table, index);
							return (
								<View
									key={seat.participantId ?? `bot-${seat.botIndex}`}
									style={styles.seat}
								>
									{seat.botIndex !== null ? (
										<Icon
											ios="cpu"
											android="smart_toy"
											size={16}
											color={tokens.textMuted}
										/>
									) : null}
									<AppText variant="body" numberOfLines={1} style={styles.name}>
										{name}
									</AppText>
									{seat.isHost || seat.botIndex !== null ? (
										<AppText variant="caption">
											{seat.isHost
												? cards.lobby.hostBadge
												: cards.lobby.botBadge}
										</AppText>
									) : null}
									{table.isHost && !seat.isHost ? (
										<Pressable
											accessibilityRole="button"
											accessibilityLabel={fmt(cards.lobby.removeSeat, { name })}
											onPress={() => controls.removeSeat(index)}
											testID={`cards-remove-${index}`}
											style={styles.remove}
										>
											<Icon
												ios="xmark"
												android="close"
												size={14}
												color={tokens.textMuted}
											/>
										</Pressable>
									) : null}
								</View>
							);
						})}
						{table.isHost && canAdd ? (
							<Button
								variant="secondary"
								label={cards.lobby.addBot}
								disabled={controls.pending}
								onPress={controls.addBot}
								testID="cards-add-bot"
							/>
						) : null}
						{table.options.length > 0 ? (
							<AppText variant="caption">
								{`${cards.lobby.houseRulesOn}: ${table.options
									.map((id) => optionText[id]?.label)
									.join(", ")}`}
							</AppText>
						) : null}
					</View>
				</Card>
				<Notice message={controls.error} />
				{table.isHost ? (
					<>
						{missing > 0 ? (
							<AppText variant="caption">
								{plural(locale, missing, cards.lobby.needPlayers)}
							</AppText>
						) : null}
						<Button
							label={cards.lobby.startButton}
							disabled={missing > 0}
							busy={controls.pending}
							onPress={controls.start}
							testID="cards-start"
						/>
					</>
				) : (
					<AppText variant="secondary">
						{table.you !== null
							? cards.lobby.waitingForHost
							: cards.lobby.watching}
					</AppText>
				)}
				<Button
					variant="plain"
					label={cards.setup.rulesButton}
					onPress={() => setRulesOpen(true)}
					testID="cards-lobby-rules"
				/>
			</Screen>
			<RulesSheet
				game={game}
				options={table.options}
				open={rulesOpen}
				onClose={() => setRulesOpen(false)}
			/>
		</>
	);
}

const styles = StyleSheet.create({
	section: { gap: spacing.sm },
	code: { textAlign: "center" },
	qr: { alignSelf: "center", borderRadius: radius.sm, overflow: "hidden" },
	seat: {
		minHeight: metrics.hitTarget,
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.sm,
	},
	name: { flex: 1 },
	remove: {
		width: metrics.hitTarget,
		height: metrics.hitTarget,
		alignItems: "center",
		justifyContent: "center",
	},
});
