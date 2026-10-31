/**
 * A timeline as a vertical list, oldest first. When placing, a "place here"
 * slot sits before, between and after the cards; the chosen slot is marked.
 */
import type { HitsterCard } from "@games/core/hitster-packs";
import { Fragment } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { fmt, useI18n } from "../../../i18n";
import {
	metrics,
	opacity,
	radius,
	spacing,
	type Tokens,
	useThemedStyles,
	useTokens,
} from "../../../theme";
import { Icon } from "../../../ui/icon";
import { AppText } from "../../../ui/text";

export function TimelineList({
	cards,
	selectedDrop,
	onSelectDrop,
	testID,
}: {
	cards: HitsterCard[];
	selectedDrop?: number;
	onSelectDrop?: (index: number) => void;
	testID?: string;
}) {
	const { t } = useI18n();
	const copy = t.games.hitster.bits.timeline;
	const styles = useThemedStyles(createStyles);
	const tokens = useTokens();

	const slot = (index: number) => {
		if (!onSelectDrop) return null;
		const selected = selectedDrop === index;
		return (
			<Pressable
				accessibilityRole="radio"
				accessibilityState={{ selected }}
				accessibilityLabel={fmt(copy.placeHere, { position: index + 1 })}
				onPress={() => onSelectDrop(index)}
				testID={`hitster-slot-${index}`}
				style={({ pressed }) => [
					styles.slot,
					selected && styles.slotSelected,
					pressed && styles.pressed,
				]}
			>
				<Icon
					ios={selected ? "music.note" : "plus"}
					android={selected ? "music_note" : "add"}
					size={16}
					color={selected ? tokens.onAccent : tokens.accent}
				/>
				<AppText
					variant="caption"
					style={{ color: selected ? tokens.onAccent : tokens.accent }}
				>
					{selected ? copy.selectedSpot : copy.placeHereShort}
				</AppText>
			</Pressable>
		);
	};

	return (
		<View style={styles.list} testID={testID}>
			{slot(0)}
			{cards.map((card, index) => (
				<Fragment key={card.id}>
					<View
						style={styles.card}
						accessible
						accessibilityLabel={`${card.releaseYear}, ${card.title}, ${card.artistNames.join(", ")}`}
					>
						<AppText variant="heading" style={styles.year}>
							{card.releaseYear}
						</AppText>
						<View style={styles.text}>
							<AppText variant="body" numberOfLines={1}>
								{card.title}
							</AppText>
							<AppText variant="caption" numberOfLines={1}>
								{card.artistNames.join(", ")}
							</AppText>
						</View>
					</View>
					{slot(index + 1)}
				</Fragment>
			))}
		</View>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		list: { gap: spacing.xs },
		card: {
			flexDirection: "row",
			alignItems: "center",
			gap: spacing.md,
			padding: spacing.md,
			borderRadius: radius.md,
			backgroundColor: colors.surface2,
		},
		year: { color: colors.pink, minWidth: 52 },
		text: { flex: 1, gap: spacing.xxs },
		slot: {
			minHeight: metrics.hitTarget,
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "center",
			gap: spacing.xs,
			borderRadius: radius.md,
			borderWidth: 1,
			borderStyle: "dashed",
			borderColor: colors.accent,
		},
		slotSelected: {
			backgroundColor: colors.accent,
			borderStyle: "solid",
		},
		pressed: { opacity: opacity.pressed },
	});
