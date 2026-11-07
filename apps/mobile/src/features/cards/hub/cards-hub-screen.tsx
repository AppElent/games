/**
 * Card Club's front door: one felt tile per game in the registry, so a new game
 * in the config shows up here by itself.
 */
import type { CardId } from "@arcadeclub/core/cards/deck";
import {
	CARD_GAME_IDS,
	getCardGame,
	resolvedRules,
} from "@arcadeclub/core/cards/engine";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { fmt, useI18n } from "../../../i18n";
import {
	cardColors,
	opacity,
	radius,
	spacing,
	useAccessibilityTextSize,
} from "../../../theme";
import { Button } from "../../../ui/button";
import { Screen } from "../../../ui/screen";
import { AppText } from "../../../ui/text";
import { Felt } from "../deck/felt";
import { PlayingCard } from "../deck/playing-card";

const FANS: Record<"shedding" | "rummy", readonly CardId[]> = {
	shedding: ["H2#0", "D7#0", "SJ#0", "JK#1"],
	rummy: ["C9#0", "C10#0", "CJ#0", "JK#0"],
};
const FAN_CARD = 52;

export function CardsHubScreen() {
	const router = useRouter();
	const { t } = useI18n();
	const cards = t.games.cards;
	const stacked = useAccessibilityTextSize();
	return (
		<Screen>
			<AppText variant="secondary">{cards.hub.body}</AppText>
			{CARD_GAME_IDS.map((id) => {
				const game = getCardGame(id);
				const text = cards.games[id];
				const players = fmt(cards.hub.players, game.players);
				const fan = FANS[resolvedRules(game, []).family];
				return (
					<Pressable
						key={id}
						accessibilityRole="button"
						accessibilityLabel={text.name}
						accessibilityHint={`${text.blurb} ${players}`}
						onPress={() =>
							router.push({
								pathname: "/cards/[gameId]",
								params: { gameId: id },
							})
						}
						testID={`cards-game-${id}`}
						style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
					>
						<Felt felt={game.felt} />
						<View style={[styles.body, stacked && styles.stacked]}>
							<View style={styles.text}>
								<AppText variant="label" style={styles.kicker}>
									{text.tagline.toUpperCase()}
								</AppText>
								<AppText variant="title" style={styles.name}>
									{text.name}
								</AppText>
								<AppText variant="secondary" style={styles.blurb}>
									{text.blurb}
								</AppText>
								<AppText variant="caption" style={styles.blurb}>
									{players}
								</AppText>
							</View>
							{stacked ? null : (
								<View style={styles.fan}>
									{fan.map((card, index) => (
										<View
											key={card}
											style={[
												styles.fanCard,
												{
													left: index * 13,
													top: Math.abs(index - 1.5) * 5,
													transform: [{ rotate: `${(index - 1.5) * 9}deg` }],
												},
											]}
										>
											<PlayingCard card={card} width={FAN_CARD} />
										</View>
									))}
								</View>
							)}
						</View>
					</Pressable>
				);
			})}
			<View style={styles.join}>
				<AppText variant="secondary">{cards.hub.haveCode}</AppText>
				<Button
					variant="secondary"
					compact
					label={cards.hub.joinWithCode}
					onPress={() => router.push("/join")}
					testID="cards-join"
				/>
			</View>
		</Screen>
	);
}

const styles = StyleSheet.create({
	tile: { borderRadius: radius.lg, overflow: "hidden" },
	pressed: { opacity: opacity.pressed },
	body: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.md,
		padding: spacing.lg,
	},
	stacked: { flexDirection: "column", alignItems: "flex-start" },
	text: { flex: 1, gap: spacing.xs },
	kicker: { color: cardColors.gold },
	name: { color: cardColors.ivory },
	blurb: { color: cardColors.ivoryMuted },
	fan: { width: FAN_CARD + 13 * 3 + spacing.sm, height: 84 },
	fanCard: { position: "absolute" },
	join: {
		flexDirection: "row",
		flexWrap: "wrap",
		alignItems: "center",
		justifyContent: "space-between",
		gap: spacing.sm,
	},
});
