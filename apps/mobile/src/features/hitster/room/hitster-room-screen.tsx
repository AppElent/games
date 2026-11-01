/**
 * A Hitster room: lobby, rounds, reveal and results, all from the live
 * bundle. The host also gets the DJ panel; every player sees their own
 * timeline (the team's in co-op).
 */
import { gameErrorMessage } from "@arcadeclub/core/errors";
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
	const copy = t.games.hitster;
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

	const header = <Stack.Screen options={{ title: copy.session.roomTitle }} />;

	if (room.loading) {
		return (
			<>
				{header}
				<CenteredState loading message={t.common.errors.loading} />
			</>
		);
	}
	if (!room.bundle) {
		return (
			<>
				{header}
				<CenteredState title={t.common.session.unavailable} />
			</>
		);
	}
	if (!room.participantId) {
		return (
			<>
				{header}
				<CenteredState title={t.common.session.notSeated} />
			</>
		);
	}

	const bundle = room.bundle;
	const view = roomView(bundle, room.participantId);
	if (!view.state) {
		return (
			<>
				{header}
				<Screen>
					<LobbyPanel
						bundle={bundle}
						config={null}
						modeLabel={null}
						isHost={view.isHost}
						busy={room.busy}
						onStart={() => void room.start()}
					/>
				</Screen>
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
		copy.bits.participantFallbackPlayer,
	);
	const myCards = view.myTimeline
		? timelineCards(live, view.myTimeline.cardIds)
		: [];

	const status =
		live.phase === "lobby"
			? modeLabel
			: live.phase === "nowPlaying"
				? fmt(copy.stage.statusNowPlaying, {
						round: live.roundNumber,
						name: activeName,
					})
				: live.phase === "reveal"
					? fmt(copy.stage.statusRevealed, { round: live.roundNumber })
					: copy.stage.statusGameOver;

	const tokenLine = config.shared
		? plural(locale, live.coopTokens ?? 0, copy.bits.tokens.teamCount)
		: config.tokenCap > 0 && view.isPlaying
			? plural(locale, view.myTokens, copy.bits.tokens.count)
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
								? fmt(copy.stage.remainingSeconds, { count: remaining })
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
									{copy.stage.yourTurnHeading}
								</AppText>
								{live.pendingGuess ? (
									<>
										<AppText variant="body" style={{ color: tokens.green }}>
											{copy.stage.placementLocked}
										</AppText>
										<AppText variant="secondary">
											{copy.stage.waitingForHostReveal}
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
											? copy.stage.activePlacingSongLocked
											: copy.stage.activePlacingSongListen,
										{ name: activeName },
									)}
								</AppText>
								{config.stealsEnabled && view.isPlaying ? (
									view.hasClaimed ? (
										<AppText variant="secondary">
											{copy.stage.stealClaimLocked}
										</AppText>
									) : view.myTokens < 1 ? (
										<AppText variant="caption">
											{copy.stage.noTokensToSteal}
										</AppText>
									) : stealOpen ? (
										<>
											<AppText variant="heading">
												{copy.stage.stealFormHeading}
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
												label={t.common.actions.cancel}
												onPress={() => setStealOpen(false)}
											/>
										</>
									) : (
										<Button
											variant="secondary"
											label={copy.stage.stealButton}
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

				<Notice
					message={
						room.error
							? gameErrorMessage(
									t,
									room.error,
									t.common.errors.somethingWentWrong,
								)
							: null
					}
				/>

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
									? copy.stage.teamTimelineHeading
									: copy.stage.yourTimelineHeading,
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
