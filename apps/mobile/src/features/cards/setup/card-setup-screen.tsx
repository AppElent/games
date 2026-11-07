/**
 * One game's front door: who to play, how many opponents, which house rules.
 * Playing the computer needs no account; hosting friends does.
 */
import {
	type CardGameDefinition,
	type CardGameId,
	getCardGame,
	isCardGameId,
} from "@arcadeclub/core/cards/engine";
import { gameErrorMessage } from "@arcadeclub/core/errors";
import { useMutation } from "convex/react";
import { Stack, useRouter } from "expo-router";
import { type ReactNode, useMemo, useState } from "react";
import { Pressable, StyleSheet, Switch, View } from "react-native";
import { api } from "../../../convex/api";
import { haptics } from "../../../feedback/haptics";
import { plural, useI18n } from "../../../i18n";
import {
	metrics,
	radius,
	spacing,
	type Tokens,
	useThemedStyles,
	useTokens,
} from "../../../theme";
import { Button } from "../../../ui/button";
import { Card } from "../../../ui/card";
import { CenteredState } from "../../../ui/centered-state";
import { ChoiceList } from "../../../ui/choice-list";
import { Icon } from "../../../ui/icon";
import { Notice } from "../../../ui/notice";
import { Screen } from "../../../ui/screen";
import { AppText } from "../../../ui/text";
import { usePlayerIdentity } from "../../players/use-player-identity";
import { HostGate } from "../../sessions/host/host-gate";
import { useHostSession } from "../../sessions/host/use-host-session";
import { onlineSessionHref } from "../../sessions/session-links";
import { rememberSeat } from "../../sessions/session-seats";
import { newSeatSecret } from "../../sessions/use-join-session";
import { RulesSheet } from "../deck/rules-sheet";

export function CardSetupScreen({ gameId }: { gameId: string }) {
	const router = useRouter();
	const { t } = useI18n();
	const cards = t.games.cards;
	if (!isCardGameId(gameId)) {
		return (
			<CenteredState
				title={cards.session.unknownGame}
				action={{
					label: cards.session.backToGames,
					onPress: () => router.replace("/cards"),
				}}
			/>
		);
	}
	return <Setup game={getCardGame(gameId)} gameId={gameId} />;
}

function Setup({
	game,
	gameId,
}: {
	game: CardGameDefinition;
	gameId: CardGameId;
}) {
	const router = useRouter();
	const { t, locale } = useI18n();
	const cards = t.games.cards;
	const text = cards.games[gameId];
	const optionText = text.options as Record<
		string,
		{ label: string; hint: string }
	>;
	const tokens = useTokens();
	const styles = useThemedStyles(createStyles);
	const identity = usePlayerIdentity();
	const hosting = useHostSession();
	const createTable = useMutation(api.cardGames.createTable);
	const [mode, setMode] = useState<"computer" | "friends">("computer");
	const [opponents, setOpponents] = useState(Math.min(game.players.max - 1, 3));
	const [options, setOptions] = useState<string[]>([]);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<unknown>(null);
	const [rulesOpen, setRulesOpen] = useState(false);
	const solo = mode === "computer";
	const headerOptions = useMemo(() => ({ title: text.name }), [text.name]);

	const create = async () => {
		setBusy(true);
		setError(null);
		try {
			const seatSecret = newSeatSecret();
			const { sessionId, participantId } = await createTable({
				seatSecret,
				joinMode: solo ? "solo" : "room",
				title: text.name,
				displayName: identity.displayName,
				guestId: identity.guestId,
				gameId,
				options,
				bots: solo ? opponents : 0,
				start: solo,
			});
			rememberSeat({
				sessionId,
				participantId,
				gameType: "card-games",
				seatSecret,
			});
			haptics.moveMade();
			const href = onlineSessionHref("card-games", sessionId);
			if (href) router.replace(href);
		} catch (caught) {
			setError(caught);
			haptics.actionFailed();
			setBusy(false);
		}
	};

	const stepper = (delta: number, label: string, disabled: boolean) => (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={label}
			accessibilityState={{ disabled }}
			disabled={disabled}
			onPress={() => {
				haptics.selectionChanged();
				setOpponents((count) => count + delta);
			}}
			testID={delta > 0 ? "cards-opponents-more" : "cards-opponents-fewer"}
			style={[styles.step, disabled && styles.stepDisabled]}
		>
			<Icon
				ios={delta > 0 ? "plus" : "minus"}
				android={delta > 0 ? "add" : "remove"}
				size={18}
				color={tokens.accent}
			/>
		</Pressable>
	);

	return (
		<>
			<Stack.Screen options={headerOptions} />
			<Screen>
				<AppText variant="secondary">{text.blurb}</AppText>
				<Section label={cards.setup.modeLabel}>
					<ChoiceList
						choices={[
							{
								value: "computer",
								label: cards.setup.vsComputer,
								detail: cards.setup.vsComputerHint,
							},
							{
								value: "friends",
								label: cards.setup.withFriends,
								detail: cards.setup.withFriendsHint,
							},
						]}
						value={mode}
						onChange={setMode}
						accessibilityLabel={cards.setup.modeLabel}
						testID="cards-mode"
					/>
				</Section>
				{solo ? (
					<Section label={cards.setup.opponentsLabel}>
						<View style={styles.stepper}>
							{stepper(
								-1,
								cards.setup.fewerOpponents,
								opponents <= game.players.min - 1,
							)}
							<AppText
								variant="body"
								accessibilityLiveRegion="polite"
								style={styles.count}
							>
								{plural(locale, opponents, cards.setup.opponents)}
							</AppText>
							{stepper(
								1,
								cards.setup.moreOpponents,
								opponents >= game.players.max - 1,
							)}
						</View>
					</Section>
				) : null}
				{game.options.length > 0 ? (
					<Section label={cards.setup.houseRules}>
						<Card>
							{game.options.map((option) => {
								const on = options.includes(option.id);
								const label = optionText[option.id];
								return (
									<View key={option.id} style={styles.rule}>
										<View style={styles.ruleText}>
											<AppText variant="body">{label.label}</AppText>
											<AppText variant="caption">{label.hint}</AppText>
										</View>
										<Switch
											accessibilityLabel={label.label}
											accessibilityHint={label.hint}
											value={on}
											trackColor={{ true: tokens.accent }}
											onValueChange={(next) =>
												setOptions((current) =>
													next
														? [...current, option.id]
														: current.filter((id) => id !== option.id),
												)
											}
											testID={`cards-option-${option.id}`}
										/>
									</View>
								);
							})}
						</Card>
					</Section>
				) : null}
				<Notice
					message={
						error
							? gameErrorMessage(t, error, cards.setup.couldNotCreate)
							: null
					}
				/>
				{!solo && !hosting.isSignedIn ? (
					<HostGate />
				) : (
					<Button
						label={solo ? cards.setup.playNow : cards.setup.openRoom}
						onPress={create}
						busy={busy}
						disabled={!solo && !hosting.canHost}
						testID="cards-create"
					/>
				)}
				<Button
					variant="plain"
					label={cards.setup.rulesButton}
					onPress={() => setRulesOpen(true)}
					testID="cards-rules"
				/>
			</Screen>
			<RulesSheet
				game={game}
				options={options}
				open={rulesOpen}
				onClose={() => setRulesOpen(false)}
			/>
		</>
	);
}

function Section({ label, children }: { label: string; children: ReactNode }) {
	const styles = useThemedStyles(createStyles);
	return (
		<View style={styles.section}>
			<AppText variant="label" accessibilityRole="header">
				{label.toUpperCase()}
			</AppText>
			{children}
		</View>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		section: { gap: spacing.sm },
		stepper: {
			flexDirection: "row",
			alignItems: "center",
			gap: spacing.sm,
			padding: spacing.xs,
			borderRadius: radius.md,
			backgroundColor: colors.surface2,
		},
		step: {
			width: metrics.hitTarget,
			height: metrics.hitTarget,
			borderRadius: radius.sm,
			alignItems: "center",
			justifyContent: "center",
			backgroundColor: colors.surface,
		},
		stepDisabled: { opacity: 0.45 },
		count: { flex: 1, textAlign: "center" },
		rule: {
			minHeight: metrics.hitTarget,
			flexDirection: "row",
			alignItems: "center",
			gap: spacing.md,
		},
		ruleText: { flex: 1, gap: spacing.xxs },
	});
