/**
 * An online match: the board from this player's side, whose turn it is,
 * and the invite while the second seat is empty. Every action goes to
 * Convex; the board redraws from the live bundle.
 */
import {
	type BackgammonColor,
	type BackgammonMovePlan,
	createInitialBackgammonState,
	getBackgammonWinner,
} from "@games/core/backgammon";
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { haptics } from "../../../feedback/haptics";
import { fmt, useI18n } from "../../../i18n";
import { metrics, spacing, type Tokens, useThemedStyles } from "../../../theme";
import { Button } from "../../../ui/button";
import { Card } from "../../../ui/card";
import { CenteredState } from "../../../ui/centered-state";
import { Notice } from "../../../ui/notice";
import { AppText } from "../../../ui/text";
import { shareInvite } from "../../sessions/host/share-invite";
import { hasWebOrigin } from "../../sessions/session-links";
import { BackgammonBoard } from "../board/backgammon-board";
import { useBoardSelection } from "../board/use-board-selection";
import { OptionsPanel } from "../components/options-panel";
import { turnHint } from "../components/turn-hint";
import { TurnPanel } from "../components/turn-panel";
import { useBoardWidth } from "../components/use-board-width";
import {
	type BackgammonOptions,
	DEFAULT_BACKGAMMON_OPTIONS,
} from "../local/local-match";
import { useOnlineMatch } from "./use-online-match";

const OPTION_KEYS = ["showNumbers", "autoSwitchTurn", "autoCombine"] as const;
const NO_HIGHLIGHTS = { points: new Set<number>(), off: false };
/** Stands in for the turn while the bundle loads; never interactive. */
const PLACEHOLDER_TURN = createInitialBackgammonState();

export function OnlineMatchScreen({ sessionId }: { sessionId: string }) {
	const { t } = useI18n();
	const copy = t.backgammon;
	const styles = useThemedStyles(createStyles);
	const insets = useSafeAreaInsets();
	const [options, setOptions] = useState<BackgammonOptions>(
		DEFAULT_BACKGAMMON_OPTIONS,
	);
	const match = useOnlineMatch(sessionId, options.autoSwitchTurn);
	const { width, wide } = useBoardWidth(320);
	const turn = match.turn;
	const winner = turn ? getBackgammonWinner(turn.off) : null;

	const onPlan = (plan: BackgammonMovePlan) => {
		haptics.moveMade();
		void match.play(plan);
	};
	const selection = useBoardSelection({
		state: turn ?? PLACEHOLDER_TURN,
		interactive: match.isMyTurn && !match.busy,
		autoCombine: options.autoCombine,
		onPlan,
	});

	const won = Boolean(winner && winner === match.myColor);
	useEffect(() => {
		if (won) haptics.gameWon();
	}, [won]);

	const title = <Stack.Screen options={{ title: copy.online.title }} />;

	if (match.loading) {
		return (
			<>
				{title}
				<CenteredState loading message={t.common.states.loading} />
			</>
		);
	}
	if (!match.bundle || !turn || !match.bundle.state) {
		return (
			<>
				{title}
				<CenteredState title={t.common.session.notFound} />
			</>
		);
	}

	const { session, state } = match.bundle;
	const viewer: BackgammonColor = match.myColor ?? "white";
	const opponentId =
		viewer === "white" ? state.blackParticipantId : state.whiteParticipantId;
	const opponentName =
		match.nameOf(opponentId) ??
		copy.colors[viewer === "white" ? "black" : "white"];
	const activeName =
		match.nameOf(
			turn.activeColor === "white"
				? state.whiteParticipantId
				: state.blackParticipantId,
		) ?? copy.colors[turn.activeColor];
	const waiting = match.phase === "waiting";

	const heading = winner
		? match.myColor
			? won
				? copy.online.youWon
				: fmt(copy.online.youLost, { name: opponentName })
			: fmt(copy.game.winner, { color: copy.colors[winner] })
		: match.isMyTurn
			? copy.online.yourTurn
			: fmt(copy.online.theirTurn, { name: activeName });

	const hint = match.isMyTurn ? turnHint(turn, selection.selected) : null;
	const canInvite = Boolean(session.shareToken) && hasWebOrigin();

	return (
		<>
			{title}
			<ScrollView
				style={styles.root}
				contentInsetAdjustmentBehavior="automatic"
				contentContainerStyle={[
					styles.content,
					wide && styles.wideContent,
					{ paddingBottom: insets.bottom + spacing.lg },
				]}
			>
				<BackgammonBoard
					state={turn}
					viewer={viewer}
					width={width}
					showNumbers={options.showNumbers}
					selected={selection.selected}
					highlights={match.isMyTurn ? selection.highlights : NO_HIGHLIGHTS}
					onPointPress={selection.tapPoint}
					onOffPress={selection.tapOff}
					testID="bg-board"
				/>
				<View style={[styles.side, { width: wide ? 340 : width }]}>
					{waiting ? (
						<Card>
							<View style={styles.section}>
								<AppText variant="heading" accessibilityRole="header">
									{copy.online.waitingHeading}
								</AppText>
								<AppText variant="secondary">{copy.online.waitingBody}</AppText>
								{canInvite ? (
									<Button
										label={copy.online.shareInvite}
										onPress={() =>
											void shareInvite(t, copy.title, {
												token: session.shareToken,
											})
										}
										testID="bg-share-invite"
									/>
								) : (
									<Notice tone="info" message={copy.online.noInviteLink} />
								)}
							</View>
						</Card>
					) : (
						<TurnPanel
							color={winner ?? turn.activeColor}
							heading={heading}
							message={
								hint
									? copy.game[hint]
									: match.myColor
										? null
										: copy.online.spectating
							}
							dice={turn.dice}
							used={turn.used}
						>
							{winner && match.myColor ? (
								<Button
									label={copy.online.rematch}
									onPress={() => void match.rematch()}
									busy={match.busy}
									testID="bg-rematch"
								/>
							) : null}
							{!winner && match.isMyTurn && turn.dice.length === 0 ? (
								<Button
									label={copy.game.roll}
									onPress={() => {
										haptics.valueEntered();
										void match.roll();
									}}
									busy={match.busy}
									testID="bg-roll"
								/>
							) : null}
							{!winner && match.isMyTurn && turn.dice.length > 0 ? (
								<Button
									label={copy.game.endTurn}
									variant={
										hint === "turnDone" || hint === "noMoves"
											? "primary"
											: "secondary"
									}
									onPress={() => void match.endTurn()}
									busy={match.busy}
									testID="bg-end-turn"
								/>
							) : null}
						</TurnPanel>
					)}
					<Notice message={match.failed ? copy.online.couldNotMove : null} />
					{match.myColor ? (
						<AppText variant="caption">
							{fmt(copy.online.you, { color: copy.colors[match.myColor] })}
						</AppText>
					) : null}
					<OptionsPanel
						options={options}
						keys={OPTION_KEYS}
						onChange={(key, value) =>
							setOptions((current) => ({ ...current, [key]: value }))
						}
					/>
				</View>
			</ScrollView>
		</>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		root: { flex: 1, backgroundColor: colors.bg },
		content: {
			alignItems: "center",
			gap: spacing.lg,
			paddingHorizontal: spacing.sm,
			paddingTop: spacing.sm,
		},
		wideContent: {
			flexDirection: "row",
			alignItems: "flex-start",
			justifyContent: "center",
			paddingHorizontal: metrics.screenGutter,
		},
		side: { gap: spacing.lg },
		section: { gap: spacing.md },
	});
