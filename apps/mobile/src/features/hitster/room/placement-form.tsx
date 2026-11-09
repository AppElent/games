/**
 * Placing the mystery song: pick a slot on the timeline, add the answers the
 * mode asks for, lock it in. A steal uses the same form on the stealer's own
 * timeline; the caller says whether artist and title are asked.
 */
import type { HitsterModeConfig } from "@arcadeclub/core/hitster";
import type { HitsterCard } from "@arcadeclub/core/hitster-packs";
import { useRef, useState } from "react";
import { StyleSheet, type TextInputInstance, View } from "react-native";
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
	askArtistTitle,
	submitLabel,
	submitTestID,
	busy,
	onSubmit,
}: {
	cards: HitsterCard[];
	config: HitsterModeConfig;
	askArtistTitle: boolean;
	submitLabel: string;
	submitTestID: string;
	busy: boolean;
	onSubmit: (answer: Answer) => void;
}) {
	const { t } = useI18n();
	const copy = t.games.hitster.stage;
	const [dropIndex, setDropIndex] = useState<number>();
	const [artist, setArtist] = useState("");
	const [title, setTitle] = useState("");
	const [year, setYear] = useState("");
	const titleRef = useRef<TextInputInstance>(null);
	const yearRef = useRef<TextInputInstance>(null);
	const parsedYear = Number.parseInt(year.trim(), 10);

	return (
		<View style={styles.form}>
			<AppText variant="secondary">{copy.placementInstructions}</AppText>
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
							config.needsArtistTitle
								? copy.artistLabelRequired
								: copy.artistLabelBonus
						}
						value={artist}
						onChangeText={setArtist}
						placeholder={copy.artistPlaceholder}
						autoCorrect={false}
						returnKeyType="next"
						submitBehavior="submit"
						onSubmitEditing={() => titleRef.current?.focus()}
						testID="hitster-artist"
					/>
					<TextField
						ref={titleRef}
						label={
							config.needsArtistTitle
								? copy.titleLabelRequired
								: copy.titleLabelBonus
						}
						value={title}
						onChangeText={setTitle}
						placeholder={copy.titlePlaceholder}
						autoCorrect={false}
						returnKeyType={config.needsYear ? "next" : "done"}
						submitBehavior={config.needsYear ? "submit" : "blurAndSubmit"}
						onSubmitEditing={() => yearRef.current?.focus()}
						testID="hitster-title"
					/>
				</>
			) : null}
			{config.needsYear ? (
				<TextField
					ref={yearRef}
					label={copy.exactYearLabel}
					value={year}
					onChangeText={setYear}
					placeholder={copy.yearPlaceholder}
					keyboardType="number-pad"
					maxLength={4}
					testID="hitster-year"
				/>
			) : null}
			<Button
				label={submitLabel}
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
				testID={submitTestID}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	form: { gap: spacing.md },
});
