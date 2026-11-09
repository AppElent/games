/**
 * An online match: the board from this player's side, whose turn it is,
 * and the invite while the second seat is empty. Every action goes to
 * Convex; the board redraws from the live bundle.
 */

import {
	type BackgammonColor,
	type BackgammonMovePlan,
	getBackgammonWinner,
} from "@arcadeclub/core/backgammon";
import {
	DEFAULT_ONLINE_OPTIONS,
	type OnlineOptions,
} from "@arcadeclub/core/backgammon-local";
import { gameErrorMessage } from "@arcadeclub/core/errors";
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { haptics } from "../../../feedback/haptics";
import { fmt, useI18n } from "../../../i18n";
import { radius, spacing, useThemedStyles } from "../../../theme";
import { Button } from "../../../ui/button";
import { Card } from "../../../ui/card";
import { CenteredState } from "../../../ui/centered-state";
import { Notice } from "../../../ui/notice";
import { QrCode } from "../../../ui/qr-code";
import { AppText } from "../../../ui/text";
import { shareInvite } from "../../sessions/host/share-invite";
import { hasWebOrigin, webJoinUrl } from "../../sessions/session-links";
import { BackgammonBoard } from "../board/backgammon-board";
import { useBoardSelection } from "../board/use-board-selection";
import { BoardScreen } from "../components/board-screen";
import { colorLabel } from "../components/color-label";
import { MatchPanel } from "../components/match-panel";
import { OptionsPanel } from "../components/options-panel";
import { TURN_HINT_MESSAGE, turnHint } from "../components/turn-hint";
import {
	type LiveMatch,
	type OnlineMatch,
	useOnlineMatch,
} from "./use-online-match";

const OPTION_KEYS = ["showNumbers", "autoSwitchTurn", "autoCombine"] as const;

export function OnlineMatchScreen({ sessionId }: { sessionId: string }) {
	const { t } = useI18n();
	const match = useOnlineMatch(sessionId);
	const title = (
		<Stack.Screen
			options={{ title: t.games.backgammon.waitingRoom.onlineTitle }}
		/>
	);

	if (match.loading) {
		return (
			<>
				{title}
				<CenteredState loading message={t.common.errors.loading} />
			</>
		);
	}
	if (!match.live) {
		return (
			<>
				{title}
				<CenteredState title={t.common.session.unavailable} />
			</>
		);
	}
	return <OnlineMatchLoaded match={match} live={match.live} />;
}

function OnlineMatchLoaded({
	match,
	live,
}: {
	match: OnlineMatch;
	live: LiveMatch;
}) {
	const { t } = useI18n();
	const copy = t.games.backgammon;
	const styles = useThemedStyles(createStyles);
	const [options, setOptions] = useState<OnlineOptions>(DEFAULT_ONLINE_OPTIONS);
	const { turn, state } = live;
	const { session } = live.bundle;
	const winner = getBackgammonWinner(turn.off);

	const onPlan = (plan: BackgammonMovePlan) => {
		haptics.moveMade();
		void match.play(plan, { autoSwitchTurn: options.autoSwitchTurn });
	};
	const selection = useBoardSelection({
		state: turn,
		interactive: match.isMyTurn && !match.busy,
		autoCombine: options.autoCombine,
		onPlan,
	});

	const won = Boolean(winner && winner === match.myColor);
	useEffect(() => {
		if (won) haptics.gameWon();
	}, [won]);

	const viewer: BackgammonColor = match.myColor ?? "white";
	const opponentId =
		viewer === "white" ? state.blackParticipantId : state.whiteParticipantId;
	const opponentSeatName = match.nameOf(opponentId);
	const opponentName =
		opponentSeatName ??
		colorLabel(copy, viewer === "white" ? "black" : "white");
	const activeName =
		match.nameOf(
			turn.activeColor === "white"
				? state.whiteParticipantId
				: state.blackParticipantId,
		) ?? colorLabel(copy, turn.activeColor);
	const waiting = state.phase === "waiting";

	const hint = match.isMyTurn ? turnHint(turn, selection.selected) : null;
	const invite =
		session.shareToken && hasWebOrigin() ? { token: session.shareToken } : null;
	const inviteUrl = invite && webJoinUrl(invite);

	return (
		<BoardScreen
			title={copy.waitingRoom.onlineTitle}
			board={(width) => (
				<BackgammonBoard
					state={turn}
					viewer={viewer}
					width={width}
					showNumbers={options.showNumbers}
					selected={selection.selected}
					highlights={selection.highlights}
					onPointPress={selection.tapPoint}
					onOffPress={selection.tapOff}
					testID="bg-board"
				/>
			)}
		>
			{waiting ? (
				<Card>
					<View style={styles.section}>
						<AppText variant="heading" accessibilityRole="header">
							{copy.waitingRoom.waitingHeading}
						</AppText>
						<AppText variant="secondary">
							{copy.waitingRoom.shareToClaimBlackSeat}
						</AppText>
						{invite && inviteUrl ? (
							<>
								<View style={styles.qr}>
									<QrCode
										value={inviteUrl}
										size={160}
										accessibilityLabel={t.common.joinPanel.scanQrLabel}
									/>
								</View>
								<Button
									label={copy.waitingRoom.sendInvite}
									onPress={() =>
										void shareInvite(t, t.catalog.backgammon.title, invite)
									}
									testID="bg-share-invite"
								/>
							</>
						) : (
							<Notice tone="info" message={copy.waitingRoom.noInviteLink} />
						)}
					</View>
				</Card>
			) : (
				<MatchPanel
					turn={turn}
					winner={
						winner && {
							color: winner,
							name: match.myColor ? opponentName : colorLabel(copy, winner),
							isYou: won,
						}
					}
					heading={
						match.isMyTurn
							? t.common.session.yourTurn
							: fmt(copy.waitingRoom.waitingForPlayerToPlay, {
									name: activeName,
								})
					}
					message={
						hint
							? copy.board[TURN_HINT_MESSAGE[hint]]
							: match.myColor
								? null
								: copy.waitingRoom.bothSeatsClaimed
					}
					canAct={match.isMyTurn}
					busy={match.busy}
					onRoll={() => void match.roll()}
					onEndTurn={() => void match.endTurn()}
					finishedAction={
						match.myColor ? (
							<Button
								label={copy.waitingRoom.rematchLabel}
								onPress={() => void match.rematch()}
								busy={match.busy}
								testID="bg-rematch"
							/>
						) : null
					}
				/>
			)}
			<Notice
				message={
					match.error
						? gameErrorMessage(
								t,
								match.error,
								t.common.errors.somethingWentWrong,
							)
						: null
				}
			/>
			{match.myColor ? (
				<AppText variant="caption" style={styles.inset}>
					{opponentSeatName
						? fmt(copy.waitingRoom.youArePlayingAgainst, {
								color: colorLabel(copy, match.myColor),
								name: opponentSeatName,
							})
						: fmt(copy.waitingRoom.youArePlaying, {
								color: colorLabel(copy, match.myColor),
							})}
				</AppText>
			) : null}
			<OptionsPanel
				options={options}
				keys={OPTION_KEYS}
				onChange={(key, value) =>
					setOptions((current) => ({ ...current, [key]: value }))
				}
			/>
		</BoardScreen>
	);
}

const createStyles = () =>
	StyleSheet.create({
		section: { gap: spacing.md },
		qr: { alignSelf: "center", borderRadius: radius.sm, overflow: "hidden" },
		/** Lines up with the text inside the cards above and below. */
		inset: { paddingHorizontal: spacing.lg },
	});
