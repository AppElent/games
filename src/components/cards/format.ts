import {
	type CardId,
	parseCard,
	RANKS,
	SUITS,
} from "@arcadeclub/core/cards/deck";
import type { CardEvent } from "@arcadeclub/core/cards/events";
import { fmt, type Messages, plural } from "#/lib/i18n";
import type { CardTableBundle } from "./useCardTable";

type CardMessages = Messages["games"]["cards"];

export function seatName(
	cards: CardMessages,
	table: Pick<CardTableBundle, "seats" | "you">,
	seat: number,
) {
	if (seat === table.you) {
		return cards.table.you;
	}
	const entry = table.seats[seat];
	if (entry?.botIndex !== null && entry?.botIndex !== undefined) {
		return (cards.bots as Record<string, string>)[`bot${entry.botIndex}`];
	}
	return entry?.name ?? cards.setup.youFallback;
}

const rankOrder = (id: CardId) => {
	const card = parseCard(id);
	if (card.joker) {
		return 99;
	}
	return card.rank === "A" ? 14 : RANKS.indexOf(card.rank) + 1;
};

const suitOrder = (id: CardId) => {
	const card = parseCard(id);
	return card.joker ? 99 : SUITS.indexOf(card.suit);
};

/** Jokers go last; aces high, because that is how hands get read. */
export function sortCards(hand: readonly CardId[], by: "suit" | "rank") {
	return [...hand].sort((a, b) =>
		by === "suit"
			? suitOrder(a) - suitOrder(b) || rankOrder(a) - rankOrder(b)
			: rankOrder(a) - rankOrder(b) || suitOrder(a) - suitOrder(b),
	);
}

/** A stable lean for a card on the pile, so it doesn't jiggle on every render. */
export function cardTilt(id: CardId) {
	let hash = 0;
	for (const char of id) {
		hash = (hash * 31 + char.charCodeAt(0)) % 997;
	}
	return (hash % 15) - 7;
}

/** One sentence for the ticker; screen readers hear it through a live region. */
export function describeEvent(
	event: CardEvent,
	cards: CardMessages,
	locale: string,
	table: Pick<CardTableBundle, "seats" | "you">,
	cardName: (id: CardId) => string,
): string {
	const e = cards.events;
	const name = (seat: number) => seatName(cards, table, seat);
	const mine = (seat: number) => seat === table.you;
	switch (event.type) {
		case "deal":
			return event.round > 1
				? fmt(e.dealRound, { round: event.round })
				: e.deal;
		case "play": {
			const card = cardName(event.card);
			if (event.suit) {
				const suit = cards.suits[event.suit];
				return mine(event.seat)
					? fmt(e.youChooseSuit, { card, suit })
					: fmt(e.chooseSuit, { card, suit, name: name(event.seat) });
			}
			return mine(event.seat)
				? fmt(e.youPlay, { card })
				: fmt(e.play, { card, name: name(event.seat) });
		}
		case "draw":
			if (event.source === "discard") {
				return mine(event.seat)
					? e.youTakeDiscard
					: fmt(e.takeDiscard, { name: name(event.seat) });
			}
			return mine(event.seat)
				? e.youDraw
				: fmt(e.draw, { name: name(event.seat) });
		case "penalty":
			return mine(event.seat)
				? plural(locale, event.count, e.youPenalty)
				: fmt(plural(locale, event.count, e.penalty), {
						name: name(event.seat),
					});
		case "skip":
			return mine(event.seat)
				? e.youSkip
				: fmt(e.skip, { name: name(event.seat) });
		case "reverse":
			return e.reverse;
		case "again":
			return mine(event.seat)
				? e.youAgain
				: fmt(e.again, { name: name(event.seat) });
		case "pass":
			return mine(event.seat)
				? e.youPass
				: fmt(e.pass, { name: name(event.seat) });
		case "reshuffle":
			return e.reshuffle;
		case "lastCard":
			return mine(event.seat)
				? e.youLastCard
				: fmt(e.lastCard, { name: name(event.seat) });
		case "caught":
			return fmt(
				plural(
					locale,
					event.count,
					mine(event.seat)
						? e.caughtYou
						: mine(event.by)
							? e.youCaught
							: e.caught,
				),
				{ by: name(event.by), name: name(event.seat) },
			);
		case "finishPenalty":
			return mine(event.seat)
				? plural(locale, event.count, e.youFinishPenalty)
				: fmt(plural(locale, event.count, e.finishPenalty), {
						name: name(event.seat),
					});
		case "meld":
			if (event.opened) {
				return mine(event.seat)
					? e.youMeldOpened
					: fmt(e.meldOpened, { name: name(event.seat) });
			}
			return mine(event.seat)
				? e.youMeld
				: fmt(e.meld, { name: name(event.seat) });
		case "layoff":
			return mine(event.seat)
				? e.youLayoff
				: fmt(e.layoff, { name: name(event.seat) });
		case "swap":
			return mine(event.seat)
				? e.youSwap
				: fmt(e.swap, { name: name(event.seat) });
		case "discard": {
			const card = cardName(event.card);
			return mine(event.seat)
				? fmt(e.youDiscard, { card })
				: fmt(e.discard, { card, name: name(event.seat) });
		}
		case "roundEnd":
			return event.winner === null
				? e.roundEndNobody
				: mine(event.winner)
					? e.youRoundEnd
					: fmt(e.roundEnd, { name: name(event.winner) });
		case "win":
			if (event.seats.length > 1) {
				return fmt(e.winTie, { name: event.seats.map(name).join(" & ") });
			}
			return mine(event.seats[0])
				? e.youWin
				: fmt(e.win, { name: name(event.seats[0]) });
	}
}
