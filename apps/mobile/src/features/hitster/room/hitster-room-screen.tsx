/**
 * A Hitster room: lobby, rounds, reveal and results, all from the live
 * bundle. The host also gets the DJ panel; every player sees their own
 * timeline (the team's in co-op).
 */
import { gameErrorMessage } from "@arcadeclub/core/errors";
import { hitsterAsksArtistTitle } from "@arcadeclub/core/hitster";
import { useKeepAwake } from "expo-keep-awake";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { haptics } from "../../../feedback/haptics";
import { fmt, plural, useI18n } from "../../../i18n";
import { spacing, useTokens } from "../../../theme";
import { Button } from "../../../ui/button";
import { Card } from "../../../ui/card";
import { Notice } from "../../../ui/notice";
import { Screen } from "../../../ui/screen";
import { AppText } from "../../../ui/text";
import { useResetOnChange } from "../../../ui/use-reset-on-change";
import { OnlineScreenFrame } from "../../sessions/components/online-screen-frame";
import { DjPanel } from "./dj-panel";
import { LobbyPanel } from "./lobby-panel";
import { LobbyRoster } from "./lobby-roster";
import { PlacementForm } from "./placement-form";
import { RecapPanel } from "./recap-panel";
import {
	type HitsterBundle,
	type LiveRoomView,
	participantName,
	roomView,
	showsOwnTimeline,
	timelineCards,
} from "./room-view";
import { Scoreboard } from "./scoreboard";
import { TimelineList } from "./timeline-list";
import { useCountdown } from "./use-countdown";
import { type HitsterRoom, useHitsterRoom } from "./use-hitster-room";

export function HitsterRoomScreen({ sessionId }: { sessionId: string }) {
	useKeepAwake();
	const { t } = useI18n();
	const room = useHitsterRoom(sessionId);
	const title = t.games.hitster.session.roomTitle;

	if (!room.bundle || !room.participantId) {
		return (
			<OnlineScreenFrame
				title={title}
				loading={room.loading}
				blocked={
					room.bundle
						? t.common.session.notSeated
						: t.common.session.unavailable
				}
			/>
		);
	}

	const bundle = room.bundle;
	const view = roomView(bundle, room.participantId);
	return (
		<OnlineScreenFrame title={title}>
			{view.state ? (
				<HitsterRoomLoaded room={room} bundle={bundle} view={view} />
			) : (
				// The host has not picked a mode yet (rooms made by older builds).
				<Screen>
					<LobbyRoster bundle={bundle} />
					<AppText variant="secondary">
						{t.games.hitster.stage.statusWaitingForHost}
					</AppText>
				</Screen>
			)}
		</OnlineScreenFrame>
	);
}

function HitsterRoomLoaded({
	room,
	bundle,
	view,
}: {
	room: HitsterRoom;
	bundle: HitsterBundle;
	view: LiveRoomView;
}) {
	const { t, locale } = useI18n();
	const copy = t.games.hitster;
	const tokens = useTokens();
	const [stealOpen, setStealOpen] = useState(false);
	const { config, state: live } = view;
	const remaining = useCountdown(
		live.turnTimerSeconds,
		live.roundStartedAt,
		live.phase === "nowPlaying",
	);

	useResetOnChange(live.roundNumber, () => setStealOpen(false));

	const phase = live.phase;
	useEffect(() => {
		if (phase === "reveal" || phase === "finished") haptics.answerRevealed();
	}, [phase]);

	const modeLabel = copy.modes[live.mode].label;
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
					target={live.targetCards}
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
									askArtistTitle={hitsterAsksArtistTitle(config, false)}
									submitLabel={copy.stage.lockPlacement}
									submitTestID="hitster-lock"
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
											askArtistTitle={hitsterAsksArtistTitle(config, true)}
											submitLabel={copy.stage.stealSubmit}
											submitTestID="hitster-lock-steal"
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
					<Scoreboard bundle={bundle} state={live} />
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

			{showsOwnTimeline(view, stealOpen) ? (
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
	);
}

const styles = StyleSheet.create({
	status: { gap: spacing.xxs },
	section: { gap: spacing.md },
});
