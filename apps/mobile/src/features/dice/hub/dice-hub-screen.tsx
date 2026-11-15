/**
 * Dice Club's front door: one felt tile per game in the registry, so a new game
 * in the config shows up here by itself.
 */
import { DICE_GAME_IDS, getDiceGame } from "@arcadeclub/core/dice/engine";
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
import { Felt } from "../../cards/deck/felt";
import { DieFace } from "../table/die-face";

const SHOWCASE_DIE = 30;

export function DiceHubScreen() {
	const router = useRouter();
	const { t } = useI18n();
	const dice = t.games.dice;
	const stacked = useAccessibilityTextSize();
	return (
		<Screen>
			<AppText variant="secondary">{dice.hub.body}</AppText>
			{DICE_GAME_IDS.map((id) => {
				const game = getDiceGame(id);
				const text = dice.games[id];
				const players = fmt(dice.hub.players, game.players);
				return (
					<Pressable
						key={id}
						accessibilityRole="button"
						accessibilityLabel={text.name}
						accessibilityHint={`${text.blurb} ${players}`}
						onPress={() =>
							router.push({
								pathname: "/dice/[gameId]",
								params: { gameId: id },
							})
						}
						testID={`dice-game-${id}`}
						style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
					>
						<Felt felt={game.felt} />
						<View style={styles.body}>
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
							{stacked ? null : (
								<View style={styles.showcase}>
									{game.showcase.map((value, index) => (
										<View
											// The showcase is fixed, so its order is its identity.
											// biome-ignore lint/suspicious/noArrayIndexKey: see above
											key={index}
											style={{
												transform: [{ rotate: `${(index - 2) * 9}deg` }],
											}}
										>
											<DieFace value={value} size={SHOWCASE_DIE} />
										</View>
									))}
								</View>
							)}
						</View>
					</Pressable>
				);
			})}
			<View style={styles.join}>
				<AppText variant="secondary">{dice.hub.haveCode}</AppText>
				<Button
					variant="secondary"
					compact
					label={dice.hub.joinWithCode}
					onPress={() => router.push("/join")}
					testID="dice-join"
				/>
			</View>
		</Screen>
	);
}

const styles = StyleSheet.create({
	tile: { borderRadius: radius.lg, overflow: "hidden" },
	pressed: { opacity: opacity.pressed },
	body: { gap: spacing.xs, padding: spacing.lg },
	kicker: { color: cardColors.gold },
	name: { color: cardColors.ivory },
	blurb: { color: cardColors.ivoryMuted },
	showcase: {
		flexDirection: "row",
		gap: spacing.xs,
		alignSelf: "flex-end",
		marginTop: spacing.sm,
	},
	join: {
		flexDirection: "row",
		flexWrap: "wrap",
		alignItems: "center",
		justifyContent: "space-between",
		gap: spacing.sm,
	},
});
