/**
 * After a turn: the score, the tie before an extra round, and the winner
 * with what comes next.
 */
import {
	bestDescriber,
	leadingTeams,
	rankedTeams,
} from "@arcadeclub/core/beat-the-clock";
import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";
import { fmt, plural } from "../../../i18n";
import { radius, spacing, type Tokens, useThemedStyles } from "../../../theme";
import { Button } from "../../../ui/button";
import { Card } from "../../../ui/card";
import { AppText } from "../../../ui/text";
import { forgetSeat } from "../../sessions/session-seats";
import { type ClockScreenProps, useClockCopy } from "./clock-bits";

function Scoreboard({
	scores,
	target,
	bars,
	players,
}: {
	scores: readonly number[];
	target: number;
	bars: boolean;
	players?: (team: number) => string;
}) {
	const s = useThemedStyles(createStyles);
	const { copy, teams } = useClockCopy();
	const ranked = rankedTeams({ scores });
	const leaders = leadingTeams({ scores });
	const top = ranked[0]?.score ?? 0;
	return (
		<View style={s.gapSm} accessibilityLabel={copy.score.list}>
			{ranked.map(({ team, score }) => (
				<View
					key={team}
					style={[s.row, top > 0 && leaders.includes(team) && s.leader]}
				>
					<View style={s.between}>
						<View style={s.flex}>
							<AppText variant="heading">{teams.team(team)}</AppText>
							{players ? (
								<AppText variant="caption" numberOfLines={1}>
									{players(team)}
								</AppText>
							) : null}
						</View>
						<AppText variant="title">{score}</AppText>
					</View>
					{bars ? (
						<View
							style={s.track}
							accessibilityRole="progressbar"
							accessibilityLabel={fmt(copy.score.progress, {
								team: teams.team(team),
								target,
							})}
							accessibilityValue={{
								min: 0,
								max: target,
								now: Math.min(score, target),
							}}
						>
							<View
								style={[
									s.fill,
									{ width: `${Math.min(1, score / target) * 100}%` },
								]}
							/>
						</View>
					) : null}
				</View>
			))}
		</View>
	);
}

export function ClockScore({ bundle, view, room }: ClockScreenProps) {
	const s = useThemedStyles(createStyles);
	const { copy, teams } = useClockCopy();
	const { state } = bundle;
	const turn = state.turn;
	const flagged = turn ? turn.flags.filter(Boolean).length : 0;
	const guessed = turn ? turn.ticks.filter(Boolean).length : 0;
	const leaders = leadingTeams(state);
	const upcoming = view.upcoming;
	return (
		<>
			{turn ? (
				<View style={s.center}>
					<AppText variant="timerSmall" style={s.amber}>
						{fmt(copy.score.gain, { n: turn.gain ?? 0 })}
					</AppText>
					<AppText variant="heading">
						{fmt(copy.score.for, { team: teams.team(turn.team) })}
					</AppText>
					<AppText variant="secondary">
						{turn.skipped
							? copy.score.skippedDetail
							: flagged > 0
								? fmt(copy.score.detail, {
										n: guessed,
										f: flagged,
										opponents: teams.list(
											view.otherTeams.filter((t) => t !== turn.team),
										),
									})
								: fmt(copy.score.detailNoFlags, { n: guessed })}
					</AppText>
				</View>
			) : null}
			{state.roundOutcome !== "none" ? (
				<AppText
					variant="body"
					style={s.centerText}
					accessibilityLiveRegion="polite"
				>
					{state.roundOutcome === "tie"
						? fmt(copy.score.roundDoneTie, {
								round: state.round,
								teams: teams.list(leaders),
								score: state.scores[leaders[0] ?? 0] ?? 0,
							})
						: fmt(copy.score.roundDone, {
								round: state.round,
								team: teams.team(leaders[0] ?? 0),
								target: state.target,
							})}
				</AppText>
			) : null}
			<Scoreboard scores={state.scores} target={state.target} bars />
			{state.roundOutcome !== "none" ? (
				<Button
					label={copy.score.seeWinner}
					busy={room.pending === "seeWinner"}
					onPress={() => void room.seeWinner()}
					testID="clock-see-winner"
				/>
			) : upcoming && view.youreNext ? (
				<Card>
					<View style={s.gapSm}>
						<AppText variant="heading">{copy.score.youNext}</AppText>
						<AppText variant="secondary">
							{fmt(copy.score.youNextBody, { team: teams.team(upcoming.team) })}
						</AppText>
						<Button
							label={copy.score.next}
							busy={room.pending === "next"}
							disabled={state.paused}
							onPress={() => void room.next()}
							testID="clock-next"
						/>
					</View>
				</Card>
			) : upcoming ? (
				<Card>
					<View style={s.gapXs}>
						<AppText variant="heading">
							{`${fmt(copy.score.nextName, { name: view.name(upcoming.describerId) })} ${fmt(copy.score.nextBody, { team: teams.team(upcoming.team) })}`}
						</AppText>
						<AppText variant="caption">
							{fmt(copy.score.nextHint, {
								name: view.name(upcoming.describerId),
							})}
						</AppText>
					</View>
				</Card>
			) : null}
		</>
	);
}

export function ClockTie({ bundle, view, room }: ClockScreenProps) {
	const s = useThemedStyles(createStyles);
	const { copy } = useClockCopy();
	const { state } = bundle;
	return (
		<>
			<View style={s.center}>
				<AppText
					variant="display"
					accessibilityRole="header"
					style={s.centerText}
				>
					{fmt(copy.winner.tieTitle, { score: Math.max(...state.scores) })}
				</AppText>
				<AppText variant="secondary" style={s.centerText}>
					{copy.winner.tieBody}
				</AppText>
			</View>
			<Scoreboard
				scores={state.scores}
				target={state.target}
				bars={false}
				players={(team) => view.teamMembers(team).map(view.name).join(", ")}
			/>
			<Button
				label={copy.winner.extraRound}
				busy={room.pending === "extraRound"}
				onPress={() => void room.extraRound()}
				testID="clock-extra-round"
			/>
		</>
	);
}

export function ClockWinner({ bundle, view, room }: ClockScreenProps) {
	const s = useThemedStyles(createStyles);
	const router = useRouter();
	const { t, locale, copy, teams } = useClockCopy();
	const { state, session } = bundle;
	const hostName = view.name(session.hostParticipantId);
	const tied = state.winners.length > 1;
	const ranked = rankedTeams(state);
	const topScore = ranked[0]?.score ?? 0;
	const best = bestDescriber({ ...state, deck: [], used: [], turn: undefined });
	const reason =
		state.endReason === "host"
			? fmt(copy.winner.endedByHost, { host: hostName })
			: state.endReason === "tooFewTeams"
				? copy.winner.tooFewTeams
				: state.endReason === "ranOut"
					? copy.winner.ranOut
					: null;
	const body = tied
		? plural(locale, state.round, copy.winner.endedTieBody)
		: state.teamCount === 2
			? fmt(plural(locale, state.round, copy.winner.body), {
					a: ranked[0]?.score ?? 0,
					b: ranked[1]?.score ?? 0,
				})
			: fmt(plural(locale, state.round, copy.winner.bodyMany), {
					score: topScore,
				});

	const backToArcade = async () => {
		if (!view.isHost && !view.isWatcher) await room.leave();
		forgetSeat(session._id);
		router.replace("/");
	};

	return (
		<>
			{reason ? <AppText variant="label">{reason}</AppText> : null}
			<View style={s.center}>
				<AppText
					variant="display"
					accessibilityRole="header"
					style={s.centerText}
				>
					{tied
						? fmt(copy.winner.tieTitle, { score: topScore })
						: fmt(copy.winner.title, {
								team: teams.team(state.winners[0] ?? 0),
							})}
				</AppText>
				<AppText variant="secondary" style={s.centerText}>
					{!tied && best
						? `${body} ${fmt(copy.winner.best, { name: view.name(best) })}`
						: body}
				</AppText>
			</View>
			<Scoreboard
				scores={state.scores}
				target={state.target}
				bars={false}
				players={(team) => view.teamMembers(team).map(view.name).join(", ")}
			/>
			{view.isHost ? (
				<>
					{state.packWillRunLow ? (
						<AppText variant="secondary" tone="default" style={s.note}>
							{copy.winner.packReset}
						</AppText>
					) : null}
					<Button
						label={copy.winner.playAgain}
						busy={room.pending === "playAgain"}
						disabled={room.pending !== null}
						onPress={() => void room.playAgain(false)}
						testID="clock-play-again"
					/>
					<Button
						variant="secondary"
						label={copy.winner.newTeams}
						busy={room.pending === "newTeams"}
						disabled={room.pending !== null}
						onPress={() => void room.playAgain(true)}
						testID="clock-new-teams"
					/>
				</>
			) : (
				<AppText variant="secondary" tone="default" style={s.note}>
					{fmt(copy.winner.waitForHost, { host: hostName })}
				</AppText>
			)}
			<Button
				variant="plain"
				label={t.common.endScreen.backToArcade}
				busy={room.pending === "leave"}
				onPress={() => void backToArcade()}
			/>
		</>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		gapXs: { gap: spacing.xs },
		gapSm: { gap: spacing.sm },
		flex: { flex: 1 },
		center: { alignItems: "center", gap: spacing.xs, paddingTop: spacing.sm },
		centerText: { textAlign: "center" },
		amber: { color: colors.amber },
		between: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
			gap: spacing.md,
		},
		row: {
			gap: spacing.sm,
			borderRadius: radius.md,
			borderWidth: 1,
			borderColor: colors.border,
			backgroundColor: colors.surface,
			paddingHorizontal: spacing.lg,
			paddingVertical: spacing.md,
		},
		leader: { borderColor: colors.amber },
		track: {
			height: 6,
			borderRadius: radius.pill,
			backgroundColor: colors.surface2,
			overflow: "hidden",
		},
		fill: {
			height: "100%",
			borderRadius: radius.pill,
			backgroundColor: colors.amber,
		},
		note: {
			borderRadius: radius.md,
			backgroundColor: colors.surface2,
			padding: spacing.md,
		},
	});
