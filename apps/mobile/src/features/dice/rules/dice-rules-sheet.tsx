/**
 * How to play, written from the game's config and the table's house rules:
 * every line comes from a rule, so a new game in a family needs no new text.
 */
import { type DiceGame, diceRules } from "@arcadeclub/core/dice/engine";
import type { PushluckRules } from "@arcadeclub/core/dice/pushluck";
import type { ScoresheetRules } from "@arcadeclub/core/dice/scoresheet";
import {
	categoryEffect,
	pushluckRuleLines,
} from "@arcadeclub/core/dice/table-view";
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

function Lines({ lines }: { lines: readonly string[] }) {
	return lines.map((line) => (
		<AppText key={line} variant="secondary" tone="default">
			{line}
		</AppText>
	));
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
	const r = dice.rules;
	const active = options.map((id) => optionText[id]).filter(Boolean);

	return (
		<Sheet
			open={open}
			onClose={onClose}
			title={fmt(r.heading, { game: text.name })}
		>
			<RulesBody game={game} options={options} />
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

/** The family's own rules; every family names its game's rules in its own words. */
function RulesBody({
	game,
	options,
}: {
	game: DiceGame;
	options: readonly string[];
}) {
	switch (game.family) {
		case "scoresheet":
			return <ScoresheetRulesBody rules={diceRules(game, options)} />;
		case "pushluck":
			return <PushluckRulesBody rules={diceRules(game, options)} />;
	}
}

function ScoresheetRulesBody({ rules }: { rules: ScoresheetRules }) {
	const dice = useI18n().t.games.dice;
	const r = dice.rules;
	return (
		<>
			<Section heading={r.goalHeading}>
				<AppText variant="secondary" tone="default">
					{fmt(r.goal, { rounds: rules.sheet.length })}
				</AppText>
			</Section>
			<Section heading={r.turnHeading}>
				<Lines
					lines={[
						fmt(r.turnRoll, { dice: rules.dice, rolls: rules.rollsPerTurn }),
						r.turnScore,
					]}
				/>
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
		</>
	);
}

function PushluckRulesBody({ rules }: { rules: PushluckRules }) {
	const { t, locale } = useI18n();
	const dice = t.games.dice;
	const lines = pushluckRuleLines({ dice, fmt, locale }, rules);
	return (
		<>
			<Section heading={dice.rules.goalHeading}>
				<Lines lines={lines.goal} />
			</Section>
			<Section heading={dice.rules.turnHeading}>
				<Lines lines={lines.turn} />
			</Section>
			<Section heading={dice.pushluck.rules.scoringHeading}>
				<Lines lines={lines.scoring} />
			</Section>
		</>
	);
}

const styles = StyleSheet.create({
	section: { gap: spacing.sm },
	box: { gap: spacing.xxs },
});
