/**
 * What every client derives the same way from a dice table: names, the words
 * for each box's rule, what the player should do now, and the last thing that
 * happened. No drawing and no framework.
 */
import type { Messages } from "../i18n/en";
import { type MexenThrowKind, type MexenView, throwValue } from "./mexen";
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

/** A Mexen throw in words: "Mex", "Double 4", "63". */
export function mexenThrowLabel(
	dice: DiceMessages,
	fmt: Fmt,
	thrown: { kind: MexenThrowKind; value: number },
) {
	const words = dice.mexen.throws;
	switch (thrown.kind) {
		case "mex":
			return words.mex;
		case "littleMex":
			return words.littleMex;
		case "double":
			return fmt(words.double, { face: thrown.value % 10 });
		case "plain":
			return fmt(words.plain, { value: thrown.value });
	}
}

/** What this viewer should do now in a Mexen round. */
export type MexenTurnStep = "start" | "decide" | "waiting" | "over";

export function mexenTurnStep(
	view: MexenView,
	you: number | null,
): MexenTurnStep {
	if (view.phase === "finished") {
		return "over";
	}
	if (you === null || view.turn !== you) {
		return "waiting";
	}
	return view.rollsUsed === 0 ? "start" : "decide";
}

/**
 * Mexen seats from best to worst: fewest lives lost (or points) first; anyone
 * out ranks below everyone still in, the last to go out highest. Ties keep seat order.
 */
export function mexenStandings(view: MexenView): number[] {
	const outAt = (seat: number) => view.eliminated.indexOf(seat);
	return view.penalties
		.map((_, seat) => seat)
		.sort((a, b) => {
			const outA = outAt(a);
			const outB = outAt(b);
			if (outA !== -1 || outB !== -1) {
				// Still in (-1) beats out; later out beats earlier.
				return (
					(outB === -1 ? Infinity : outB) - (outA === -1 ? Infinity : outA)
				);
			}
			return view.penalties[a] - view.penalties[b] || a - b;
		});
}

function mexenNews(
	{ dice, fmt }: { dice: DiceMessages; fmt: Fmt },
	table: TableSeats,
	event: DiceEvent,
) {
	const words = dice.mexen;
	const name = (seat: number) => diceSeatName(dice, table, seat);
	switch (event.type) {
		case "mexenStand":
			return fmt(words.lastStand, {
				name: name(event.seat),
				throw: mexenThrowLabel(dice, fmt, {
					kind: event.kind,
					value: throwValue(event.dice),
				}),
			});
		case "mexenThrowOff":
			return fmt(words.lastThrowOff, {
				names: event.seats.map(name).join(", "),
			});
		case "mexenLose": {
			const template =
				event.unit === "lives"
					? event.amount === 1
						? words.lastLoseLife
						: words.lastLoseLives
					: event.amount === 1
						? words.lastLosePoint
						: words.lastLosePoints;
			const text = fmt(template, {
				name: name(event.seat),
				count: event.amount,
			});
			return event.out
				? `${text}. ${fmt(words.lastOut, { name: name(event.seat) })}`
				: text;
		}
		default:
			return null;
	}
}

/**
 * The latest roll or score as a sentence for a screen reader's live region, so
 * a player who cannot see the dice hears every roll and every filled box. `seq`
 * tells two identical rolls apart, so clients announce both. A Mexen move that
 * ends a turn or a round logs several events at once (a kept throw, a
 * throw-off, a loss), so those are read out together.
 */
export function latestNews(
	{ dice, fmt }: { dice: DiceMessages; fmt: Fmt },
	table: TableSeats,
	events: readonly DiceEvent[],
): { seq: number; text: string } | null {
	const told: string[] = [];
	let toldSeq: number | null = null;
	for (let index = events.length - 1; index >= 0; index -= 1) {
		const event = events[index];
		if (event.type === "win" && told.length === 0) {
			continue;
		}
		const line = mexenNews({ dice, fmt }, table, event);
		if (line === null) {
			break;
		}
		told.unshift(line);
		toldSeq ??= events[events.length - 1].seq;
	}
	if (toldSeq !== null) {
		return { seq: toldSeq, text: told.join(". ") };
	}
	for (let index = events.length - 1; index >= 0; index -= 1) {
		const event = events[index];
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

/** Seats from the highest total down, ties in seat order. */
export function standings(view: ScoresheetView) {
	return view.sheets
		.map((sheet, seat) => ({ seat, total: sheet.total }))
		.sort((a, b) => b.total - a.total || a.seat - b.seat);
}
