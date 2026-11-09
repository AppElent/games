/**
 * The Play tab: the three games the app carries, then anything this phone can
 * pick back up (saved solo games and online seats).
 */
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { haptics } from "../../../feedback/haptics";
import { fmt, useI18n } from "../../../i18n";
import { relativeTime } from "../../../i18n/relative-time";
import {
	radius,
	spacing,
	type Tokens,
	useAccessibilityTextSize,
	useThemedStyles,
	useTokens,
} from "../../../theme";
import { Button } from "../../../ui/button";
import { Card } from "../../../ui/card";
import { Icon } from "../../../ui/icon";
import { Screen } from "../../../ui/screen";
import { AppText } from "../../../ui/text";
import { useAppUpdate } from "../../../updates/use-app-update";
import { APP_GAMES } from "../app-games";
import { type ContinueItem, listContinueItems } from "./continue-items";
import { type OnlineStatus, useOnlineStatuses } from "./online-status";

const GAMES = Object.values(APP_GAMES);

const CONTINUE_LIMIT = 5;

export function PlayHomeScreen() {
	const router = useRouter();
	const { t, locale } = useI18n();
	const tokens = useTokens();
	const styles = useThemedStyles(createStyles);
	const stacked = useAccessibilityTextSize();
	const [items, setItems] = useState<ContinueItem[]>([]);
	const statuses = useOnlineStatuses(items);
	const update = useAppUpdate();
	const visible = items
		.filter((item) => statuses[item.id] !== null)
		.slice(0, CONTINUE_LIMIT);

	useFocusEffect(
		useCallback(() => {
			setItems(listContinueItems());
		}, []),
	);

	const remove = (item: ContinueItem) => {
		const online = Boolean(item.seat);
		haptics.selectionChanged();
		Alert.alert(
			online ? t.play.removeOnlineTitle : t.play.removeSavedTitle,
			online ? t.play.removeOnlineBody : t.play.removeSavedBody,
			[
				{ text: t.common.actions.cancel, style: "cancel" },
				{
					text: t.play.remove,
					style: "destructive",
					onPress: () => {
						item.remove();
						setItems(listContinueItems());
					},
				},
			],
		);
	};

	const detail = (item: ContinueItem, status: OnlineStatus | undefined) => {
		if (!item.seat) {
			return `${t.play.savedGame} · ${relativeTime(t, locale, item.updatedAt)}`;
		}
		if (!status) return t.play.onlineGame;
		// A lobby is identified by its code, a running game by who is in it.
		if (status.phase === "lobby") {
			return status.joinCode
				? `${t.play.inLobby} · ${fmt(t.play.code, { code: status.joinCode })}`
				: t.play.inLobby;
		}
		return status.others.length > 0
			? `${t.play.inProgress} · ${fmt(t.play.withPlayers, { names: status.others.join(", ") })}`
			: t.play.inProgress;
	};

	return (
		<Screen inTabs>
			{update.ready ? (
				<View style={styles.update} accessibilityLiveRegion="polite">
					<AppText variant="secondary" tone="default" style={styles.text}>
						{t.play.updateReady}
					</AppText>
					<Button
						label={t.play.restart}
						onPress={update.restart}
						variant="secondary"
						compact
						testID="play-update-restart"
					/>
				</View>
			) : null}
			<AppText variant="secondary">{t.play.subtitle}</AppText>
			<View style={styles.list}>
				{GAMES.map((game) => {
					const title = t.catalog[game.id].title;
					const tagline = t.play.taglines[game.id];
					return (
						<Card
							key={game.id}
							onPress={() => router.push(game.href)}
							accessibilityLabel={title}
							accessibilityHint={tagline}
							testID={`play-${game.id}`}
						>
							<View style={[styles.row, stacked && styles.stacked]}>
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
									<AppText
										variant="heading"
										numberOfLines={1}
										adjustsFontSizeToFit
									>
										{title}
									</AppText>
									<AppText variant="secondary">{tagline}</AppText>
								</View>
								{stacked ? null : (
									<Icon
										ios="chevron.right"
										android="chevron_right"
										size={16}
										color={tokens.textFaint}
									/>
								)}
							</View>
						</Card>
					);
				})}
			</View>
			{visible.length > 0 ? (
				<View style={styles.list}>
					<AppText variant="label" accessibilityRole="header">
						{t.play.continue.toUpperCase()}
					</AppText>
					{visible.map((item) => {
						const game = APP_GAMES[item.gameType];
						const title = t.catalog[item.gameType].title;
						const text = detail(item, statuses[item.id] ?? undefined);
						return (
							<Card
								key={item.id}
								onPress={() => router.push(item.href)}
								onLongPress={() => remove(item)}
								accessibilityLabel={`${title}, ${text}`}
								accessibilityActions={[
									{
										name: "remove",
										label: t.play.remove,
										onAction: () => remove(item),
									},
								]}
								testID={`continue-${item.id}`}
							>
								<View style={[styles.row, stacked && styles.stacked]}>
									<View
										style={[
											styles.smallBadge,
											{ backgroundColor: tokens[game.tintDim] },
										]}
									>
										<Icon
											ios={game.icon}
											android={game.androidIcon}
											size={18}
											color={tokens[game.tint]}
										/>
									</View>
									<View style={styles.text}>
										<AppText
											variant="body"
											numberOfLines={1}
											adjustsFontSizeToFit
										>
											{title}
										</AppText>
										<AppText variant="caption">{text}</AppText>
									</View>
									{stacked ? null : (
										<Icon
											ios="chevron.right"
											android="chevron_right"
											size={16}
											color={tokens.textFaint}
										/>
									)}
								</View>
							</Card>
						);
					})}
				</View>
			) : null}
		</Screen>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		update: {
			flexDirection: "row",
			flexWrap: "wrap",
			alignItems: "center",
			gap: spacing.md,
			borderRadius: radius.md,
			paddingHorizontal: spacing.lg,
			paddingVertical: spacing.md,
			backgroundColor: colors.accentDim,
		},
		list: { gap: spacing.md },
		row: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
		stacked: { flexDirection: "column", alignItems: "flex-start" },
		badge: {
			width: 52,
			height: 52,
			borderRadius: radius.md,
			alignItems: "center",
			justifyContent: "center",
		},
		smallBadge: {
			width: 36,
			height: 36,
			borderRadius: radius.sm,
			alignItems: "center",
			justifyContent: "center",
		},
		text: { flexShrink: 1, flexGrow: 1, gap: spacing.xxs },
	});
