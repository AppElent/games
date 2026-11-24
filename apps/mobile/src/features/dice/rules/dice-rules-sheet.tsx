/**
 * How to play, written from the game's config and the table's house rules:
 * every box's line comes from its rule, so a new sheet needs no new text.
 */
import {
	type BiddingGame,
	type DiceGame,
	diceRules,
	type MexenGame,
	type PushluckGame,
	type ScoresheetGame,
} from "@arcadeclub/core/dice/engine";
import {
	categoryEffect,
	pushluckRuleLines,
} from "@arcadeclub/core/dice/table-view";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { fmt, useI18n } from "../../../i18n";
import { spacing } from "../../../theme";
import { Sheet } from "../../../ui/sheet";
import { AppText } from "../../../ui/text";

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
	const active = options.map((id) => optionText[id]).filter(Boolean);

	return (
		<Sheet
			open={open}
			onClose={onClose}
			title={fmt(dice.rules.heading, { game: text.name })}
		>
			<RulesBody game={game} options={options} />
			{active.length > 0 ? (
				<Section heading={dice.rules.extrasHeading}>
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
			return <ScoresheetRules game={game} options={options} />;
		case "pushluck":
			return <PushluckRules game={game} options={options} />;
		case "mexen":
			return <MexenRules game={game} options={options} />;
		case "bidding":
			return <BiddingRules game={game} options={options} />;
	}
}

function Lines({ lines }: { lines: readonly string[] }) {
	return lines.map((line) => (
		<AppText key={line} variant="secondary" tone="default">
			{line}
		</AppText>
	));
}

function ScoresheetRules({
	game,
	options,
}: {
	game: ScoresheetGame;
	options: readonly string[];
}) {
	const { t } = useI18n();
	const dice = t.games.dice;
	const rules = diceRules(game, options);
	const r = dice.rules;
	return (
		<>
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
		</>
	);
}

function MexenRules({
	game,
	options,
}: {
	game: MexenGame;
	options: readonly string[];
}) {
	const { t } = useI18n();
	const dice = t.games.dice;
	const rules = diceRules(game, options);
	const r = dice.mexen.rules;
	const lives = rules.scoring === "lives";
	const line = (text: string) => (
		<AppText key={text} variant="secondary" tone="default">
			{text}
		</AppText>
	);
	return (
		<>
			<Section heading={dice.rules.goalHeading}>
				{line(
					lives
						? fmt(r.goalLives, { lives: rules.lives })
						: fmt(r.goalPoints, { limit: rules.lives }),
				)}
			</Section>
			<Section heading={r.roundHeading}>
				{line(fmt(r.leader, { throws: rules.maxThrows }))}
				{line(r.others)}
				{line(r.loser)}
				{rules.mexDoubles
					? line(lives ? r.mexDoublesLives : r.mexDoublesPoints)
					: null}
			</Section>
			<Section heading={r.rankHeading}>
				{line(r.read)}
				{line(r.mex)}
				{rules.littleMex ? line(r.littleMex) : null}
				{line(r.doubles)}
				{line(fmt(r.plain, { lowest: rules.littleMex ? 32 : 31 }))}
			</Section>
		</>
	);
}

function PushluckRules({
	game,
	options,
}: {
	game: PushluckGame;
	options: readonly string[];
}) {
	const { t, locale } = useI18n();
	const dice = t.games.dice;
	const lines = pushluckRuleLines(
		{ dice, fmt, locale },
		diceRules(game, options),
	);
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

/** The round, then each house rule that changes it, said in full. */
function BiddingRules({
	game,
	options,
}: {
	game: BiddingGame;
	options: readonly string[];
}) {
	const { t } = useI18n();
	const r = t.games.dice.rules;
	const b = r.bidding;
	const rules = diceRules(game, options);
	const lines = [
		fmt(b.roll, { dice: rules.startingDice }),
		b.bid,
		b.call,
		...(rules.wildOnes ? [b.wildOnes] : []),
		...(rules.spotOn ? [b.spotOn] : []),
		b.next,
	];
	return (
		<>
			<Section heading={r.goalHeading}>
				<AppText variant="secondary" tone="default">
					{b.goal}
				</AppText>
			</Section>
			<Section heading={b.roundHeading}>
				{lines.map((line) => (
					<AppText key={line} variant="secondary" tone="default">
						{line}
					</AppText>
				))}
			</Section>
		</>
	);
}

const styles = StyleSheet.create({
	section: { gap: spacing.sm },
	box: { gap: spacing.xxs },
});
