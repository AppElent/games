/**
 * The running turn, by role: the describer's words and ticks, the
 * teammates' big timer and dots, and the referees' read-only card.
 */
import { secondsLeft } from "@arcadeclub/core/beat-the-clock";
import { Pressable, StyleSheet, View } from "react-native";
import { haptics } from "../../../feedback/haptics";
import { fmt, plural } from "../../../i18n";
import {
	radius,
	spacing,
	type Tokens,
	useThemedStyles,
	useTokens,
} from "../../../theme";
import { Button } from "../../../ui/button";
import { Card } from "../../../ui/card";
import { AppText } from "../../../ui/text";
import {
	BigTimer,
	type ClockScreenProps,
	ScoreStrip,
	TeamChip,
	TimeBar,
	useClockCopy,
	WordRow,
} from "./clock-bits";

export function ClockTurn(props: ClockScreenProps) {
	if (props.view.role === "describer") return <DescriberTurn {...props} />;
	if (props.view.role === "opponent") return <OpponentTurn {...props} />;
	return <TeammateTurn {...props} />;
}

function useTurn({ bundle, now }: ClockScreenProps) {
	const { state } = bundle;
	const ticks = state.turn?.ticks ?? [];
	return {
		state,
		turn: state.turn,
		ticks,
		ticked: ticks.filter(Boolean).length,
		seconds: secondsLeft(state, now),
		ready: state.phase === "ready",
		timeUp: state.phase === "timeUp",
	};
}

function DescriberTurn(props: ClockScreenProps) {
	const { bundle, view, room } = props;
	const s = useThemedStyles(createStyles);
	const tokens = useTokens();
	const { locale, copy, teams } = useClockCopy();
	const { state, turn, ticks, ticked, seconds, ready, timeUp } = useTurn(props);
	if (!turn) return null;
	const guessers = view.guesserIds.map(view.name);
	const opponents = teams.list(view.otherTeams);

	if (ready) {
		return (
			<>
				<View style={s.gap}>
					<TeamChip label={teams.team(turn.team)} />
					<AppText variant="display" accessibilityRole="header">
						{copy.describer.readyTitle}
					</AppText>
					<AppText variant="secondary">
						{fmt(
							guessers.length > 1
								? copy.describer.readyBodyMany
								: copy.describer.readyBody,
							{ guessers: teams.names(guessers), opponents },
						)}
					</AppText>
				</View>
				<Button
					label={copy.describer.go}
					disabled={state.paused}
					busy={room.pending === "go"}
					onPress={() => {
						haptics.moveMade();
						void room.go();
					}}
					testID="clock-go"
				/>
			</>
		);
	}

	const words = bundle.words ?? [];
	return (
		<>
			<BigTimer seconds={seconds} timeUp={timeUp} />
			<TimeBar seconds={seconds} total={state.turnSeconds} />
			<AppText variant="secondary">
				{timeUp
					? fmt(copy.describer.hintUp, { opponents })
					: copy.describer.hint}
			</AppText>
			<View style={s.gapSm}>
				{words.map((word, index) => {
					const on = ticks[index] ?? false;
					const locked = (timeUp && !on) || state.paused;
					return (
						<Pressable
							key={word}
							accessibilityRole="checkbox"
							accessibilityState={{ checked: on, disabled: locked }}
							disabled={locked}
							onPress={() => {
								haptics.valueEntered();
								void room.tick(index, !on);
							}}
							style={[s.tickRow, on && s.tickRowOn, locked && s.locked]}
							testID={`clock-word-${index}`}
						>
							<AppText variant="caption" style={s.index}>
								{index + 1}
							</AppText>
							<AppText variant="title" style={s.flex}>
								{word}
							</AppText>
							<View
								style={[
									s.check,
									on
										? {
												backgroundColor: tokens.amber,
												borderColor: tokens.amber,
											}
										: null,
								]}
							>
								{on ? (
									<AppText variant="control" style={{ color: tokens.onAmber }}>
										✓
									</AppText>
								) : null}
							</View>
						</Pressable>
					);
				})}
			</View>
			{timeUp ? (
				<Button
					label={fmt(plural(locale, ticked, copy.describer.send), {
						opponents,
					})}
					busy={room.pending === "send"}
					disabled={state.paused}
					onPress={() => void room.send()}
					testID="clock-send"
				/>
			) : (
				<>
					<AppText variant="secondary" style={s.centerText}>
						{fmt(copy.guessedCount, { n: ticked })}
					</AppText>
					<Button
						variant="plain"
						label={copy.describer.endEarly}
						disabled={room.pending === "send" || state.paused}
						onPress={() => void room.send()}
						testID="clock-end-early"
					/>
				</>
			)}
			<ScoreStrip
				scores={state.scores}
				playingTeam={turn.team}
				pendingGain={ticked}
				myTeam={view.myTeam}
			/>
		</>
	);
}

function TeammateTurn(props: ClockScreenProps) {
	const { view } = props;
	const s = useThemedStyles(createStyles);
	const { copy, teams } = useClockCopy();
	const { state, turn, ticks, ticked, seconds, ready, timeUp } = useTurn(props);
	if (!turn) return null;
	const watching = view.isWatcher || view.role !== "teammate";
	const describer = view.describerName;
	return (
		<>
			<View style={s.centerGap}>
				<TeamChip
					label={
						watching
							? fmt(copy.watcher.team, {
									team: teams.team(turn.team),
									describer,
								})
							: fmt(copy.teammate.team, { describer })
					}
				/>
				{ready ? (
					<>
						<AppText
							variant="display"
							style={s.centerText}
							accessibilityRole="header"
						>
							{watching
								? fmt(copy.opponent.upTitle, { team: teams.team(turn.team) })
								: copy.teammate.readyTitle}
						</AppText>
						<AppText variant="secondary" style={s.centerText}>
							{watching
								? fmt(copy.opponent.upBody, { describer })
								: fmt(copy.teammate.readyBody, { describer })}
						</AppText>
					</>
				) : (
					<>
						<BigTimer seconds={seconds} timeUp={timeUp} />
						<View style={s.fullWidth}>
							<TimeBar seconds={seconds} total={state.turnSeconds} />
						</View>
						<AppText variant="heading" style={s.centerText}>
							{timeUp
								? fmt(copy.waitSend, { describer })
								: watching
									? copy.watcher.watching
									: copy.teammate.guess}
						</AppText>
						<View
							accessible
							accessibilityLabel={fmt(copy.teammate.dots, { n: ticked })}
							style={s.dots}
						>
							{ticks.map((on, index) => (
								<View
									// biome-ignore lint/suspicious/noArrayIndexKey: five fixed slots
									key={index}
									style={[s.dot, on && s.dotOn]}
								/>
							))}
						</View>
					</>
				)}
			</View>
			<ScoreStrip
				scores={state.scores}
				playingTeam={turn.team}
				pendingGain={ready ? 0 : ticked}
				myTeam={view.myTeam}
			/>
		</>
	);
}

function OpponentTurn(props: ClockScreenProps) {
	const { bundle, view } = props;
	const s = useThemedStyles(createStyles);
	const { copy, teams } = useClockCopy();
	const { state, turn, ticks, ticked, seconds, ready, timeUp } = useTurn(props);
	if (!turn) return null;
	const describer = view.describerName;
	const guessers = view.guesserIds.map(view.name);
	const team = teams.team(turn.team);
	const words = bundle.words ?? [];
	return (
		<>
			<View style={s.row}>
				{ready ? null : <BigTimer seconds={seconds} timeUp={timeUp} compact />}
				<View style={[s.flex, s.gapXs]}>
					<AppText variant="heading" accessibilityRole="header">
						{ready
							? fmt(copy.opponent.upTitle, { team })
							: fmt(copy.opponent.busyTitle, { team })}
					</AppText>
					<AppText variant="secondary">
						{ready
							? fmt(copy.opponent.upBody, { describer })
							: timeUp
								? copy.timer.up
								: fmt(
										guessers.length > 1
											? copy.opponent.busyBodyMany
											: copy.opponent.busyBody,
										{ describer, guessers: teams.names(guessers) },
									)}
					</AppText>
				</View>
			</View>
			<AppText variant="secondary" tone="default" style={s.note}>
				{fmt(copy.opponent.referee, { describer })}
			</AppText>
			{ready || words.length === 0 ? (
				<Card>
					<AppText variant="secondary" style={s.centerText}>
						{fmt(copy.opponent.cardSoon, { describer })}
					</AppText>
				</Card>
			) : (
				<View
					style={s.gapSm}
					accessibilityLabel={fmt(copy.opponent.card, { team })}
				>
					{words.map((word, index) => (
						<WordRow
							key={word}
							word={word}
							state={ticks[index] ? "guessed" : "plain"}
							trailing={
								ticks[index] ? (
									<AppText variant="label" style={s.amber}>
										{copy.opponent.guessed}
									</AppText>
								) : null
							}
						/>
					))}
				</View>
			)}
			{timeUp ? (
				<AppText variant="secondary" style={s.centerText}>
					{fmt(copy.waitSend, { describer })}
				</AppText>
			) : null}
			<ScoreStrip
				scores={state.scores}
				playingTeam={turn.team}
				pendingGain={ready ? 0 : ticked}
				myTeam={view.myTeam}
			/>
		</>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		gap: { gap: spacing.md, paddingTop: spacing.lg },
		gapSm: { gap: spacing.sm },
		gapXs: { gap: spacing.xs },
		centerGap: {
			alignItems: "center",
			gap: spacing.md,
			paddingTop: spacing.md,
		},
		centerText: { textAlign: "center" },
		fullWidth: { alignSelf: "stretch" },
		flex: { flex: 1 },
		row: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
		note: {
			borderRadius: radius.md,
			backgroundColor: colors.surface2,
			padding: spacing.md,
		},
		amber: { color: colors.amber },
		tickRow: {
			minHeight: 60,
			flexDirection: "row",
			alignItems: "center",
			gap: spacing.md,
			borderRadius: radius.md,
			borderWidth: 1,
			borderColor: colors.border,
			paddingHorizontal: spacing.lg,
			paddingVertical: spacing.sm,
		},
		tickRowOn: { backgroundColor: colors.amberDim, borderColor: "transparent" },
		locked: { opacity: 0.6 },
		index: { width: 18 },
		check: {
			width: 32,
			height: 32,
			borderRadius: radius.pill,
			borderWidth: 2,
			borderColor: colors.borderStrong,
			alignItems: "center",
			justifyContent: "center",
		},
		dots: { flexDirection: "row", gap: spacing.sm },
		dot: {
			width: 16,
			height: 16,
			borderRadius: radius.pill,
			borderWidth: 2,
			borderColor: colors.borderStrong,
		},
		dotOn: { backgroundColor: colors.amber, borderColor: colors.amber },
	});
