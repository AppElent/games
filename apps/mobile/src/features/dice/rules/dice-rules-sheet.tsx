/**
 * How to play, written from the game's config and the table's house rules:
 * every box's line comes from its rule, so a new sheet needs no new text.
 */
import { type DiceGame, diceRules } from "@arcadeclub/core/dice/engine";
import { categoryEffect } from "@arcadeclub/core/dice/table-view";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { fmt, useI18n } from "../../../i18n";
import { spacing } from "../../../theme";
import { AppText } from "../../../ui/text";
import { Sheet } from "../../cards/deck/sheet";

function Section({
	heading,
	children,
}: {
	heading: string;
	children: ReactNode;
}) {
	return (
		<View style={styles.section}>
			<AppText variant="label" accessibilityRole="header">
				{heading.toUpperCase()}
			</AppText>
			{children}
		</View>
	);
}

export function DiceRulesSheet({
	game,
	options,
	open,
	onClose,
}: {
	game: DiceGame;
	options: readonly string[];
	open: boolean;
	onClose: () => void;
}) {
	const { t } = useI18n();
	const dice = t.games.dice;
	const text = dice.games[game.id];
	const optionText = text.options as Record<
		string,
		{ label: string; hint: string }
	>;
	const rules = diceRules(game, options);
	const r = dice.rules;
	const active = options.map((id) => optionText[id]).filter(Boolean);

	return (
		<Sheet
			open={open}
			onClose={onClose}
			title={fmt(r.heading, { game: text.name })}
		>
			<Section heading={r.goalHeading}>
				<AppText variant="secondary" tone="default">
					{fmt(r.goal, { rounds: rules.sheet.length })}
				</AppText>
			</Section>
			<Section heading={r.turnHeading}>
				<AppText variant="secondary" tone="default">
					{fmt(r.turnRoll, { dice: rules.dice, rolls: rules.rollsPerTurn })}
				</AppText>
				<AppText variant="secondary" tone="default">
					{r.turnScore}
				</AppText>
			</Section>
			<Section heading={r.boxesHeading}>
				{rules.sheet.map((entry) => (
					<View key={entry.id} style={styles.box}>
						<AppText variant="body">{dice.categories[entry.id]}</AppText>
						<AppText variant="secondary">
							{categoryEffect({ dice, fmt }, entry.rule, rules.dice)}
						</AppText>
					</View>
				))}
				<AppText variant="secondary" tone="default">
					{fmt(r.upperBonus, rules.upperBonus)}
				</AppText>
				{rules.extraAllSame ? (
					<AppText variant="secondary" tone="default">
						{fmt(r.extraAllSame, rules.extraAllSame)}
					</AppText>
				) : null}
			</Section>
			{active.length > 0 ? (
				<Section heading={r.extrasHeading}>
					{active.map((option) => (
						<AppText key={option.label} variant="secondary" tone="default">
							{`${option.label}: ${option.hint}`}
						</AppText>
					))}
				</Section>
			) : null}
		</Sheet>
	);
}

const styles = StyleSheet.create({
	section: { gap: spacing.sm },
	box: { gap: spacing.xxs },
});
