/**
 * A Hitster room: lobby, rounds, reveal and results, all from the live
 * bundle. The host also gets the DJ panel; every player sees their own
 * timeline (the team's in co-op).
 */
import { useKeepAwake } from "expo-keep-awake";
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { haptics } from "../../../feedback/haptics";
import { fmt, plural, useI18n } from "../../../i18n";
import { spacing, useTokens } from "../../../theme";
import { Button } from "../../../ui/button";
import { Card } from "../../../ui/card";
import { CenteredState } from "../../../ui/centered-state";
import { Notice } from "../../../ui/notice";
import { Screen } from "../../../ui/screen";
import { AppText } from "../../../ui/text";
import { DjPanel } from "./dj-panel";
import { LobbyPanel } from "./lobby-panel";
import { PlacementForm } from "./placement-form";
import { RecapPanel } from "./recap-panel";
import { participantName, roomView, timelineCards } from "./room-view";
import { Scoreboard } from "./scoreboard";
import { TimelineList } from "./timeline-list";
import { useCountdown } from "./use-countdown";
import { useHitsterRoom } from "./use-hitster-room";

export function HitsterRoomScreen({ sessionId }: { sessionId: string }) {
	useKeepAwake();
	const { t, locale } = useI18n();
	const copy = t.hitster;
	const tokens = useTokens();
	const room = useHitsterRoom(sessionId);
	const [stealOpen, setStealOpen] = useState(false);
	const state = room.bundle?.state ?? null;
	const remaining = useCountdown(
		state?.turnTimerSeconds,
		state?.roundStartedAt,
		state?.phase === "nowPlaying",
	);

	const round = state?.roundNumber;
	useEffect(() => {
		void round;
		setStealOpen(false);
	}, [round]);

	const phase = state?.phase;
	useEffect(() => {
		if (phase === "reveal" || phase === "finished") haptics.gameWon();
	}, [phase]);

	const header = <Stack.Screen options={{ title: copy.room.title }} />;

	if (room.loading) {
		return (
			<>
				{header}
				<CenteredState loading message={t.common.states.loading} />
			</>
		);
	}
	if (!room.bundle) {
		return (
			<>
				{header}
				<CenteredState title={t.common.session.notFound} />
			</>
		);
	}
	if (!room.participantId) {
		return (
			<>
				{header}
				<CenteredState title={copy.room.notSeated} />
			</>
		);
	}

	const bundle = room.bundle;
	const view = roomView(bundle, room.participantId);
	if (!view.state) {
		return (
			<>
				{header}
				<CenteredState loading message={copy.room.waitingForHost} />
			</>
		);
	}
	const { config } = view;
	const live = view.state;
	const modeLabel =
		copy.modes[live.mode as keyof typeof copy.modes]?.label ?? live.mode;
	const activeName = participantName(
		bundle,
		view.activeParticipantId,
		copy.fallback.player,
	);
	const myCards = view.myTimeline
		? timelineCards(live, view.myTimeline.cardIds)
		: [];

	const status =
		live.phase === "lobby"
			? modeLabel
			: live.phase === "nowPlaying"
				? `${fmt(copy.room.round, { round: live.roundNumber })} · ${fmt(copy.room.turnOf, { name: activeName })}`
				: live.phase === "reveal"
					? fmt(copy.room.revealed, { round: live.roundNumber })
					: copy.room.gameOver;

	const tokenLine = config.shared
		? plural(locale, live.coopTokens ?? 0, copy.room.teamTokens)
		: config.tokenCap > 0 && view.isPlaying
			? plural(locale, view.myTokens, copy.room.tokens)
			: null;

	return (
		<>
			{header}
			<Screen>
				<View style={styles.status} accessibilityLiveRegion="polite">
					<AppText variant="heading" testID="hitster-status">
						{status}
					</AppText>
					<AppText variant="caption">
						{[
							remaining !== null
								? fmt(copy.room.remaining, { count: remaining })
								: null,
							tokenLine,
						]
							.filter(Boolean)
							.join(" · ")}
					</AppText>
				</View>

				{live.phase === "lobby" ? (
					<LobbyPanel
						bundle={bundle}
						config={config}
						modeLabel={modeLabel}
						isHost={view.isHost}
						busy={room.busy}
						onStart={() => void room.start()}
					/>
				) : null}

				{view.isHost ? (
					<DjPanel
						bundle={bundle}
						state={live}
						busy={room.busy}
						onReveal={() => void room.reveal()}
						onNextRound={() => void room.nextRound()}
					/>
				) : null}

				{live.phase === "nowPlaying" ? (
					<Card>
						{view.isActive ? (
							<View style={styles.section}>
								<AppText variant="heading" accessibilityRole="header">
									{copy.stage.yourTurn}
								</AppText>
								{live.pendingGuess ? (
									<>
										<AppText variant="body" style={{ color: tokens.green }}>
											{copy.stage.placementLocked}
										</AppText>
										<AppText variant="secondary">
											{copy.stage.waitingForReveal}
										</AppText>
									</>
								) : (
									<PlacementForm
										cards={myCards}
										config={config}
										forSteal={false}
										busy={room.busy}
										onSubmit={(answer) => {
											haptics.moveMade();
											void room.guess(answer);
										}}
									/>
								)}
							</View>
						) : (
							<View style={styles.section}>
								<AppText variant="secondary" tone="default">
									{fmt(
										live.pendingGuess
											? copy.stage.listeningLocked
											: copy.stage.listening,
										{ name: activeName },
									)}
								</AppText>
								{config.stealsEnabled && view.isPlaying ? (
									view.hasClaimed ? (
										<AppText variant="secondary">
											{copy.stage.stealLocked}
										</AppText>
									) : view.myTokens < 1 ? (
										<AppText variant="caption">{copy.stage.noTokens}</AppText>
									) : stealOpen ? (
										<>
											<AppText variant="heading">
												{copy.stage.stealHeading}
											</AppText>
											<PlacementForm
												cards={myCards}
												config={config}
												forSteal
												busy={room.busy}
												onSubmit={(answer) => {
													haptics.moveMade();
													void room.steal(answer);
												}}
											/>
											<Button
												variant="plain"
												label={copy.stage.cancelSteal}
												onPress={() => setStealOpen(false)}
											/>
										</>
									) : (
										<Button
											variant="secondary"
											label={copy.stage.steal}
											onPress={() => setStealOpen(true)}
											testID="hitster-steal"
										/>
									)
								) : null}
							</View>
						)}
					</Card>
				) : null}

				{live.phase === "reveal" || live.phase === "finished" ? (
					<Card>
						<View style={styles.section}>
							{live.coopResult ? (
								<AppText variant="title">
									{live.coopResult === "won"
										? copy.stage.coopWon
										: copy.stage.coopLost}
								</AppText>
							) : null}
							<RecapPanel bundle={bundle} state={live} />
							{live.phase === "reveal" && !view.isHost ? (
								<AppText variant="caption">
									{copy.stage.waitingForNextRound}
								</AppText>
							) : null}
						</View>
					</Card>
				) : null}

				{live.phase === "finished" || live.phase === "reveal" ? (
					<Card>
						<Scoreboard bundle={bundle} state={live} shared={config.shared} />
					</Card>
				) : null}

				<Notice message={room.failed ? copy.room.actionFailed : null} />

				{live.phase !== "lobby" &&
				view.myTimeline &&
				!(view.isActive && live.phase === "nowPlaying" && !live.pendingGuess) &&
				!(stealOpen && !view.hasClaimed) ? (
					<View style={styles.section}>
						<AppText variant="label" accessibilityRole="header">
							{plural(
								locale,
								myCards.length,
								config.shared
									? copy.stage.teamTimeline
									: copy.stage.yourTimeline,
							).toUpperCase()}
						</AppText>
						<TimelineList cards={myCards} testID="hitster-timeline" />
					</View>
				) : null}
			</Screen>
		</>
	);
}

const styles = StyleSheet.create({
	status: { gap: spacing.xxs },
	section: { gap: spacing.md },
});
