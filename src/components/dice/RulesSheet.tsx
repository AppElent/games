import {
	type BiddingGame,
	type DiceGame,
	diceRules,
	type MexenGame,
	type ScoresheetGame,
} from "@arcadeclub/core/dice/engine";
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
	const active = options.map((id) => optionText[id]).filter(Boolean);

	return (
		<Sheet
			open={open}
			onClose={onClose}
			title={fmt(dice.rules.heading, { game: text.name })}
		>
			{game.family === "scoresheet" ? (
				<ScoresheetRules game={game} options={options} />
			) : game.family === "mexen" ? (
				<MexenRules game={game} options={options} />
			) : (
				<BiddingRules game={game} options={options} />
			)}
			{active.length > 0 ? (
				<Section heading={dice.rules.extrasHeading}>
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

function ScoresheetRules({
	game,
	options,
}: {
	game: ScoresheetGame;
	options: readonly string[];
}) {
	const dice = useMessages().games.dice;
	const rules = diceRules(game, options);
	const r = dice.rules;
	return (
		<>
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
	const dice = useMessages().games.dice;
	const rules = diceRules(game, options);
	const r = dice.mexen.rules;
	const lives = rules.scoring === "lives";
	return (
		<>
			<Section heading={dice.rules.goalHeading}>
				<p className="text-sm leading-snug">
					{lives
						? fmt(r.goalLives, { lives: rules.lives })
						: fmt(r.goalPoints, { limit: rules.lives })}
				</p>
			</Section>
			<Section heading={r.roundHeading}>
				<ul className="flex flex-col gap-1.5 text-sm leading-snug">
					<li>{fmt(r.leader, { throws: rules.maxThrows })}</li>
					<li>{r.others}</li>
					<li>{r.loser}</li>
					{rules.mexDoubles ? (
						<li>{lives ? r.mexDoublesLives : r.mexDoublesPoints}</li>
					) : null}
				</ul>
			</Section>
			<Section heading={r.rankHeading}>
				<p className="mb-1.5 text-sm leading-snug">{r.read}</p>
				<ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm leading-snug">
					<li>{r.mex}</li>
					{rules.littleMex ? <li>{r.littleMex}</li> : null}
					<li>{r.doubles}</li>
					<li>{fmt(r.plain, { lowest: rules.littleMex ? 32 : 31 })}</li>
				</ol>
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
	const dice = useMessages().games.dice;
	const rules = diceRules(game, options);
	const r = dice.rules;
	const b = r.bidding;
	return (
		<>
			<Section heading={r.goalHeading}>
				<p className="text-sm leading-snug">{b.goal}</p>
			</Section>
			<Section heading={b.roundHeading}>
				<ul className="flex flex-col gap-1.5 text-sm leading-snug">
					<li>{fmt(b.roll, { dice: rules.startingDice })}</li>
					<li>{b.bid}</li>
					<li>{b.call}</li>
					{rules.wildOnes ? <li>{b.wildOnes}</li> : null}
					{rules.spotOn ? <li>{b.spotOn}</li> : null}
					<li>{b.next}</li>
				</ul>
			</Section>
		</>
	);
}
