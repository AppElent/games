import { type DiceGame, diceRules } from "@arcadeclub/core/dice/engine";
import type { PushluckRules } from "@arcadeclub/core/dice/pushluck";
import type { ScoresheetRules } from "@arcadeclub/core/dice/scoresheet";
import {
	categoryEffect,
	pushluckRuleLines,
} from "@arcadeclub/core/dice/table-view";
import { Sheet } from "#/components/table/Chrome";
import { fmt, useI18n, useMessages } from "#/lib/i18n";

function Section({
	heading,
	children,
}: {
	heading: string;
	children: React.ReactNode;
}) {
	return (
		<section className="mb-5 last:mb-0">
			<h3 className="cards-kicker mb-2">{heading}</h3>
			{children}
		</section>
	);
}

function Lines({ lines }: { lines: readonly string[] }) {
	return (
		<ul className="flex flex-col gap-1.5 text-sm leading-snug">
			{lines.map((line) => (
				<li key={line}>{line}</li>
			))}
		</ul>
	);
}

/**
 * Written from the game's config and the table's house rules: every line
 * comes from a rule, so a new game in a family needs no new text.
 */
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
	const dice = useMessages().games.dice;
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
					<ul className="flex flex-col gap-1.5 text-sm leading-snug">
						{active.map((option) => (
							<li key={option.label}>
								{option.label}: {option.hint}
							</li>
						))}
					</ul>
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
	const dice = useMessages().games.dice;
	const r = dice.rules;
	return (
		<>
			<Section heading={r.goalHeading}>
				<p className="text-sm leading-snug">
					{fmt(r.goal, { rounds: rules.sheet.length })}
				</p>
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
				<dl className="dice-rules-boxes text-sm leading-snug">
					{rules.sheet.map((entry) => (
						<div key={entry.id}>
							<dt className="font-bold">{dice.categories[entry.id]}</dt>
							<dd className="text-[var(--ivory-muted)]">
								{categoryEffect({ dice, fmt }, entry.rule, rules.dice)}
							</dd>
						</div>
					))}
				</dl>
				<p className="mt-3 text-sm leading-snug">
					{fmt(r.upperBonus, rules.upperBonus)}
				</p>
				{rules.extraAllSame ? (
					<p className="mt-1.5 text-sm leading-snug">
						{fmt(r.extraAllSame, rules.extraAllSame)}
					</p>
				) : null}
			</Section>
		</>
	);
}

function PushluckRulesBody({ rules }: { rules: PushluckRules }) {
	const { locale } = useI18n();
	const dice = useMessages().games.dice;
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
