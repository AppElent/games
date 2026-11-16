/**
 * What every client derives the same way from a dice table: names, the words
 * for each box's rule, what the player should do now, and the last thing that
 * happened. No drawing and no framework.
 */
import type { Messages } from "../i18n/en";
import { fmt as fill, plural } from "../i18n/format";
import { type Bid, type BiddingView, lowestBids, type Reveal } from "./bidding";
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

/**
 * The latest roll or score as a sentence for a screen reader's live region, so
 * a player who cannot see the dice hears every roll and every filled box. `seq`
 * tells two identical rolls apart, so clients announce both.
 */
export function latestNews(
	{ dice, fmt }: { dice: DiceMessages; fmt: Fmt },
	table: TableSeats,
	events: readonly DiceEvent[],
): { seq: number; text: string } | null {
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
	const held = (face: number) =>
		view.yourDice.filter((value) => value === face).length;
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
