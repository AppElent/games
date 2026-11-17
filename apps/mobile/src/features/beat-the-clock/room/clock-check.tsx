/**
 * The referee check: the other teams flag words the describer said and
 * confirm; the describing team watches the result come in.
 */
import { CLOCK_CHECK_MS, turnGain } from "@arcadeclub/core/beat-the-clock";
import { StyleSheet, View } from "react-native";
import { fmt, plural } from "../../../i18n";
import { spacing, type Tokens, useThemedStyles } from "../../../theme";
import { Button } from "../../../ui/button";
import { Card } from "../../../ui/card";
import { AppText } from "../../../ui/text";
import { type ClockScreenProps, useClockCopy, WordRow } from "./clock-bits";

function useCheck({ bundle, now }: ClockScreenProps) {
	const { state } = bundle;
	const turn = state.turn;
	const words = bundle.words ?? [];
	const ticks = turn?.ticks ?? [];
	const left =
		state.paused && state.pausedRemaining !== undefined
			? Math.ceil(state.pausedRemaining / 1000)
			: Math.max(
					0,
					Math.ceil(((state.deadline ?? now + CLOCK_CHECK_MS) - now) / 1000),
				);
	return {
		state,
		turn,
		words,
		flags: turn?.flags ?? [],
		done: state.phase !== "checking",
		left,
		gain: turn ? turnGain({ ...turn, words: [] }) : 0,
		guessed: words.flatMap((_, index) => (ticks[index] ? [index] : [])),
		missed: words.flatMap((word, index) => (ticks[index] ? [] : [word])),
	};
}

export function ClockCheck(props: ClockScreenProps) {
	return props.view.role === "opponent" ? (
		<RefereeCheck {...props} />
	) : (
		<CheckingView {...props} />
	);
}

function RefereeCheck(props: ClockScreenProps) {
	const { view, room } = props;
	const s = useThemedStyles(createStyles);
	const { locale, copy, teams } = useClockCopy();
	const { state, turn, words, flags, done, left, gain, guessed, missed } =
		useCheck(props);
	if (!turn) return null;
	const team = teams.team(turn.team);
	const busy = room.pending === "confirm";
	return (
		<>
			<View style={s.gapXs}>
				<AppText variant="title" accessibilityRole="header">
					{fmt(copy.check.title, { team })}
				</AppText>
				<AppText variant="secondary">
					{fmt(copy.check.body, { describer: view.describerName })}
				</AppText>
			</View>
			{guessed.length === 0 ? (
				<Card>
					<AppText variant="secondary">{copy.check.none}</AppText>
				</Card>
			) : (
				<View style={s.gapSm}>
					{guessed.map((index) => {
						const flagged = Boolean(flags[index]);
						const word = words[index] ?? "";
						return (
							<WordRow
								key={word}
								word={word}
								state={flagged ? "flagged" : "plain"}
								trailing={
									done ? null : (
										<Button
											variant="secondary"
											compact
											label={flagged ? copy.check.undo : copy.check.flag}
											disabled={busy || state.paused}
											onPress={() => void room.flag(index, !flagged)}
											testID={`clock-flag-${index}`}
										/>
									)
								}
							/>
						);
					})}
				</View>
			)}
			{missed.length > 0 ? (
				<View style={s.gapXs}>
					<AppText variant="label">{copy.check.missed.toUpperCase()}</AppText>
					<AppText variant="secondary">{missed.join(" · ")}</AppText>
				</View>
			) : null}
			{done ? (
				<AppText
					variant="body"
					style={s.centerText}
					accessibilityLiveRegion="polite"
				>
					{turn.autoConfirmed
						? fmt(plural(locale, turn.gain ?? 0, copy.check.autoDone), { team })
						: fmt(plural(locale, turn.gain ?? 0, copy.check.confirmedBy), {
								team,
								name: view.name(turn.confirmedBy),
							})}
				</AppText>
			) : (
				<>
					<AppText variant="caption" style={s.centerText}>
						{fmt(copy.check.auto, { s: left })}
					</AppText>
					<Button
						label={plural(locale, gain, copy.check.confirm)}
						busy={busy}
						disabled={state.paused}
						onPress={() => void room.confirm()}
						testID="clock-confirm"
					/>
				</>
			)}
		</>
	);
}

function CheckingView(props: ClockScreenProps) {
	const { view } = props;
	const s = useThemedStyles(createStyles);
	const { copy, teams } = useClockCopy();
	const { turn, words, flags, done, left, gain, guessed } = useCheck(props);
	if (!turn) return null;
	const referees = teams.list(view.otherTeams);
	const watching = view.role !== "describer" && view.role !== "teammate";
	const title = watching
		? done
			? copy.checking.doneWatch
			: fmt(copy.checking.titleWatch, { referees, team: teams.team(turn.team) })
		: done
			? turn.autoConfirmed
				? copy.checking.autoDone
				: fmt(copy.checking.done, { team: referees })
			: fmt(copy.checking.title, { team: referees });
	return (
		<>
			{done ? null : (
				<AppText variant="label" style={s.amber}>
					{fmt(copy.checking.auto, { s: left })}
				</AppText>
			)}
			<AppText variant="title" accessibilityRole="header">
				{title}
			</AppText>
			<View style={s.gapSm} accessibilityLabel={copy.checking.list}>
				{guessed.map((index) => {
					const flaggedBy = flags[index];
					return (
						<WordRow
							key={words[index]}
							word={words[index] ?? ""}
							state={flaggedBy ? "flagged" : "plain"}
							trailing={
								<AppText
									variant="caption"
									style={flaggedBy ? s.danger : done ? s.amber : undefined}
								>
									{flaggedBy
										? fmt(copy.checking.flaggedBy, {
												name: view.name(flaggedBy),
											})
										: done
											? copy.checking.counts
											: copy.checking.pending}
								</AppText>
							}
						/>
					);
				})}
			</View>
			<Card>
				<View style={s.between}>
					<AppText variant="secondary">{copy.checking.thisTurn}</AppText>
					<AppText variant="title" style={s.amber}>
						{fmt(copy.score.gain, { n: done ? (turn.gain ?? gain) : gain })}
					</AppText>
				</View>
			</Card>
			{done ? (
				<Button
					variant="secondary"
					label={copy.checking.seeScores}
					onPress={props.onSeeScores}
				/>
			) : watching ? null : (
				<AppText variant="caption" style={s.centerText}>
					{fmt(copy.checking.footer, { team: referees })}
				</AppText>
			)}
		</>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		gapXs: { gap: spacing.xs },
		gapSm: { gap: spacing.sm },
		centerText: { textAlign: "center" },
		amber: { color: colors.amber },
		danger: { color: colors.danger },
		between: {
			flexDirection: "row",
			justifyContent: "space-between",
			alignItems: "center",
		},
	});
