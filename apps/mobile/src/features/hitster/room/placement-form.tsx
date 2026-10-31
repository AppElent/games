/**
 * Placing the mystery song: pick a slot on the timeline, add the answers the
 * mode asks for, lock it in. A steal uses the same form on the stealer's own
 * timeline, without the bonus fields.
 */
import type { HitsterModeConfig } from "@games/core/hitster";
import type { HitsterCard } from "@games/core/hitster-packs";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useI18n } from "../../../i18n";
import { spacing } from "../../../theme";
import { Button } from "../../../ui/button";
import { AppText } from "../../../ui/text";
import { TextField } from "../../../ui/text-field";
import { TimelineList } from "./timeline-list";
import type { Answer } from "./use-hitster-room";

export function PlacementForm({
	cards,
	config,
	forSteal,
	busy,
	onSubmit,
}: {
	cards: HitsterCard[];
	config: HitsterModeConfig;
	forSteal: boolean;
	busy: boolean;
	onSubmit: (answer: Answer) => void;
}) {
	const { t } = useI18n();
	const copy = t.hitster.stage;
	const [dropIndex, setDropIndex] = useState<number>();
	const [artist, setArtist] = useState("");
	const [title, setTitle] = useState("");
	const [year, setYear] = useState("");
	const askArtistTitle =
		config.needsArtistTitle || (!forSteal && config.earnTokens);
	const parsedYear = Number.parseInt(year.trim(), 10);

	return (
		<View style={styles.form}>
			<AppText variant="secondary">{copy.placementHelp}</AppText>
			<TimelineList
				cards={cards}
				selectedDrop={dropIndex}
				onSelectDrop={setDropIndex}
				testID="hitster-placement"
			/>
			{askArtistTitle ? (
				<>
					<TextField
						label={
							config.needsArtistTitle ? copy.artistRequired : copy.artistBonus
						}
						value={artist}
						onChangeText={setArtist}
						placeholder={copy.artistPlaceholder}
						autoCorrect={false}
						returnKeyType="next"
						testID="hitster-artist"
					/>
					<TextField
						label={
							config.needsArtistTitle ? copy.titleRequired : copy.titleBonus
						}
						value={title}
						onChangeText={setTitle}
						placeholder={copy.titlePlaceholder}
						autoCorrect={false}
						testID="hitster-title"
					/>
				</>
			) : null}
			{config.needsYear ? (
				<TextField
					label={copy.yearRequired}
					value={year}
					onChangeText={setYear}
					placeholder={copy.yearPlaceholder}
					keyboardType="number-pad"
					maxLength={4}
					testID="hitster-year"
				/>
			) : null}
			<Button
				label={forSteal ? copy.lockSteal : copy.lock}
				disabled={dropIndex === undefined}
				busy={busy}
				onPress={() => {
					if (dropIndex === undefined) return;
					onSubmit({
						dropIndex,
						artistGuess: artist.trim() || undefined,
						titleGuess: title.trim() || undefined,
						yearGuess: Number.isFinite(parsedYear) ? parsedYear : undefined,
					});
				}}
				testID={forSteal ? "hitster-lock-steal" : "hitster-lock"}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	form: { gap: spacing.md },
});
