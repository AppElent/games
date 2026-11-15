/**
 * What every client derives the same way from a dice table: names, the words
 * for each box's rule, what the player should do now, and the last thing that
 * happened. No drawing and no framework.
 */
import type { Messages } from "../i18n/en";
import type { CategoryRule, ScoreCategory, ScoresheetView } from "./scoresheet";
import type { DiceEvent } from "./table";

export type DiceMessages = Messages["games"]["dice"];

type Fmt = (
	template: string,
	params: Record<string, string | number>,
) => string;

type TableSeat = { botIndex: number | null; name: string | null };
type TableSeats = { seats: readonly TableSeat[]; you: number | null };

export function diceSeatName(
	dice: DiceMessages,
	table: TableSeats,
	seat: number,
): string {
	if (seat === table.you) {
		return dice.table.you;
	}
	const entry = table.seats[seat];
	if (entry?.botIndex !== null && entry?.botIndex !== undefined) {
		return (dice.bots as Record<string, string>)[`bot${entry.botIndex}`];
	}
	return entry?.name ?? dice.table.youFallback;
}

/** How a box scores, in words, from its rule: a new sheet needs no new text. */
export function categoryEffect(
	{ dice, fmt }: { dice: DiceMessages; fmt: Fmt },
	rule: CategoryRule,
	diceCount: number,
) {
	const effects = dice.rules.effects;
	switch (rule.kind) {
		case "face":
			return fmt(effects.face, { face: rule.face });
		case "pairs":
			return rule.pairs === 1 ? effects.onePair : effects.twoPairs;
		case "kind":
			return fmt(
				rule.score === "all" ? effects.kindAll : effects.kindMatching,
				{
					count: rule.count,
				},
			);
		case "straight":
			if (rule.from !== undefined) {
				const to = rule.from + rule.length - 1;
				const points =
					rule.points === "sum"
						? ((rule.from + to) * rule.length) / 2
						: rule.points;
				return fmt(effects.straightFixed, { from: rule.from, to, points });
			}
			return fmt(effects.straightAny, {
				length: rule.length,
				points: rule.points === "sum" ? "" : rule.points,
			});
		case "fullHouse":
			return rule.points === "sum"
				? effects.fullHouseSum
				: fmt(effects.fullHousePoints, { points: rule.points });
		case "chance":
			return effects.chance;
		case "allSame":
			return fmt(effects.allSame, { count: diceCount, points: rule.points });
	}
}

/** What this viewer should do now. */
export type DiceTurnStep = "start" | "hold" | "score" | "waiting" | "over";

export function turnStep(
	view: ScoresheetView,
	you: number | null,
): DiceTurnStep {
	if (view.phase === "finished") {
		return "over";
	}
	if (you === null || view.turn !== you) {
		return "waiting";
	}
	if (view.rollsUsed === 0) {
		return "start";
	}
	return view.rollsUsed >= view.rollsPerTurn ? "score" : "hold";
}

/** The last box filled at the table, for a caption. */
export function lastScore(events: readonly DiceEvent[]) {
	for (let index = events.length - 1; index >= 0; index -= 1) {
		const event = events[index];
		if (event.type === "score") {
			return {
				seat: event.seat,
				category: event.category as ScoreCategory,
				points: event.points,
				bonus: event.bonus,
				seq: event.seq,
			};
		}
	}
	return null;
}

/** Seats from the highest total down, ties in seat order. */
export function standings(view: ScoresheetView) {
	return view.sheets
		.map((sheet, seat) => ({ seat, total: sheet.total }))
		.sort((a, b) => b.total - a.total || a.seat - b.seat);
}
