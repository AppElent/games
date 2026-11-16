import { type DiceGame, diceRules } from "@arcadeclub/core/dice/engine";
import { categoryEffect } from "@arcadeclub/core/dice/table-view";
import { Sheet } from "#/components/table/Chrome";
import { fmt, useMessages } from "#/lib/i18n";

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

/**
 * Written from the game's config and the table's house rules: every box's
 * line comes from its rule, so a new sheet needs no new text.
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
				<p className="text-sm leading-snug">
					{fmt(r.goal, { rounds: rules.sheet.length })}
				</p>
			</Section>
			<Section heading={r.turnHeading}>
				<ul className="flex flex-col gap-1.5 text-sm leading-snug">
					<li>
						{fmt(r.turnRoll, { dice: rules.dice, rolls: rules.rollsPerTurn })}
					</li>
					<li>{r.turnScore}</li>
				</ul>
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
