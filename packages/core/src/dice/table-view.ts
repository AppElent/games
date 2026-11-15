/**
 * What every client derives the same way from a dice table: names, the words
 * for each box's rule, what the player should do now, and the last thing that
 * happened. No drawing and no framework.
 */
import type { Messages } from "../i18n/en";
import type { DiceView } from "./engine";
import {
	canBankTurn,
	kindScore,
	type PushluckRules,
	type PushluckView,
	scoreSetAside,
} from "./pushluck";
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

/**
 * The latest thing that happened as a sentence for a screen reader's live
 * region, so a player who cannot see the dice hears every roll, filled box,
 * bust and bank. `seq` tells two identical rolls apart, so clients announce
 * both. Points are written for `locale` (10,000 or 10.000).
 */
export function latestNews(
	{ dice, fmt, locale }: { dice: DiceMessages; fmt: Fmt; locale?: string },
	table: TableSeats,
	events: readonly DiceEvent[],
): { seq: number; text: string } | null {
	const words = dice.pushluck.table;
	const num = (value: number) => value.toLocaleString(locale);
	for (let index = events.length - 1; index >= 0; index -= 1) {
		const event = events[index];
		if (event.type === "bust") {
			return {
				seq: event.seq,
				text: fmt(event.lost > 0 ? words.lastBust : words.lastBustEmpty, {
					name: diceSeatName(dice, table, event.seat),
					points: num(event.lost),
				}),
			};
		}
		if (event.type === "bank") {
			return {
				seq: event.seq,
				text: fmt(words.lastBank, {
					name: diceSeatName(dice, table, event.seat),
					points: num(event.points),
					total: num(event.total),
				}),
			};
		}
		if (event.type === "finalRound") {
			return {
				seq: event.seq,
				text: fmt(words.lastFinalRound, {
					name: diceSeatName(dice, table, event.seat),
				}),
			};
		}
		if (event.type === "roll") {
			return {
				seq: event.seq,
				text: fmt(dice.table.lastRolled, {
					name: diceSeatName(dice, table, event.seat),
					dice: event.dice.join(", "),
				}),
			};
		}
		if (event.type === "score") {
			return {
				seq: event.seq,
				text: fmt(dice.table.lastScored, {
					name: diceSeatName(dice, table, event.seat),
					points: event.points + event.bonus,
					category: dice.categories[event.category as ScoreCategory],
				}),
			};
		}
	}
	return null;
}

/** Each seat's score as the family keeps it. */
function totals(view: DiceView) {
	switch (view.family) {
		case "scoresheet":
			return view.sheets.map((sheet) => sheet.total);
		case "pushluck":
			return view.scores;
	}
}

/** Seats from the highest total down, ties in seat order. */
export function standings(view: DiceView) {
	return totals(view)
		.map((total, seat) => ({ seat, total }))
		.sort((a, b) => b.total - a.total || a.seat - b.seat);
}

/** What this viewer should do now at a push-your-luck table. */
export type PushluckStep = "start" | "pick" | "waiting" | "over";

export function pushluckStep(
	view: PushluckView,
	you: number | null,
): PushluckStep {
	if (view.phase === "finished") {
		return "over";
	}
	if (you === null || view.turn !== you) {
		return "waiting";
	}
	return view.dice.length === 0 ? "start" : "pick";
}

/**
 * What the dice picked on this device would do: their points, the turn total
 * with them, which buttons work, and why not. The server checks it all again.
 */
export function pushluckPick(view: PushluckView, picked: readonly boolean[]) {
	const { rules } = view;
	const kept = view.dice.filter((_, index) => picked[index]);
	const points = kept.length > 0 ? scoreSetAside(rules, kept) : null;
	const total = view.turnTotal + (points ?? 0);
	const left = view.dice.length - kept.length;
	const banked = view.scores[view.turn] ?? 0;
	const problem: "pickFirst" | "notScoring" | "needOpening" | null =
		kept.length === 0
			? "pickFirst"
			: points === null
				? "notScoring"
				: !canBankTurn(rules, banked, total)
					? "needOpening"
					: null;
	return {
		keep: picked.flatMap((on, index) => (on ? [index] : [])),
		points,
		total,
		/** How many dice the next roll throws: all of them again after hot dice. */
		rollCount: left === 0 ? rules.dice : left,
		hotDice: kept.length > 0 && left === 0,
		canRoll: points !== null,
		canBank: points !== null && canBankTurn(rules, banked, total),
		problem,
	};
}

/** The latest bust, while no new roll has replaced it, so the table can show the dice that bust. */
export function lastBust(view: PushluckView) {
	const last = view.events.at(-1);
	return last?.type === "bust" && view.dice.length === 0 ? last : null;
}

/** The rules of a push-your-luck game in words, from its config and house rules. */
export function pushluckRuleLines(
	{ dice, fmt, locale }: { dice: DiceMessages; fmt: Fmt; locale?: string },
	rules: PushluckRules,
) {
	const r = dice.pushluck.rules;
	const num = (value: number) => value.toLocaleString(locale);
	const target = num(rules.target);
	const goal = [
		fmt(r.goal, { target }),
		fmt(rules.finalRound ? r.finalRound : r.noFinalRound, { target }),
	];
	const turn = [
		fmt(r.turnRoll, { dice: rules.dice }),
		r.turnChoice,
		r.bust,
		fmt(r.hotDice, { dice: rules.dice }),
		...(rules.openingScore > 0
			? [fmt(r.opening, { points: num(rules.openingScore) })]
			: []),
	];
	const many = rules.manyOfAKind;
	const scoring = [
		...Object.entries(rules.singles).map(([face, points]) =>
			fmt(r.single, { face, points: num(points ?? 0) }),
		),
		fmt(r.threeKind, {
			perFace: num(rules.threeOfAKind.perFace),
			ones: num(rules.threeOfAKind.ones),
		}),
		many.kind === "double"
			? r.manyDouble
			: fmt(r.manyFixed, {
					four: num(kindScore(rules, 2, 4)),
					five: num(kindScore(rules, 2, 5)),
					six: num(kindScore(rules, 2, 6)),
				}),
		...(rules.threePairs !== null
			? [fmt(r.threePairs, { points: num(rules.threePairs) })]
			: []),
		...(rules.straight !== null
			? [fmt(r.straight, { points: num(rules.straight) })]
			: []),
		r.sameRoll,
	];
	return { goal, turn, scoring };
}
