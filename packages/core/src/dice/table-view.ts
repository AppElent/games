/**
 * What every client derives the same way from a dice table: names, the words
 * for each box's rule, what the player should do now, and the last thing that
 * happened. No drawing and no framework.
 */
import type { Messages } from "../i18n/en";
import { fmt as fill, plural } from "../i18n/format";
import {
	type Bid,
	type BiddingView,
	countMatching,
	lowestBids,
	type Reveal,
} from "./bidding";
import { type MexenThrowKind, type MexenView, throwValue } from "./mexen";
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

/** The end of a game, from this viewer's side: a tie, your win, or whose. */
export function winnerTitle(
	dice: DiceMessages,
	table: TableSeats,
	winners: readonly number[],
): string {
	if (winners.length > 1) {
		return dice.table.tie;
	}
	return winners[0] === table.you
		? dice.table.youWin
		: fill(dice.table.winner, { name: diceSeatName(dice, table, winners[0]) });
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

/** Lives drawn per row: up to six on one line, more in two even rows. */
export function mexenLivesPerRow(lives: number) {
	return lives <= 6 ? lives : Math.ceil(lives / 2);
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
 * The latest thing that happened as a sentence for a screen reader's live
 * region, so a player who cannot see the dice hears every roll, filled box,
 * bust and bank. `seq` tells two identical rolls apart, so clients announce
 * both. A Mexen move that ends a turn or a round logs several events at once
 * (a kept throw, a throw-off, a loss), so those are read out together. Points
 * are written for `locale` (10,000 or 10.000).
 */
export function latestNews(
	{ dice, fmt, locale }: { dice: DiceMessages; fmt: Fmt; locale?: string },
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
			const name = diceSeatName(dice, table, event.seat);
			const rolled = fmt(dice.table.lastRolled, {
				name,
				dice: event.dice.join(", "),
			});
			// Hot dice and its fresh roll come from one move, so they are read out together.
			const before = events[index - 1];
			return {
				seq: event.seq,
				text:
					before?.type === "hotDice"
						? `${fmt(words.lastHotDice, { name, points: num(before.points) })}. ${rolled}`
						: rolled,
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
function totals(view: ScoresheetView | PushluckView) {
	switch (view.family) {
		case "scoresheet":
			return view.sheets.map((sheet) => sheet.total);
		case "pushluck":
			return view.scores;
	}
}

/** Seats from the highest total down, ties in seat order. */
export function standings(view: ScoresheetView | PushluckView) {
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

/**
 * The latest bust, while no new roll has replaced it, so the table can show
 * the dice that bust; a bust that ended the game is followed only by its win.
 */
export function lastBust(view: PushluckView) {
	const events = view.events.filter((event) => event.type !== "win");
	const last = events.at(-1);
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

// The bidding family (liar's dice).

/** What this viewer may do at a bidding table now. */
export type BidStep = "open" | "raise" | "waiting" | "out" | "over";

export function biddingStep(view: BiddingView, you: number | null): BidStep {
	if (view.phase === "finished") {
		return "over";
	}
	if (you === null) {
		return "waiting";
	}
	if (view.diceCounts[you] === 0) {
		return "out";
	}
	if (view.turn !== you) {
		return "waiting";
	}
	return view.bids.length === 0 ? "open" : "raise";
}

/**
 * Where a bid picker starts: the lowest legal bid on the face you hold most
 * of, low faces first on a tie. Null when no bid fits on the table.
 */
export function defaultBid(
	view: Pick<BiddingView, "bids" | "totalDice" | "rules" | "yourDice">,
): Bid | null {
	// Wild ones back every other face, so they count towards it here too.
	const held = (face: number) => countMatching(view.yourDice, face, view.rules);
	return lowestBids(
		view.bids.at(-1) ?? null,
		view.totalDice,
		view.rules,
	).reduce<Bid | null>(
		(best, bid) => (!best || held(bid.face) > held(best.face) ? bid : best),
		null,
	);
}

type BidWords = { dice: DiceMessages; locale: string };

/** A bid in words: "4 dice showing 3". */
export function bidText({ dice, locale }: BidWords, bid: Bid) {
	return fill(plural(locale, bid.quantity, dice.bidding.bid), {
		face: bid.face,
	});
}

/** How a round ended, in sentences: the call, the count, and who lost a die. */
export function revealSentences(
	words: BidWords,
	table: TableSeats,
	reveal: Reveal,
): string[] {
	const { dice, locale } = words;
	const name = (seat: number) => diceSeatName(dice, table, seat);
	const bidding = dice.bidding;
	return [
		fill(reveal.call === "liar" ? bidding.revealLiar : bidding.revealSpotOn, {
			caller: name(reveal.caller),
			bidder: name(reveal.bid.seat),
			bid: bidText(words, reveal.bid),
		}),
		plural(locale, reveal.count, bidding.revealCount),
		reveal.losers.length === 1
			? fill(bidding.lostOne, { name: name(reveal.losers[0]) })
			: bidding.lostEveryoneElse,
	];
}

/**
 * The latest bid or call as a sentence for a screen reader's live region;
 * `seq` tells two identical bids apart. A call reads out the whole reveal,
 * then the viewer's freshly rolled cup when the game goes on.
 */
export function biddingNews(
	words: BidWords,
	table: TableSeats,
	view: Pick<BiddingView, "events" | "reveal" | "phase" | "yourDice">,
): { seq: number; text: string } | null {
	for (let index = view.events.length - 1; index >= 0; index -= 1) {
		const event = view.events[index];
		if (event.type === "bid") {
			return {
				seq: event.seq,
				text: fill(words.dice.bidding.lastBid, {
					name: diceSeatName(words.dice, table, event.seat),
					bid: bidText(words, event),
				}),
			};
		}
		if (event.type === "call" && view.reveal) {
			const cup =
				view.phase === "playing" && view.yourDice.length > 0
					? [
							fill(words.dice.bidding.yourDiceLabel, {
								dice: view.yourDice.join(", "),
							}),
						]
					: [];
			return {
				seq: event.seq,
				text: [...revealSentences(words, table, view.reveal), ...cup].join(" "),
			};
		}
	}
	return null;
}

/** The winner first, then whoever lasted longest; ties in seat order. */
export function biddingStandings(view: Pick<BiddingView, "outIn" | "winners">) {
	const lasted = (seat: number) =>
		view.winners.includes(seat)
			? Number.POSITIVE_INFINITY
			: (view.outIn[seat] ?? Number.POSITIVE_INFINITY);
	return view.outIn
		.map((outIn, seat) => ({ seat, outIn }))
		.sort((a, b) => lasted(b.seat) - lasted(a.seat) || a.seat - b.seat);
}
