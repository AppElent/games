/**
 * A table game before it starts: invite people, fill seats, and the host
 * starts. Each game's lobby screen passes its own words and rules sheet.
 */
import { Stack, useRouter } from "expo-router";
import { type ReactNode, useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import type { Id } from "../../convex/api";
import { fmt, plural, useI18n } from "../../i18n";
import { metrics, spacing, useTokens } from "../../theme";
import { Button } from "../../ui/button";
import { Card } from "../../ui/card";
import { Icon } from "../../ui/icon";
import { Notice } from "../../ui/notice";
import { Screen } from "../../ui/screen";
import { AppText } from "../../ui/text";
import { InviteQr } from "../sessions/host/invite-qr";
import { shareInvite } from "../sessions/host/share-invite";
import { webJoinUrl } from "../sessions/session-links";

/** The lobby's text: `cards.lobby` and `dice.lobby` share these keys. */
type LobbyWords = {
	codeLabel: string;
	inviteLabel: string;
	seatsHeading: string;
	seatsCount: string;
	hostBadge: string;
	botBadge: string;
	addBot: string;
	removeSeat: string;
	startButton: string;
	needPlayers: { one: string; other: string };
	waitingForHost: string;
	watching: string;
	joinPrompt: string;
	joinButton: string;
	houseRulesOn: string;
};

type LobbyTable = {
	session: { joinCode: string | null };
	seats: ReadonlyArray<{
		participantId: Id<"sessionParticipants"> | null;
		botIndex: number | null;
		isHost: boolean;
	}>;
	you: number | null;
	isHost: boolean;
	options: readonly string[];
};

type LobbyControls = {
	pending: boolean;
	error: string;
	addBot: () => void;
	removeSeat: (index: number) => void;
	start: () => void;
};

export function TableLobby({
	name,
	players,
	table,
	controls,
	words,
	seatName,
	optionLabel,
	rulesButton,
	onRules,
	rulesSheet,
	testPrefix,
}: {
	name: string;
	players: { min: number; max: number };
	table: LobbyTable;
	controls: LobbyControls;
	words: LobbyWords;
	seatName: (seat: number) => string;
	optionLabel: (id: string) => string | undefined;
	rulesButton: string;
	onRules: () => void;
	rulesSheet: ReactNode;
	/** Starts every testID here, such as `cards`. */
	testPrefix: string;
}) {
	const router = useRouter();
	const { t, locale } = useI18n();
	const tokens = useTokens();
	const code = table.session.joinCode ?? "";
	const missing = Math.max(0, players.min - table.seats.length);
	const canAdd = table.seats.length < players.max;
	const headerOptions = useMemo(() => ({ title: name }), [name]);

	return (
		<>
			<Stack.Screen options={headerOptions} />
			<Screen>
				{table.you === null && canAdd ? (
					<Card>
						<AppText variant="body">{words.joinPrompt}</AppText>
						<Button
							label={words.joinButton}
							onPress={() =>
								router.replace({ pathname: "/join", params: { code } })
							}
							testID={`${testPrefix}-lobby-join`}
						/>
					</Card>
				) : null}
				<Card>
					<View style={styles.section}>
						<AppText variant="label">{words.codeLabel.toUpperCase()}</AppText>
						<AppText
							variant="code"
							selectable
							style={styles.code}
							testID={`${testPrefix}-room-code`}
						>
							{code}
						</AppText>
						<InviteQr value={webJoinUrl({ code }) ?? code} size={176} />
						<Button
							variant="secondary"
							label={words.inviteLabel}
							onPress={() => void shareInvite(t, name, { code })}
							testID={`${testPrefix}-share`}
						/>
					</View>
				</Card>
				<Card>
					<View style={styles.section}>
						<AppText variant="label" accessibilityRole="header">
							{`${words.seatsHeading} · ${fmt(words.seatsCount, {
								count: table.seats.length,
								max: players.max,
							})}`.toUpperCase()}
						</AppText>
						{table.seats.map((seat, index) => {
							const seatLabel = seatName(index);
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
										{seatLabel}
									</AppText>
									{seat.isHost || seat.botIndex !== null ? (
										<AppText variant="caption">
											{seat.isHost ? words.hostBadge : words.botBadge}
										</AppText>
									) : null}
									{table.isHost && !seat.isHost ? (
										<Pressable
											accessibilityRole="button"
											accessibilityLabel={fmt(words.removeSeat, {
												name: seatLabel,
											})}
											onPress={() => controls.removeSeat(index)}
											testID={`${testPrefix}-remove-${index}`}
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
								label={words.addBot}
								disabled={controls.pending}
								onPress={controls.addBot}
								testID={`${testPrefix}-add-bot`}
							/>
						) : null}
						{table.options.length > 0 ? (
							<AppText variant="caption">
								{`${words.houseRulesOn}: ${table.options
									.map(optionLabel)
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
								{plural(locale, missing, words.needPlayers)}
							</AppText>
						) : null}
						<Button
							label={words.startButton}
							disabled={missing > 0}
							busy={controls.pending}
							onPress={controls.start}
							testID={`${testPrefix}-start`}
						/>
					</>
				) : (
					<AppText variant="secondary">
						{table.you !== null ? words.waitingForHost : words.watching}
					</AppText>
				)}
				<Button
					variant="plain"
					label={rulesButton}
					onPress={onRules}
					testID={`${testPrefix}-lobby-rules`}
				/>
			</Screen>
			{rulesSheet}
		</>
	);
}

const styles = StyleSheet.create({
	section: { gap: spacing.sm },
	code: { textAlign: "center" },
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
