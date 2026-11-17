/**
 * A Beat the Clock room on the phone: one screen for everyone that follows
 * the room's phase and this seat's role. The header's Menu opens the room
 * menu; the host's pause shows on every phone.
 */
import {
	CLOCK_SCORE_DELAY_MS,
	secondsLeft,
} from "@arcadeclub/core/beat-the-clock";
import { clockTime, clockView } from "@arcadeclub/core/beat-the-clock-view";
import { gameErrorMessage } from "@arcadeclub/core/errors";
import { useKeepAwake } from "expo-keep-awake";
import { Stack } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { fmt, useI18n } from "../../../i18n";
import { radius, spacing, type Tokens, useThemedStyles } from "../../../theme";
import { Button, HeaderButton } from "../../../ui/button";
import { Card } from "../../../ui/card";
import { Notice } from "../../../ui/notice";
import { Screen } from "../../../ui/screen";
import { AppText } from "../../../ui/text";
import { OnlineScreenFrame } from "../../sessions/components/online-screen-frame";
import { type ClockScreenProps, useClockCopy, useNow } from "./clock-bits";
import { ClockCheck } from "./clock-check";
import { ClockLate, ClockLobby } from "./clock-lobby";
import { ClockMenu } from "./clock-menu";
import { ClockScore, ClockTie, ClockWinner } from "./clock-result";
import { ClockTurn } from "./clock-turn";
import { clockMeta } from "./room-text";
import {
	type ClockBundle,
	type ClockRoom,
	useClockRoom,
} from "./use-clock-room";

export function ClockRoomScreen({ sessionId }: { sessionId: string }) {
	useKeepAwake();
	const { t } = useI18n();
	const room = useClockRoom(sessionId);
	const copy = t.games.beatTheClock;
	if (!room.bundle) {
		return (
			<OnlineScreenFrame
				title={copy.title}
				loading={room.loading}
				loadingMessage={copy.session.loading}
				blocked={copy.session.notFound}
			/>
		);
	}
	return (
		<OnlineScreenFrame title={copy.title}>
			<ClockRoomLoaded room={room} bundle={room.bundle} />
		</OnlineScreenFrame>
	);
}

function ClockRoomLoaded({
	room,
	bundle,
}: {
	room: ClockRoom;
	bundle: ClockBundle;
}) {
	const s = useThemedStyles(createStyles);
	const { t, copy, teams } = useClockCopy();
	const { state, session } = bundle;
	const timed =
		state.phase === "describing" ||
		state.phase === "timeUp" ||
		state.phase === "checking" ||
		state.phase === "score" ||
		state.notice !== undefined;
	const now = useNow(250, timed && !state.paused);
	const [seenCheck, setSeenCheck] = useState<number | null>(null);
	const [menuOpen, setMenuOpen] = useState(false);
	const view = clockView(
		state,
		bundle.participants,
		bundle.viewerId,
		session.hostParticipantId,
		seenCheck === state.turnNumber ? now + CLOCK_SCORE_DELAY_MS : now,
	);
	const props: ClockScreenProps = {
		bundle,
		view,
		room,
		now,
		onSeeScores: () => setSeenCheck(state.turnNumber),
	};
	const hostName = view.name(session.hostParticipantId);
	const running = state.phase === "describing" || state.phase === "timeUp";

	return (
		<>
			<Stack.Screen
				options={{
					headerRight: () => (
						<HeaderButton
							label={copy.menu.title}
							onPress={() => setMenuOpen(true)}
							testID="clock-menu"
						/>
					),
				}}
			/>
			<Screen>
				<AppText variant="caption">
					{[
						clockMeta(state, view.screen, copy),
						session.joinCode
							? fmt(copy.roomCode, { code: session.joinCode })
							: null,
					]
						.filter(Boolean)
						.join(" · ")}
				</AppText>
				{view.noticeActive && state.notice && state.phase === "ready" ? (
					<AppText
						variant="secondary"
						tone="default"
						style={s.note}
						accessibilityLiveRegion="polite"
					>
						{state.notice.kind === "skipped"
							? fmt(copy.turn.skipped, {
									host: hostName,
									team: teams.team(state.turn?.team ?? 0),
								})
							: fmt(copy.turn.skippedShort, {
									team: teams.team(state.notice.team),
								})}
					</AppText>
				) : null}
				{state.paused ? (
					<Card>
						<View style={s.gap} accessibilityLiveRegion="polite">
							<AppText variant="title">{copy.paused.title}</AppText>
							<AppText variant="secondary">
								{running
									? fmt(copy.paused.body, {
											host: hostName,
											time: clockTime(secondsLeft(state, now)),
										})
									: fmt(copy.paused.bodyNoClock, { host: hostName })}
							</AppText>
							{view.isHost ? (
								<Button
									label={copy.menu.resume}
									busy={room.pending === "resume"}
									onPress={() => void room.resume()}
									testID="clock-resume"
								/>
							) : null}
						</View>
					</Card>
				) : null}
				<View
					style={[s.gapLg, state.paused && s.dimmed]}
					pointerEvents={state.paused ? "none" : "auto"}
				>
					<ClockScreen {...props} />
				</View>
				<Notice
					message={
						room.error
							? gameErrorMessage(t, room.error, copy.session.actionError)
							: null
					}
				/>
			</Screen>
			<ClockMenu
				{...props}
				open={menuOpen}
				onClose={() => setMenuOpen(false)}
			/>
		</>
	);
}

function ClockScreen(props: ClockScreenProps) {
	switch (props.view.screen) {
		case "lobby":
			return <ClockLobby {...props} />;
		case "late":
			return <ClockLate {...props} />;
		case "turn":
			return <ClockTurn {...props} />;
		case "check":
			return <ClockCheck {...props} />;
		case "score":
			return <ClockScore {...props} />;
		case "tie":
			return <ClockTie {...props} />;
		case "finished":
			return <ClockWinner {...props} />;
	}
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		gap: { gap: spacing.md },
		gapLg: { gap: spacing.lg },
		dimmed: { opacity: 0.35 },
		note: {
			borderRadius: radius.md,
			backgroundColor: colors.surface2,
			padding: spacing.md,
		},
	});
