import type { CardId } from "@arcadeclub/core/cards/deck";
import { type CardGame, resolvedRules } from "@arcadeclub/core/cards/engine";
import type { CardPower } from "@arcadeclub/core/cards/shedding";
import {
	powerEffect,
	tricksRuleLines,
} from "@arcadeclub/core/cards/table-view";
import { fmt, useMessages } from "#/lib/i18n";
import { Sheet } from "./Chrome";
import { PlayingCard } from "./PlayingCard";
import { useCardWords } from "./useCardWords";

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

function Lines({ lines }: { lines: string[] }) {
	return (
		<ul className="flex flex-col gap-1.5 text-sm leading-snug">
			{lines.map((line) => (
				<li key={line}>{line}</li>
			))}
		</ul>
	);
}

function TricksRules({ lines }: { lines: ReturnType<typeof tricksRuleLines> }) {
	const r = useMessages().games.cards.rules;
	return (
		<>
			<Section heading={r.goalHeading}>
				<p className="text-sm leading-snug">{lines.goal}</p>
			</Section>
			{lines.passing.length > 0 ? (
				<Section heading={r.passHeading}>
					<Lines lines={lines.passing} />
				</Section>
			) : null}
			<Section heading={r.turnHeading}>
				<Lines lines={lines.turn} />
			</Section>
			{lines.stakes.length > 0 ? (
				<Section heading={r.stakesHeading}>
					<Lines lines={lines.stakes} />
				</Section>
			) : null}
			{lines.points.length > 0 ? (
				<Section heading={r.pointsHeading}>
					<Lines lines={lines.points} />
				</Section>
			) : null}
		</>
	);
}

/**
 * Written from the game's config and the table's house rules, so a new game
 * gets correct rules without anyone writing them twice.
 */
export function RulesSheet({
	game,
	options,
	open,
	onClose,
}: {
	game: CardGame;
	options: readonly string[];
	open: boolean;
	onClose: () => void;
}) {
	const cards = useMessages().games.cards;
	const words = useCardWords();
	const text = cards.games[game.id];
	const optionText = text.options as Record<
		string,
		{ label: string; hint: string }
	>;
	const resolved = resolvedRules(game, options);
	const r = cards.rules;
	const active = options.map((id) => optionText[id]).filter(Boolean);

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
						<p className="text-sm leading-snug">{r.shedding.goal}</p>
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
							<ul className="flex flex-col gap-2">
								{Object.entries(resolved.rules.powers).map(([key, power]) => {
									const sample: CardId = key === "joker" ? "JK#0" : `S${key}#0`;
									const powers = text.powers as Record<string, string>;
									return (
										<li key={key} className="flex items-center gap-3">
											<PlayingCard card={sample} />
											<div className="min-w-0 text-sm leading-snug">
												<p className="font-bold">{powers[key]}</p>
												<p className="text-[var(--ivory-muted)]">
													{effect(power as CardPower)}
												</p>
											</div>
										</li>
									);
								})}
							</ul>
						</Section>
					) : null}
				</>
			) : resolved.family === "rummy" ? (
				<>
					<Section heading={r.goalHeading}>
						<p className="text-sm leading-snug">
							{fmt(r.rummy.goal, { rounds: resolved.rules.rounds })}
						</p>
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
						<p className="text-sm leading-snug">
							{fmt(r.rummy.points, {
								face: resolved.rules.points.K,
								ace: resolved.rules.points.A,
								lowAce: resolved.rules.lowAcePoints,
								joker: resolved.rules.jokerPoints,
							})}
						</p>
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
