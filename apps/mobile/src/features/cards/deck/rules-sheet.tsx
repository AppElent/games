/**
 * How to play, written from the game's config and the table's house rules, so
 * a new game gets correct rules without anyone writing them twice.
 */
import type { CardId } from "@arcadeclub/core/cards/deck";
import {
	activeOptions,
	type CardGameDefinition,
	type CardGameId,
	resolvedRules,
} from "@arcadeclub/core/cards/engine";
import type { CardPower } from "@arcadeclub/core/cards/shedding";
import {
	powerEffect,
	tricksRuleLines,
	tricksRuleSections,
} from "@arcadeclub/core/cards/table-view";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { fmt, useI18n } from "../../../i18n";
import { spacing } from "../../../theme";
import { Sheet } from "../../../ui/sheet";
import { AppText } from "../../../ui/text";
import { PlayingCard } from "./playing-card";
import { useCardWords } from "./use-card-words";

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

function Lines({ lines }: { lines: string[] }) {
	return lines.map((line) => (
		<AppText key={line} variant="secondary" tone="default">
			{line}
		</AppText>
	));
}

function TricksRules({ lines }: { lines: ReturnType<typeof tricksRuleLines> }) {
	const { t } = useI18n();
	const cards = t.games.cards;
	return (
		<>
			<Section heading={cards.rules.goalHeading}>
				<Lines lines={[lines.goal]} />
			</Section>
			{tricksRuleSections(lines, cards).map((section) => (
				<Section key={section.heading} heading={section.heading}>
					<Lines lines={section.lines} />
				</Section>
			))}
		</>
	);
}

export function RulesSheet({
	game,
	options,
	seats,
	open,
	onClose,
}: {
	game: CardGameDefinition;
	options: readonly string[];
	/** The table's size, or null while friends are still joining. */
	seats: number | null;
	open: boolean;
	onClose: () => void;
}) {
	const { t, locale } = useI18n();
	const cards = t.games.cards;
	const words = useCardWords();
	const text = cards.games[game.id as CardGameId];
	const optionText = text.options as Record<
		string,
		{ label: string; hint: string }
	>;
	const resolved = resolvedRules(game, options, seats);
	const r = cards.rules;
	const active = activeOptions(game, options, seats)
		.map((id) => optionText[id])
		.filter(Boolean);

	const effect = (power: CardPower) =>
		powerEffect(
			{ cards, fmt },
			resolved.family === "shedding"
				? resolved.rules
				: { twoPlayerReverseAgain: false },
			power,
		);

	return (
		<Sheet
			open={open}
			onClose={onClose}
			title={fmt(r.heading, { game: text.name })}
		>
			{resolved.family === "shedding" ? (
				<>
					<Section heading={r.goalHeading}>
						<Lines lines={[r.shedding.goal]} />
					</Section>
					<Section heading={r.turnHeading}>
						<Lines
							lines={[
								r.shedding.match,
								resolved.rules.voluntaryDraw
									? r.shedding.draw
									: r.shedding.mustPlay,
								resolved.rules.playDrawnCard
									? r.shedding.drawPlay
									: r.shedding.drawNoPlay,
								resolved.rules.stackDraws
									? r.shedding.stack
									: r.shedding.noStack,
								...(resolved.rules.lastCardPenalty !== null
									? [
											fmt(r.shedding.lastCard, {
												count: resolved.rules.lastCardPenalty,
											}),
										]
									: []),
								...(resolved.rules.finishOnPowerPenalty !== null
									? [
											fmt(r.shedding.finishPower, {
												count: resolved.rules.finishOnPowerPenalty,
											}),
										]
									: []),
							]}
						/>
					</Section>
					{Object.keys(resolved.rules.powers).length > 0 ? (
						<Section heading={r.powersHeading}>
							{Object.entries(resolved.rules.powers).map(([key, power]) => {
								const sample: CardId = key === "joker" ? "JK#0" : `S${key}#0`;
								const powers = text.powers as Record<string, string>;
								return (
									<View key={key} style={styles.power}>
										<PlayingCard card={sample} width={44} />
										<View style={styles.powerText}>
											<AppText variant="body">{powers[key]}</AppText>
											<AppText variant="secondary">
												{effect(power as CardPower)}
											</AppText>
										</View>
									</View>
								);
							})}
						</Section>
					) : null}
				</>
			) : resolved.family === "gin" ? (
				<>
					<Section heading={r.goalHeading}>
						<Lines
							lines={[fmt(r.gin.goal, { target: resolved.rules.targetScore })]}
						/>
					</Section>
					<Section heading={r.turnHeading}>
						<Lines
							lines={[
								r.gin.turnDraw,
								r.gin.turnDiscard,
								fmt(r.gin.knock, { limit: resolved.rules.knockLimit }),
								fmt(r.gin.gin, { bonus: resolved.rules.ginBonus }),
								r.gin.layoff,
								r.gin.score,
								fmt(r.gin.undercut, { bonus: resolved.rules.undercutBonus }),
								fmt(r.gin.void, { count: resolved.rules.stockFloor }),
							]}
						/>
					</Section>
					<Section heading={r.meldsHeading}>
						<Lines lines={[r.gin.set, r.gin.run]} />
					</Section>
					<Section heading={r.pointsHeading}>
						<Lines
							lines={[fmt(r.gin.points, { face: resolved.rules.points.K })]}
						/>
					</Section>
				</>
			) : resolved.family === "rummy" ? (
				<>
					<Section heading={r.goalHeading}>
						<Lines
							lines={[fmt(r.rummy.goal, { rounds: resolved.rules.rounds })]}
						/>
					</Section>
					<Section heading={r.turnHeading}>
						<Lines
							lines={[
								resolved.rules.takeFromDiscard
									? r.rummy.turnDraw
									: r.rummy.turnDrawStock,
								r.rummy.turnLay,
								r.rummy.turnDiscard,
								r.rummy.noEarlyOut,
								fmt(r.rummy.opening, { points: resolved.rules.openingPoints }),
							]}
						/>
					</Section>
					<Section heading={r.meldsHeading}>
						<Lines
							lines={[
								fmt(r.rummy.set, { min: resolved.rules.minMeldSize }),
								fmt(r.rummy.run, { min: resolved.rules.minMeldSize }),
								fmt(r.rummy.joker, { count: resolved.rules.minNaturals }),
							]}
						/>
					</Section>
					<Section heading={r.pointsHeading}>
						<Lines
							lines={[
								fmt(r.rummy.points, {
									face: resolved.rules.points.K,
									ace: resolved.rules.points.A,
									lowAce: resolved.rules.lowAcePoints,
									joker: resolved.rules.jokerPoints,
								}),
							]}
						/>
					</Section>
				</>
			) : resolved.family === "bank" ? (
				<>
					<Section heading={r.goalHeading}>
						<Lines
							lines={[fmt(r.bank.goal, { rounds: resolved.rules.rounds })]}
						/>
					</Section>
					<Section heading={r.turnHeading}>
						<Lines
							lines={[
								fmt(r.bank.stake, {
									stakes: resolved.rules.stakes.join(", "),
								}),
								r.bank.values,
								r.bank.hit,
								...(resolved.rules.doubleDown ? [r.bank.double] : []),
							]}
						/>
					</Section>
					<Section heading={r.bankHeading}>
						<Lines
							lines={[
								fmt(r.bank.bank, { stand: resolved.rules.bankStandsOn }),
								...(resolved.rules.bankHitsSoft
									? [
											fmt(r.bank.bankSoft, {
												stand: resolved.rules.bankStandsOn,
											}),
										]
									: []),
								r.bank.bankNatural,
							]}
						/>
					</Section>
					<Section heading={r.pointsHeading}>
						<Lines
							lines={[
								r.bank.payout,
								fmt(r.bank.natural, {
									pays: resolved.rules.naturalPays.toLocaleString(locale),
								}),
							]}
						/>
					</Section>
				</>
			) : (
				<TricksRules lines={tricksRuleLines(words, resolved.rules)} />
			)}
			{active.length > 0 ? (
				<Section heading={r.extrasHeading}>
					<Lines
						lines={active.map((option) => `${option.label}: ${option.hint}`)}
					/>
				</Section>
			) : null}
		</Sheet>
	);
}

const styles = StyleSheet.create({
	section: { gap: spacing.sm },
	power: { flexDirection: "row", alignItems: "center", gap: spacing.md },
	powerText: { flex: 1, gap: spacing.xxs },
});
