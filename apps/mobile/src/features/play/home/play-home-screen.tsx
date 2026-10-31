/**
 * The Play tab: the three games the app carries, then anything this phone can
 * pick back up (saved solo games and online seats).
 */
import { type Href, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useI18n } from "../../../i18n";
import { relativeTime } from "../../../i18n/relative-time";
import {
	radius,
	spacing,
	type Tokens,
	useThemedStyles,
	useTokens,
} from "../../../theme";
import { Card } from "../../../ui/card";
import { Icon } from "../../../ui/icon";
import { Screen } from "../../../ui/screen";
import { AppText } from "../../../ui/text";
import { type ContinueItem, listContinueItems } from "./continue-items";

type GameEntry = {
	key: "sudoku" | "backgammon" | "hitster";
	href: Href;
	icon: Parameters<typeof Icon>[0]["ios"];
	androidIcon: Parameters<typeof Icon>[0]["android"];
	tint: keyof Tokens;
	tintDim: keyof Tokens;
};

const GAMES: readonly GameEntry[] = [
	{
		key: "sudoku",
		href: "/sudoku",
		icon: "square.grid.3x3.fill",
		androidIcon: "grid_on",
		tint: "accent",
		tintDim: "accentDim",
	},
	{
		key: "backgammon",
		href: "/backgammon",
		icon: "dice.fill",
		androidIcon: "casino",
		tint: "orange",
		tintDim: "orangeDim",
	},
	{
		key: "hitster",
		href: "/hitster",
		icon: "music.note.list",
		androidIcon: "queue_music",
		tint: "pink",
		tintDim: "pinkDim",
	},
];

export function PlayHomeScreen() {
	const router = useRouter();
	const { t, locale } = useI18n();
	const tokens = useTokens();
	const styles = useThemedStyles(createStyles);
	const [items, setItems] = useState<ContinueItem[]>([]);

	useFocusEffect(
		useCallback(() => {
			setItems(listContinueItems());
		}, []),
	);

	return (
		<Screen inTabs>
			<AppText variant="secondary">{t.play.subtitle}</AppText>
			<View style={styles.list}>
				{GAMES.map((game) => {
					const title = t.catalog[game.key].title;
					const tagline = t.play.taglines[game.key];
					return (
						<Card
							key={game.key}
							onPress={() => router.push(game.href)}
							accessibilityLabel={title}
							accessibilityHint={tagline}
							testID={`play-${game.key}`}
						>
							<View style={styles.row}>
								<View
									style={[
										styles.badge,
										{ backgroundColor: tokens[game.tintDim] },
									]}
								>
									<Icon
										ios={game.icon}
										android={game.androidIcon}
										size={26}
										color={tokens[game.tint]}
									/>
								</View>
								<View style={styles.text}>
									<AppText variant="heading">{title}</AppText>
									<AppText variant="secondary">{tagline}</AppText>
								</View>
								<Icon
									ios="chevron.right"
									android="chevron_right"
									size={16}
									color={tokens.textFaint}
								/>
							</View>
						</Card>
					);
				})}
			</View>
			{items.length > 0 ? (
				<View style={styles.list}>
					<AppText variant="label" accessibilityRole="header">
						{t.play.continue.toUpperCase()}
					</AppText>
					{items.map((item) => {
						const detail = `${item.kind === "online" ? t.play.onlineGame : t.play.savedGame} · ${relativeTime(t, locale, item.updatedAt)}`;
						return (
							<Card
								key={item.id}
								onPress={() => router.push(item.href)}
								accessibilityLabel={`${t.catalog[item.gameType].title}, ${detail}`}
							>
								<AppText variant="body">
									{t.catalog[item.gameType].title}
								</AppText>
								<AppText variant="caption">{detail}</AppText>
							</Card>
						);
					})}
				</View>
			) : null}
		</Screen>
	);
}

const createStyles = (_colors: Tokens) =>
	StyleSheet.create({
		list: { gap: spacing.md },
		row: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
		badge: {
			width: 52,
			height: 52,
			borderRadius: radius.md,
			alignItems: "center",
			justifyContent: "center",
		},
		text: { flex: 1, gap: spacing.xxs },
	});
