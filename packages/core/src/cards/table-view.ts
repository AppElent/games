/**
 * What every client derives the same way from a table: names, sentences, the
 * order of seats, which moves a selection allows, which cards just arrived, and
 * which cards cross the table. No drawing and no framework.
 */
import type { Messages } from "../i18n/en";
import { type CardId, parseCard, RANKS, SUITS } from "./deck";
import { SEAT_SILENT_AFTER_MS } from "./engine";
import type { CardEvent } from "./events";
import {
	buildMeld,
	fitOnMeld,
	type Meld,
	type MeldRules,
	meldPoints,
	runFaceAt,
	swapJoker,
} from "./melds";
import type { RummyRules, RummyView } from "./rummy";
import type { SheddingView } from "./shedding";

export type CardMessages = Messages["games"]["cards"];

/** The client's own text helpers, so this module stays free of locale runtime. */
export type CardWords = {
	cards: CardMessages;
	fmt: (template: string, params: Record<string, string | number>) => string;
	countOf: (count: number, forms: { one: string; other: string }) => string;
};

type TableSeat = {
	botIndex: number | null;
	name: string | null;
	autopilot: boolean;
	lastSeen: number | null;
};
type TableSeats = { seats: readonly TableSeat[]; you: number | null };

export function seatName(
	cards: CardMessages,
	table: TableSeats,
	seat: number,
): string {
	if (seat === table.you) {
		return cards.table.you;
	}
	const entry = table.seats[seat];
	if (entry?.botIndex !== null && entry?.botIndex !== undefined) {
		return (cards.bots as Record<string, string>)[`bot${entry.botIndex}`];
	}
	return entry?.name ?? cards.setup.youFallback;
}

/** The other seats in the order play reaches them, so the table reads clockwise. */
export function opponentOrder(table: TableSeats): number[] {
	const count = table.seats.length;
	if (table.you === null) {
		return table.seats.map((_, index) => index);
	}
	const you = table.you;
	return Array.from(
		{ length: count - 1 },
		(_, step) => (you + step + 1) % count,
	);
}

/** Only a person can go quiet, and an autopilot seat keeps playing regardless. */
export function seatIsSilent(seat: TableSeat, now: number) {
	return (
		seat.botIndex === null &&
		!seat.autopilot &&
		seat.lastSeen !== null &&
		now - seat.lastSeen > SEAT_SILENT_AFTER_MS
	);
}

export function cardName(cards: CardMessages, id: CardId) {
	const card = parseCard(id);
	return card.joker
		? cards.joker
		: cards.cardName
				.replace("{rank}", cards.ranks[card.rank])
				.replace("{suit}", cards.suits[card.suit]);
}

/** Each card of a meld as a sentence, including what a joker in a run stands for. */
export function meldCardNames(cards: CardMessages, meld: Meld) {
	return meld.cards.map((card, index) => {
		if (!parseCard(card).joker || meld.kind !== "run") {
			return cardName(cards, card);
		}
		const face = runFaceAt(meld, index);
		return cards.rummy.jokerAs.replace(
			"{card}",
			cards.cardName
				.replace("{rank}", cards.ranks[face.rank])
				.replace("{suit}", cards.suits[face.suit]),
		);
	});
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
	words: CardWords,
	table: TableSeats,
): string {
	const { cards, fmt, countOf } = words;
	const e = cards.events;
	const name = (seat: number) => seatName(cards, table, seat);
	const mine = (seat: number) => seat === table.you;
	switch (event.type) {
		case "deal":
			return event.round > 1
				? fmt(e.dealRound, { round: event.round })
				: e.deal;
		case "play": {
			const card = cardName(cards, event.card);
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
				? countOf(event.count, e.youPenalty)
				: fmt(countOf(event.count, e.penalty), { name: name(event.seat) });
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
				countOf(
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
				? countOf(event.count, e.youFinishPenalty)
				: fmt(countOf(event.count, e.finishPenalty), {
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
			const card = cardName(cards, event.card);
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

/** Means little alone: "Anna misses a turn" doesn't say who played what. */
const FOLLOWS_A_PLAY: ReadonlySet<CardEvent["type"]> = new Set([
	"skip",
	"reverse",
	"again",
]);

/** The latest thing that happened, as the table's one line of narration. */
export function latestEventText(
	events: readonly CardEvent[],
	words: CardWords,
	table: TableSeats,
) {
	const latest = events.at(-1);
	if (!latest) {
		return "";
	}
	const before = FOLLOWS_A_PLAY.has(latest.type)
		? events.slice(-3, -1).find((event) => event.type === "play")
		: null;
	return [before, latest]
		.filter((event) => event != null)
		.map((event) => describeEvent(event, words, table))
		.join(" ");
}

/** What to do now on a shedding turn; null when it isn't this player's turn. */
export function sheddingHint(
	view: SheddingView,
	mine: boolean,
	{ cards, fmt }: Pick<CardWords, "cards" | "fmt">,
) {
	if (!mine) {
		return null;
	}
	if (view.pendingDraw > 0) {
		return fmt(
			view.legal.length > 0
				? cards.shedding.mustAnswer
				: cards.shedding.mustTake,
			{ count: view.pendingDraw },
		);
	}
	if (view.drawnCard) {
		return cards.shedding.playDrawnHint;
	}
	if (view.mustContinue) {
		return cards.shedding.mustContinue;
	}
	return view.legal.length > 0
		? cards.shedding.pickMove
		: cards.shedding.noMove;
}

/** Everything a rummy turn allows, given what this player has selected and set aside. */
export function rummyTurn({
	view,
	rules,
	you,
	selected,
	staged,
}: {
	view: RummyView;
	rules: RummyRules;
	you: number | null;
	selected: readonly CardId[];
	staged: readonly (readonly CardId[])[];
}) {
	const live = view.phase === "draw" || view.phase === "play";
	const mine = live && view.turn === you;
	const drawing = mine && view.phase === "draw";
	const playing = mine && view.phase === "play";
	const opened = you !== null && view.opened[you];
	const stagedFlat = staged.flat();
	const inHand = view.hand.filter((card) => !stagedFlat.includes(card));
	const selection = selected.filter((card) => inHand.includes(card));
	const shape =
		selection.length >= rules.minMeldSize
			? buildMeld([...selection], rules)
			: null;
	const shapePoints = shape ? meldPoints(shape, rules) : 0;
	const stagedPoints = staged.reduce((sum, group) => {
		const built = buildMeld([...group], rules);
		return sum + (built ? meldPoints(built, rules) : 0);
	}, 0);
	// Every turn ends on a discard, so laying down can never empty the hand.
	const keepsOne = selection.length < inHand.length;
	const canOpen =
		!opened &&
		staged.length > 0 &&
		shape === null &&
		stagedPoints >= rules.openingPoints &&
		inHand.length > 0;
	// The selection itself reaches the opening, with or without what's set aside.
	const openingWithShape = stagedPoints + shapePoints;
	const canOpenNow =
		playing &&
		!opened &&
		shape !== null &&
		keepsOne &&
		openingWithShape >= rules.openingPoints;
	const singleCard = selection.length === 1 ? selection[0] : null;
	const cantReturn =
		singleCard !== null &&
		singleCard === view.takenDiscard &&
		view.hand.length > 1;
	const canDiscard =
		playing && singleCard !== null && staged.length === 0 && !cantReturn;
	return {
		live,
		mine,
		drawing,
		playing,
		opened,
		inHand,
		selection,
		shape,
		shapePoints,
		stagedPoints,
		keepsOne,
		canOpen,
		openingWithShape,
		canOpenNow,
		singleCard,
		cantReturn,
		canDiscard,
		canTakeDiscard: drawing && rules.takeFromDiscard && view.top !== null,
	};
}

export type RummyTurn = ReturnType<typeof rummyTurn>;

/** What tapping this meld would do with the current selection, if anything. */
export function rummyMeldAction(turn: RummyTurn, meld: Meld) {
	if (!turn.playing || !turn.opened || turn.selection.length === 0) {
		return null;
	}
	// Taking the joker back beats adding the card, as the rules promise.
	if (turn.singleCard && swapJoker(meld, turn.singleCard)) {
		return { type: "swap" as const };
	}
	const order = turn.keepsOne ? fitOnMeld(meld, [...turn.selection]) : null;
	return order ? { type: "add" as const, order } : null;
}

/** What to do now on a rummy turn; null when it isn't this player's turn. */
export function rummyHint(
	turn: RummyTurn,
	view: RummyView,
	rules: RummyRules & MeldRules,
	staged: readonly (readonly CardId[])[],
	messages: Pick<Messages, "serverErrors"> & { words: CardWords },
) {
	const { cards, fmt } = messages.words;
	if (turn.drawing) {
		return rules.takeFromDiscard
			? cards.rummy.drawHint
			: cards.rummy.drawStockHint;
	}
	if (!turn.playing) {
		return null;
	}
	const stagedNote = () =>
		turn.stagedPoints >= rules.openingPoints
			? cards.rummy.stagedHint
			: fmt(cards.rummy.stagedMoreHint, { needed: rules.openingPoints });
	if (!turn.keepsOne && !turn.canDiscard) {
		return messages.serverErrors.cardsKeepOneToDiscard;
	}
	if (turn.cantReturn) {
		return messages.serverErrors.cardsCannotReturnDiscard;
	}
	if (turn.selection.length === 0) {
		return staged.length > 0 ? stagedNote() : cards.rummy.selectHint;
	}
	if (view.melds.some((meld) => rummyMeldAction(turn, meld))) {
		return cards.rummy.tapMeldHint;
	}
	if (turn.selection.length > 1 && turn.shape === null) {
		return cards.rummy.invalidMeld;
	}
	if (turn.canOpenNow) {
		return cards.rummy.openNowHint;
	}
	if (!turn.opened && turn.shape !== null) {
		return fmt(cards.rummy.openingNeeded, { needed: rules.openingPoints });
	}
	return staged.length > 0 ? stagedNote() : cards.rummy.discardHint;
}

/** The newest event number, or null for an empty log. */
export function newestSeq(events: readonly CardEvent[]): number | null {
	return events.at(-1)?.seq ?? null;
}

/** A rematch restarts the event log, so its newest number drops below the last one seen. */
export function logRestarted(newest: number | null, previous: number | null) {
	return newest !== null && previous !== null && newest < previous;
}

export type FreshCardsMemory = {
	hand: readonly CardId[] | null;
	mine: boolean;
	dealSeq: number | null;
	newestSeq: number | null;
	fresh: readonly CardId[];
};

export function startFreshCards(mine: boolean): FreshCardsMemory {
	return { hand: null, mine, dealSeq: null, newestSeq: null, fresh: [] };
}

/**
 * The cards that just arrived in a hand, so a draw can be found in a sorted fan.
 * They stay marked until the player's next turn begins. A new deal marks nothing:
 * a rematch restarts the event log, so its newest event number drops.
 */
export function nextFreshCards(
	memory: FreshCardsMemory,
	hand: readonly CardId[],
	mine: boolean,
	events: readonly CardEvent[],
): FreshCardsMemory {
	const turnBegan = mine && !memory.mine;
	const dealSeq = [...events]
		.reverse()
		.find((event) => event.type === "deal")?.seq;
	const newest = newestSeq(events);
	const dealt =
		(dealSeq !== undefined && dealSeq !== memory.dealSeq) ||
		logRestarted(newest, memory.newestSeq);
	const before = memory.hand;
	const added =
		before && !dealt ? hand.filter((card) => !before.includes(card)) : [];
	const kept =
		turnBegan || dealt
			? []
			: memory.fresh.filter((card) => hand.includes(card));
	return {
		hand,
		mine,
		dealSeq: dealSeq ?? memory.dealSeq,
		newestSeq: newest,
		fresh: [...kept, ...added],
	};
}

/** Where a card can travel: a seat, the player's hand, the piles, or a meld. */
export type FlightZone =
	| "hand"
	| "stock"
	| "discard"
	| `seat-${number}`
	| `meld-${number}`;

export type PlannedFlight = {
	card: CardId | null;
	from: FlightZone;
	to: FlightZone;
	/** Milliseconds after the batch starts. */
	delay: number;
	/** The card has a known spot in this player's hand to leave from. */
	fromHandCard: boolean;
};

const FLIGHT_STEP_MS = 60;
const MAX_CARDS_PER_EVENT = 6;
const DEAL_CARDS_PER_SEAT = 3;

/** The events since `previousSeq`. A rematch restarts the count, so all are then new. */
export function eventsSince(
	events: readonly CardEvent[],
	previousSeq: number,
): readonly CardEvent[] {
	return logRestarted(newestSeq(events) ?? 0, previousSeq)
		? events
		: events.filter((event) => event.seq > previousSeq);
}

/** Turns events into cards crossing the table, and the seat to bump, if any. */
export function planFlights(
	events: readonly CardEvent[],
	{
		you,
		seatCount,
		meldCard,
	}: {
		you: number | null;
		seatCount: number;
		meldCard: (meldId: number) => CardId | null;
	},
) {
	const seatZone = (seat: number): FlightZone =>
		seat === you ? "hand" : `seat-${seat}`;
	const flights: PlannedFlight[] = [];
	let delay = 0;
	let flash: number | null = null;
	const fly = (
		card: CardId | null,
		from: FlightZone,
		to: FlightZone,
		fromHandCard = false,
	) => {
		flights.push({ card, from, to, delay, fromHandCard });
		delay += FLIGHT_STEP_MS;
	};
	const flyBacks = (count: number, from: FlightZone, seat: number) => {
		for (let i = 0; i < Math.min(count, MAX_CARDS_PER_EVENT); i += 1) {
			fly(null, from, seatZone(seat));
		}
	};
	for (const event of events) {
		switch (event.type) {
			case "deal":
				for (let round = 0; round < DEAL_CARDS_PER_SEAT; round += 1) {
					for (let seat = 0; seat < seatCount; seat += 1) {
						fly(null, "stock", seatZone(seat));
					}
				}
				break;
			case "play":
			case "discard":
				fly(event.card, seatZone(event.seat), "discard", event.seat === you);
				delay += FLIGHT_STEP_MS;
				break;
			case "draw":
				flyBacks(
					event.count,
					event.source === "discard" ? "discard" : "stock",
					event.seat,
				);
				break;
			case "penalty":
			case "caught":
			case "finishPenalty":
				flyBacks(event.count, "stock", event.seat);
				break;
			case "meld":
				for (const id of event.meldIds) {
					fly(meldCard(id), seatZone(event.seat), `meld-${id}`);
				}
				break;
			case "layoff":
				fly(
					event.cards[0] ?? null,
					seatZone(event.seat),
					`meld-${event.meldId}`,
				);
				break;
			case "swap":
				fly(event.card, seatZone(event.seat), `meld-${event.meldId}`);
				break;
			case "skip":
			case "again":
				flash = event.seat;
				break;
			default:
				break;
		}
	}
	return { flights, flash };
}
