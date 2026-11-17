/** Small pieces every Beat the Clock screen shares. */
import type { ClockView } from "@arcadeclub/core/beat-the-clock-view";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { fmt, useI18n } from "../../../i18n";
import {
	radius,
	spacing,
	type Tokens,
	useThemedStyles,
	useTokens,
} from "../../../theme";
import { AppText } from "../../../ui/text";
import { teamNames } from "./room-text";
import type { ClockBundle, ClockRoom } from "./use-clock-room";

export type ClockScreenProps = {
	bundle: ClockBundle;
	view: ClockView;
	room: ClockRoom;
	now: number;
	/** Leave the confirmed check for the score now, not after 2 s. */
	onSeeScores: () => void;
};

export function useClockCopy() {
	const { t, locale } = useI18n();
	const copy = t.games.beatTheClock;
	return { t, locale, copy, teams: teamNames(copy) };
}

/** The time, every `ms` while `active`. */
export function useNow(ms: number, active: boolean) {
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		if (!active) return;
		setNow(Date.now());
		const timer = setInterval(() => setNow(Date.now()), ms);
		return () => clearInterval(timer);
	}, [ms, active]);
	return now;
}

export function TeamChip({ label }: { label: string }) {
	const styles = useThemedStyles(createStyles);
	return (
		<View style={styles.chip}>
			<AppText variant="label" style={styles.chipText}>
				{label}
			</AppText>
		</View>
	);
}

/** The big countdown; red in the last 5 seconds and at time's up. */
export function BigTimer({
	seconds,
	timeUp,
	compact = false,
}: {
	seconds: number;
	timeUp: boolean;
	compact?: boolean;
}) {
	const tokens = useTokens();
	const { copy } = useClockCopy();
	const urgent = timeUp || seconds <= 5;
	return (
		<View
			accessible
			accessibilityRole="timer"
			accessibilityLabel={
				timeUp ? copy.timer.up : `${seconds} ${copy.timer.left}`
			}
			style={styles.timer}
		>
			<AppText
				variant={compact ? "timerSmall" : "timer"}
				style={{ color: urgent ? tokens.danger : tokens.amber }}
				maxFontSizeMultiplier={1.2}
			>
				{seconds}
			</AppText>
			{compact ? null : (
				<AppText variant="caption">
					{timeUp
						? copy.timer.up
						: seconds <= 5
							? copy.timer.last
							: copy.timer.left}
				</AppText>
			)}
		</View>
	);
}

/** A thin bar for the time left. */
export function TimeBar({
	seconds,
	total,
}: {
	seconds: number;
	total: number;
}) {
	const s = useThemedStyles(createStyles);
	const tokens = useTokens();
	const share = Math.max(0, Math.min(1, seconds / total));
	return (
		<View style={s.track}>
			<View
				style={[
					s.fill,
					{
						width: `${share * 100}%`,
						backgroundColor: seconds <= 5 ? tokens.danger : tokens.amber,
					},
				]}
			/>
		</View>
	);
}

/** Every team's score, the playing team first, with this turn's ticks so far. */
export function ScoreStrip({
	scores,
	playingTeam,
	pendingGain,
	myTeam,
}: {
	scores: readonly number[];
	playingTeam: number;
	pendingGain: number;
	myTeam: number | undefined;
}) {
	const s = useThemedStyles(createStyles);
	const { copy, teams } = useClockCopy();
	const order = scores
		.map((_, team) => team)
		.sort((a, b) => (a === playingTeam ? -1 : b === playingTeam ? 1 : a - b));
	return (
		<View style={s.strip} accessibilityLabel={copy.score.list}>
			{order.map((team) => (
				<View
					key={team}
					style={[s.stripItem, team === playingTeam && s.stripPlaying]}
				>
					<AppText variant="caption" numberOfLines={1}>
						{team === myTeam
							? fmt(copy.opponent.yourTeam, { team: teams.team(team) })
							: teams.team(team)}
					</AppText>
					<AppText variant="heading" style={{ fontVariant: ["tabular-nums"] }}>
						{scores[team]}
						{team === playingTeam && pendingGain > 0 ? ` +${pendingGain}` : ""}
					</AppText>
				</View>
			))}
		</View>
	);
}

/** A word on a card: plain, guessed (amber) or flagged (red, struck). */
export function WordRow({
	word,
	state,
	trailing,
}: {
	word: string;
	state: "plain" | "guessed" | "flagged";
	trailing?: React.ReactNode;
}) {
	const s = useThemedStyles(createStyles);
	const tokens = useTokens();
	return (
		<View
			style={[
				s.word,
				state === "guessed" && s.wordGuessed,
				state === "flagged" && s.wordFlagged,
			]}
		>
			<AppText
				variant="heading"
				style={[
					s.wordText,
					state === "flagged" && {
						color: tokens.danger,
						textDecorationLine: "line-through",
					},
				]}
			>
				{word}
			</AppText>
			{trailing}
		</View>
	);
}

const styles = StyleSheet.create({
	timer: { alignItems: "center" },
});

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		chip: {
			alignSelf: "flex-start",
			borderRadius: radius.pill,
			backgroundColor: colors.amberDim,
			paddingHorizontal: spacing.md,
			paddingVertical: spacing.xs,
		},
		chipText: { color: colors.amber },
		track: {
			height: 6,
			borderRadius: radius.pill,
			backgroundColor: colors.surface2,
			overflow: "hidden",
		},
		fill: { height: "100%", borderRadius: radius.pill },
		strip: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
		stripItem: {
			flexGrow: 1,
			flexBasis: "40%",
			borderRadius: radius.md,
			borderWidth: StyleSheet.hairlineWidth,
			borderColor: colors.border,
			backgroundColor: colors.surface,
			paddingHorizontal: spacing.md,
			paddingVertical: spacing.sm,
		},
		stripPlaying: { borderColor: colors.amber, borderWidth: 1 },
		word: {
			minHeight: 56,
			flexDirection: "row",
			alignItems: "center",
			gap: spacing.md,
			borderRadius: radius.md,
			borderWidth: StyleSheet.hairlineWidth,
			borderColor: colors.border,
			backgroundColor: colors.surface,
			paddingHorizontal: spacing.lg,
			paddingVertical: spacing.sm,
		},
		wordGuessed: {
			backgroundColor: colors.amberDim,
			borderColor: "transparent",
		},
		wordFlagged: {
			backgroundColor: colors.dangerDim,
			borderColor: "transparent",
		},
		wordText: { flex: 1 },
	});
