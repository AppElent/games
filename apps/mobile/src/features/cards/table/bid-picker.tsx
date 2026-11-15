/** Pick a number of tricks and bid it; a number the rules forbid can't be sent. */
import type { TricksView } from "@arcadeclub/core/cards/tricks";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { haptics } from "../../../feedback/haptics";
import { fmt, useI18n } from "../../../i18n";
import { cardColors, metrics, opacity, radius, spacing } from "../../../theme";
import { Icon } from "../../../ui/icon";
import { FeltText, TableButton } from "./felt-ui";

export function BidPicker({
	view,
	pending,
	onBid,
}: {
	view: TricksView;
	pending: boolean;
	onBid: (count: number) => void;
}) {
	const { t } = useI18n();
	const tt = t.games.cards.tricks;
	const [draft, setDraft] = useState(view.legalBids[0] ?? 0);

	const step = (delta: number, label: string, disabled: boolean) => (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={label}
			accessibilityState={{ disabled }}
			disabled={disabled}
			onPress={() => {
				haptics.selectionChanged();
				setDraft((count) => count + delta);
			}}
			testID={delta > 0 ? "cards-bid-more" : "cards-bid-less"}
			style={({ pressed }) => [
				styles.step,
				pressed && styles.pressed,
				disabled && styles.disabled,
			]}
		>
			<Icon
				ios={delta > 0 ? "plus" : "minus"}
				android={delta > 0 ? "add" : "remove"}
				size={18}
				color={cardColors.ivory}
			/>
		</Pressable>
	);

	return (
		<View style={styles.row}>
			<View style={styles.stepper}>
				{step(-1, tt.bidLess, draft <= 0)}
				<FeltText
					variant="heading"
					accessibilityLabel={`${tt.bidValue}: ${draft}`}
					accessibilityLiveRegion="polite"
					style={styles.value}
					testID="cards-bid-value"
				>
					{String(draft)}
				</FeltText>
				{step(1, tt.bidMore, draft >= view.handSize)}
			</View>
			<TableButton
				label={fmt(tt.bidButton, { count: draft })}
				disabled={pending || !view.legalBids.includes(draft)}
				onPress={() => {
					haptics.moveMade();
					onBid(draft);
				}}
				testID="cards-bid"
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	row: {
		flexDirection: "row",
		flexWrap: "wrap",
		alignItems: "center",
		justifyContent: "center",
		gap: spacing.sm,
	},
	stepper: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
	step: {
		width: metrics.hitTarget,
		height: metrics.hitTarget,
		alignItems: "center",
		justifyContent: "center",
		borderRadius: radius.pill,
		backgroundColor: cardColors.chip,
		borderWidth: 1,
		borderColor: cardColors.ivoryLine,
	},
	pressed: { opacity: opacity.pressed },
	disabled: { opacity: opacity.disabled },
	value: { minWidth: 28, textAlign: "center", fontVariant: ["tabular-nums"] },
});
