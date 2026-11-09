/**
 * The host's controls. While a round plays, the mystery track stays hidden
 * until the host asks to see it (players may be looking at this phone), with
 * a shortcut to find it on Spotify. Then: reveal the year, next round.
 */
import { useState } from "react";
import { Linking, StyleSheet, View } from "react-native";
import { plural, useI18n } from "../../../i18n";
import { radius, spacing, type Tokens, useThemedStyles } from "../../../theme";
import { Button } from "../../../ui/button";
import { AppText } from "../../../ui/text";
import { useResetOnChange } from "../../../ui/use-reset-on-change";
import type { HitsterBundle, HitsterState } from "./room-view";

export function DjPanel({
	bundle,
	state,
	busy,
	onReveal,
	onNextRound,
}: {
	bundle: HitsterBundle;
	state: HitsterState;
	busy: boolean;
	onReveal: () => void;
	onNextRound: () => void;
}) {
	const { t, locale } = useI18n();
	const copy = t.games.hitster.hostView;
	const styles = useThemedStyles(createStyles);
	const [shown, setShown] = useState(false);
	const track = bundle.hostPlayback;

	// Each round starts hidden, so the next mystery track is never on screen.
	useResetOnChange(`${state.phase}:${track?.spotifySearchUrl ?? ""}`, () =>
		setShown(false),
	);

	if (state.phase === "reveal") {
		return (
			<Button
				label={copy.nextRound}
				onPress={onNextRound}
				busy={busy}
				testID="hitster-next-round"
			/>
		);
	}
	if (state.phase !== "nowPlaying") return null;

	return (
		<View style={styles.panel} testID="hitster-dj">
			<AppText variant="label">{copy.djPanelKicker.toUpperCase()}</AppText>
			{track && shown ? (
				<View style={styles.track}>
					<AppText variant="heading" selectable>
						{track.title}
					</AppText>
					<AppText variant="secondary" selectable>
						{track.artistNames.join(", ")}
					</AppText>
				</View>
			) : null}
			<View style={styles.actions}>
				<Button
					variant="secondary"
					compact
					label={shown ? copy.hideTrack : copy.revealTrackSummary}
					onPress={() => setShown((value) => !value)}
					testID="hitster-show-track"
				/>
				{track ? (
					<Button
						variant="secondary"
						compact
						label={copy.findOnSpotify}
						onPress={() => void Linking.openURL(track.spotifySearchUrl)}
						testID="hitster-spotify"
					/>
				) : null}
			</View>
			<AppText variant="secondary" tone="default">
				{state.pendingGuess ? copy.placementLocked : copy.waitingForPlacement}
				{state.stealClaims.length > 0
					? ` · ${plural(locale, state.stealClaims.length, copy.stealClaims)}`
					: ""}
			</AppText>
			<Button
				label={copy.revealYear}
				onPress={onReveal}
				busy={busy}
				testID="hitster-reveal"
			/>
		</View>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		panel: {
			gap: spacing.md,
			padding: spacing.lg,
			borderRadius: radius.lg,
			backgroundColor: colors.pinkDim,
		},
		track: { gap: spacing.xxs },
		actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
	});
