import type { CardId } from "@arcadeclub/core/cards/deck";
import { type CardGame, resolvedRules } from "@arcadeclub/core/cards/engine";
import type { CardPower } from "@arcadeclub/core/cards/shedding";
import { fmt, useMessages } from "#/lib/i18n";
import { Sheet } from "./Chrome";
import { PlayingCard } from "./PlayingCard";

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
	const text = cards.games[game.id];
	const optionText = text.options as Record<
		string,
		{ label: string; hint: string }
	>;
	const resolved = resolvedRules(game, options);
	const r = cards.rules;
	const active = options.map((id) => optionText[id]).filter(Boolean);

	const effect = (power: CardPower) => {
		switch (power.kind) {
			case "draw":
				return fmt(power.wild ? r.effects.drawWild : r.effects.draw, {
					count: power.amount,
				});
			case "reverse":
				return resolved.family === "shedding" &&
					resolved.rules.twoPlayerReverseAgain
					? r.effects.reverseDuel
					: r.effects.reverse;
			default:
				return r.effects[power.kind];
		}
	};

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
				</>
			) : (
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
