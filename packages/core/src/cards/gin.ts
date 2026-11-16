/**
 * Gin family: two players draw and discard toward a hand of sets and runs.
 * Melds stay hidden in the hand until someone knocks; then the knocker lays
 * their hand open, the other player lays off on the knocker's melds, and the
 * difference in unmatched cards (deadwood) scores.
 *
 * Gin plays the ace low only: A-2-3 is a run, Q-K-A is not.
 */
import { GameRuleError } from "../errors";
import { type Rng, shuffle } from "../random";
import type { BotMove } from "../table-engine";
import {
	buildDeck,
	type CardId,
	clone,
	deal,
	parseCard,
	RANKS,
	type Rank,
	removeCard,
	type Suit,
} from "./deck";
import { type CardEvent, pushEvent } from "./events";
import {
	buildMeld,
	extendMeld,
	handPoints,
	type Meld,
	type MeldRules,
	type MeldShape,
} from "./melds";
import { publicTable } from "./table";

export type GinRules = MeldRules & {
	handSize: number;
	/** Most deadwood points a player may knock with. */
	knockLimit: number;
	/** Added to the score for going gin (no deadwood at all). */
	ginBonus: number;
	/** Added to the defender's score when they undercut the knocker. */
	undercutBonus: number;
	/** First to this many points wins the match. */
	targetScore: number;
	/** A hand that leaves this few cards in the stock without a knock is called off. */
	stockFloor: number;
};

/** How a hand ended. `winner` scored `points`; a void hand scores nobody. */
export type GinHandResult = {
	kind: "knock" | "gin" | "undercut" | "void";
	knocker: number | null;
	winner: number | null;
	points: number;
	/** Each seat's deadwood points when the hand was scored. */
	deadwood: number[];
	/** Each seat's hand as it was scored: its melds and its deadwood. */
	shown: Array<{ melds: CardId[][]; deadwood: CardId[] }>;
};

export type GinState = {
	family: "gin";
	hands: CardId[][];
	stock: CardId[];
	discard: CardId[];
	turn: number;
	dealer: number;
	phase: "draw" | "play" | "layoff" | "handOver" | "finished";
	/** Hand number in the match, from 1. */
	round: number;
	/** Points scored per finished hand, one entry per seat. */
	scores: number[][];
	/** Taken from the discard pile this turn: may not go straight back. */
	takenDiscard: CardId | null;
	/** Who knocked this hand. Their melds are on the table; their hand is their deadwood. */
	knock: { seat: number; gin: boolean } | null;
	/** The knocker's melds, with the cards laid off on them. */
	melds: Meld[];
	nextMeldId: number;
	result: GinHandResult | null;
	winners: number[];
	events: CardEvent[];
	nextSeq: number;
};

export type GinAction =
	| { type: "drawStock" }
	| { type: "takeDiscard" }
	| { type: "discard"; card: CardId }
	| { type: "knock"; card: CardId }
	| { type: "layOff"; meldId: number; cards: CardId[] }
	| { type: "finishLayoff" }
	| { type: "nextRound" };

/** Keyed by action type, so a new action cannot be left out. */
export const GIN_ACTIONS: Record<GinAction["type"], true> = {
	drawStock: true,
	takeDiscard: true,
	discard: true,
	knock: true,
	layOff: true,
	finishLayoff: true,
	nextRound: true,
};

export type GinView = {
	family: "gin";
	phase: GinState["phase"];
	turn: number;
	round: number;
	targetScore: number;
	top: CardId | null;
	underTop: CardId[];
	stockCount: number;
	handCounts: number[];
	hand: CardId[];
	takenDiscard: CardId | null;
	knock: GinState["knock"];
	/** The knocker's melds, public from the knock on. */
	melds: Meld[];
	/** The knocker's unmatched cards, laid open with the melds. */
	knockerDeadwood: CardId[];
	scores: number[][];
	totals: number[];
	result: GinHandResult | null;
	winners: number[];
	events: CardEvent[];
};

/** A run's top must stay at the king: the ace counts low only. */
function aceLow<M extends MeldShape>(meld: M | null): M | null {
	if (!meld || meld.kind === "set") {
		return meld;
	}
	return meld.low + meld.cards.length - 1 <= RANKS.length ? meld : null;
}

/** The set or run these cards form under gin rules, or null. */
export function ginMeld(cards: readonly CardId[], rules: GinRules) {
	return aceLow(buildMeld(cards, rules));
}

/** The meld with `card` added, ace low only; null when it doesn't fit. */
function ginExtend(meld: Meld, card: CardId): Meld | null {
	const extended = aceLow(extendMeld(meld, card));
	if (extended || meld.kind === "set") {
		return extended;
	}
	// extendMeld tries an ace above the king first, so put it below a run from 2 here.
	const parsed = parseCard(card);
	return !parsed.joker &&
		parsed.rank === "A" &&
		parsed.suit === meld.suit &&
		meld.low === 2
		? { ...meld, cards: [card, ...meld.cards], low: 1 }
		: null;
}

/**
 * An order in which all of `cards` lay off onto the meld, or null when they
 * don't all fit. Tapping order does not matter.
 */
export function fitLayoff(meld: Meld, cards: readonly CardId[]) {
	const left = [...cards];
	const order: CardId[] = [];
	let current = meld;
	while (left.length > 0) {
		const index = left.findIndex((card) => ginExtend(current, card));
		if (index < 0) {
			return null;
		}
		const [card] = left.splice(index, 1);
		current = ginExtend(current, card) as Meld;
		order.push(card);
	}
	return { order, meld: current };
}

const rankIndex = (card: CardId) => RANKS.indexOf(parseCard(card).rank as Rank);

/** Every set and run these cards could form: sets of three or four, runs of any length. */
function possibleMelds(hand: readonly CardId[], rules: GinRules) {
	const found: MeldShape[] = [];
	const byRank = new Map<Rank, CardId[]>();
	const bySuit = new Map<Suit, CardId[]>();
	for (const card of hand) {
		const parsed = parseCard(card);
		if (parsed.joker) {
			continue;
		}
		byRank.set(parsed.rank, [...(byRank.get(parsed.rank) ?? []), card]);
		bySuit.set(parsed.suit, [...(bySuit.get(parsed.suit) ?? []), card]);
	}
	for (const group of byRank.values()) {
		const subsets =
			group.length === 4
				? [
						group,
						...group.map((_, skip) => group.filter((__, i) => i !== skip)),
					]
				: [group];
		for (const cards of subsets) {
			const shape = ginMeld(cards, rules);
			if (shape) {
				found.push(shape);
			}
		}
	}
	for (const group of bySuit.values()) {
		const cards = [...group].sort((a, b) => rankIndex(a) - rankIndex(b));
		for (let start = 0; start < cards.length; start += 1) {
			for (let end = start + rules.minMeldSize; end <= cards.length; end += 1) {
				const shape = ginMeld(cards.slice(start, end), rules);
				if (!shape) {
					break;
				}
				found.push(shape);
			}
		}
	}
	return found;
}

export type GinArrangement = {
	melds: MeldShape[];
	deadwood: CardId[];
	points: number;
};

/** The melds that leave the least deadwood: what a knock would lay open. */
export function arrangeHand(
	hand: readonly CardId[],
	rules: GinRules,
): GinArrangement {
	const options = possibleMelds(hand, rules);
	let best: GinArrangement = {
		melds: [],
		deadwood: [...hand],
		points: handPoints(hand, rules),
	};
	const used = new Set<CardId>();
	const chosen: MeldShape[] = [];
	const search = (start: number) => {
		const deadwood = hand.filter((card) => !used.has(card));
		const points = handPoints(deadwood, rules);
		if (points < best.points) {
			best = { melds: [...chosen], deadwood, points };
		}
		for (let index = start; index < options.length; index += 1) {
			const meld = options[index];
			if (meld.cards.some((card) => used.has(card))) {
				continue;
			}
			for (const card of meld.cards) {
				used.add(card);
			}
			chosen.push(meld);
			search(index + 1);
			chosen.pop();
			for (const card of meld.cards) {
				used.delete(card);
			}
		}
	};
	search(0);
	return best;
}

/**
 * The discard that leaves the least deadwood, never the card just taken from
 * the pile. Ties shed the highest card.
 */
export function bestDiscard(
	hand: readonly CardId[],
	rules: GinRules,
	forbidden: CardId | null,
) {
	let best: { card: CardId; points: number } | null = null;
	for (const card of hand) {
		if (card === forbidden) {
			continue;
		}
		const rest = hand.filter((held) => held !== card);
		const points = arrangeHand(rest, rules).points;
		if (
			!best ||
			points < best.points ||
			(points === best.points &&
				handPoints([card], rules) > handPoints([best.card], rules))
		) {
			best = { card, points };
		}
	}
	return best;
}

export function createGin(
	rules: GinRules,
	seats: number,
	random: Rng,
	dealer = seats - 1,
	carried?: Pick<GinState, "round" | "scores" | "nextSeq" | "events">,
): GinState {
	const stock = shuffle(buildDeck(1, 0), random);
	const hands = deal(stock, seats, rules.handSize);
	const state: GinState = {
		family: "gin",
		hands,
		stock,
		discard: [stock.pop() as CardId],
		turn: (dealer + 1) % seats,
		dealer,
		phase: "draw",
		round: carried?.round ?? 1,
		scores: carried?.scores ?? [],
		takenDiscard: null,
		knock: null,
		melds: [],
		nextMeldId: 1,
		result: null,
		winners: [],
		events: carried?.events ?? [],
		nextSeq: carried?.nextSeq ?? 0,
	};
	pushEvent(state, { type: "deal", round: state.round });
	return state;
}

/** Deals so `starter` plays first: the dealer sits one seat before them. */
export function startGin(
	rules: GinRules,
	seats: number,
	random: Rng,
	starter: number,
) {
	return createGin(rules, seats, random, (starter + seats - 1) % seats);
}

/** Who leads the rematch: the seat after the one who led the last hand. */
export function nextGinStarter(state: GinState) {
	return (state.dealer + 2) % state.hands.length;
}

function totalsOf(scores: readonly number[][], seats: number) {
	return Array.from({ length: seats }, (_, seat) =>
		scores.reduce((sum, hand) => sum + (hand[seat] ?? 0), 0),
	);
}

function show(
	melds: ReadonlyArray<{ cards: CardId[] }>,
	deadwood: readonly CardId[],
) {
	return {
		melds: melds.map((meld) => [...meld.cards]),
		deadwood: [...deadwood],
	};
}

function endHand(
	rules: GinRules,
	state: GinState,
	result: Omit<GinHandResult, "shown">,
	shown: GinHandResult["shown"],
) {
	const row = state.hands.map((_, seat) =>
		seat === result.winner ? result.points : 0,
	);
	state.scores.push(row);
	state.result = { ...result, shown };
	state.takenDiscard = null;
	if (result.kind === "void" || result.winner === null) {
		pushEvent(state, { type: "roundEnd", winner: null, round: state.round });
	} else {
		pushEvent(state, {
			type: "handEnd",
			winner: result.winner,
			kind: result.kind,
			points: result.points,
		});
	}
	const totals = totalsOf(state.scores, state.hands.length);
	const reached = totals.flatMap((total, seat) =>
		total >= rules.targetScore ? [seat] : [],
	);
	if (reached.length > 0) {
		state.phase = "finished";
		state.winners = reached;
		pushEvent(state, { type: "win", seats: reached });
		return;
	}
	state.phase = "handOver";
}

/** Nobody knocked before the stock ran low: the hand scores nothing. */
function voidHand(rules: GinRules, state: GinState) {
	const arranged = state.hands.map((hand) => arrangeHand(hand, rules));
	endHand(
		rules,
		state,
		{
			kind: "void",
			knocker: null,
			winner: null,
			points: 0,
			deadwood: arranged.map((hand) => hand.points),
		},
		arranged.map((hand) => show(hand.melds, hand.deadwood)),
	);
}

/** Scores a knock once the defender has laid off, or a gin straight away. */
function scoreKnock(rules: GinRules, state: GinState) {
	const knock = state.knock as NonNullable<GinState["knock"]>;
	const knocker = knock.seat;
	const defender = (knocker + 1) % state.hands.length;
	const knockerPoints = handPoints(state.hands[knocker], rules);
	const defence = arrangeHand(state.hands[defender], rules);
	const deadwood = state.hands.map((_, seat) =>
		seat === knocker ? knockerPoints : defence.points,
	);
	const shown = state.hands.map((hand, seat) =>
		seat === knocker
			? show(state.melds, hand)
			: show(defence.melds, defence.deadwood),
	);
	const base = { knocker, deadwood };
	if (knock.gin) {
		endHand(
			rules,
			state,
			{
				...base,
				kind: "gin",
				winner: knocker,
				points: defence.points + rules.ginBonus,
			},
			shown,
		);
		return;
	}
	if (defence.points <= knockerPoints) {
		endHand(
			rules,
			state,
			{
				...base,
				kind: "undercut",
				winner: defender,
				points: knockerPoints - defence.points + rules.undercutBonus,
			},
			shown,
		);
		return;
	}
	endHand(
		rules,
		state,
		{
			...base,
			kind: "knock",
			winner: knocker,
			points: defence.points - knockerPoints,
		},
		shown,
	);
}

function requireTurn(state: GinState, seat: number, phase: "draw" | "play") {
	if (state.phase === "handOver" || state.phase === "finished") {
		throw new GameRuleError("noActiveRound");
	}
	if (state.phase === "layoff") {
		throw new GameRuleError("cardsAfterKnock");
	}
	if (state.turn !== seat) {
		throw new GameRuleError("notYourTurn");
	}
	if (state.phase !== phase) {
		throw new GameRuleError(
			phase === "draw" ? "cardsAlreadyDrew" : "cardsDrawFirst",
		);
	}
}

function requireLayoff(state: GinState, seat: number) {
	if (state.phase === "handOver" || state.phase === "finished") {
		throw new GameRuleError("noActiveRound");
	}
	if (state.phase !== "layoff") {
		throw new GameRuleError("cardsNoKnock");
	}
	if (state.turn !== seat) {
		throw new GameRuleError("notYourTurn");
	}
}

function requireDiscardable(state: GinState, seat: number, card: CardId) {
	if (!state.hands[seat].includes(card)) {
		throw new GameRuleError("cardsNotInHand");
	}
	if (card === state.takenDiscard) {
		throw new GameRuleError("cardsCannotReturnDiscard");
	}
}

/** Takes a card out of the hand to discard it, or refuses. */
function takeForDiscard(state: GinState, seat: number, card: CardId) {
	requireDiscardable(state, seat, card);
	removeCard(state.hands[seat], card);
	state.discard.push(card);
	state.takenDiscard = null;
	pushEvent(state, { type: "discard", seat, card });
}

export function applyGin(
	rules: GinRules,
	previous: GinState,
	seat: number,
	action: GinAction,
	random: Rng,
): GinState {
	const state = clone(previous);
	switch (action.type) {
		case "nextRound": {
			if (state.phase !== "handOver") {
				throw new GameRuleError("currentGameNotFinished");
			}
			return createGin(
				rules,
				state.hands.length,
				random,
				(state.dealer + 1) % state.hands.length,
				{
					round: state.round + 1,
					scores: state.scores,
					nextSeq: state.nextSeq,
					events: state.events,
				},
			);
		}
		case "drawStock": {
			requireTurn(state, seat, "draw");
			const card = state.stock.pop();
			if (!card) {
				voidHand(rules, state);
				return state;
			}
			state.hands[seat].push(card);
			state.phase = "play";
			pushEvent(state, { type: "draw", seat, count: 1, source: "stock" });
			return state;
		}
		case "takeDiscard": {
			requireTurn(state, seat, "draw");
			const card = state.discard.pop();
			if (!card) {
				throw new GameRuleError("cardsDiscardEmpty");
			}
			state.hands[seat].push(card);
			state.takenDiscard = card;
			state.phase = "play";
			pushEvent(state, { type: "draw", seat, count: 1, source: "discard" });
			return state;
		}
		case "discard": {
			requireTurn(state, seat, "play");
			takeForDiscard(state, seat, action.card);
			if (state.stock.length <= rules.stockFloor) {
				voidHand(rules, state);
				return state;
			}
			state.turn = (state.turn + 1) % state.hands.length;
			state.phase = "draw";
			return state;
		}
		case "knock": {
			requireTurn(state, seat, "play");
			requireDiscardable(state, seat, action.card);
			const rest = state.hands[seat].filter((card) => card !== action.card);
			const arranged = arrangeHand(rest, rules);
			if (arranged.points > rules.knockLimit) {
				throw new GameRuleError("cardsKnockTooHigh", {
					deadwood: arranged.points,
					limit: rules.knockLimit,
				});
			}
			takeForDiscard(state, seat, action.card);
			const meldIds: number[] = [];
			for (const shape of arranged.melds) {
				const id = state.nextMeldId;
				state.nextMeldId += 1;
				state.melds.push({ ...shape, id });
				meldIds.push(id);
			}
			state.hands[seat] = arranged.deadwood;
			const gin = arranged.points === 0;
			state.knock = { seat, gin };
			if (meldIds.length > 0) {
				pushEvent(state, { type: "meld", seat, meldIds, opened: false });
			}
			pushEvent(state, { type: "knock", seat, gin });
			if (gin) {
				scoreKnock(rules, state);
				return state;
			}
			state.phase = "layoff";
			state.turn = (seat + 1) % state.hands.length;
			return state;
		}
		case "layOff": {
			requireLayoff(state, seat);
			if (action.cards.length === 0) {
				throw new GameRuleError("cardsNothingToLay");
			}
			const index = state.melds.findIndex((meld) => meld.id === action.meldId);
			if (index < 0) {
				throw new GameRuleError("cardsInvalidMeld");
			}
			const hand = state.hands[seat];
			if (
				new Set(action.cards).size !== action.cards.length ||
				action.cards.some((card) => !hand.includes(card))
			) {
				throw new GameRuleError("cardsNotInHand");
			}
			const fitted = fitLayoff(state.melds[index], action.cards);
			if (!fitted) {
				throw new GameRuleError("cardsDoesNotExtend");
			}
			for (const card of action.cards) {
				removeCard(hand, card);
			}
			state.melds[index] = fitted.meld;
			pushEvent(state, {
				type: "layoff",
				seat,
				meldId: action.meldId,
				cards: fitted.order,
			});
			return state;
		}
		case "finishLayoff": {
			requireLayoff(state, seat);
			scoreKnock(rules, state);
			return state;
		}
	}
}

export function viewGin(
	rules: GinRules,
	state: GinState,
	seat: number | null,
): GinView {
	const live = state.phase === "draw" || state.phase === "play";
	const isTurn = seat !== null && state.turn === seat && live;
	return {
		family: "gin",
		phase: state.phase,
		turn: state.turn,
		round: state.round,
		targetScore: rules.targetScore,
		top: state.discard[state.discard.length - 1] ?? null,
		...publicTable(state),
		hand: seat === null ? [] : state.hands[seat],
		takenDiscard: isTurn ? state.takenDiscard : null,
		knock: state.knock,
		melds: state.melds,
		knockerDeadwood: state.knock ? state.hands[state.knock.seat] : [],
		scores: state.scores,
		totals: totalsOf(state.scores, state.hands.length),
		result: state.result,
		winners: state.winners,
		events: state.events,
	};
}

// The computer player, which also plays autopiloted seats.

/** Lays off one card at a time, and only a card that lowers its deadwood. */
function botLayoff(rules: GinRules, state: GinState, seat: number) {
	const hand = state.hands[seat];
	const now = arrangeHand(hand, rules).points;
	for (const card of hand) {
		const rest = hand.filter((held) => held !== card);
		if (arrangeHand(rest, rules).points >= now) {
			continue;
		}
		const meld = state.melds.find((candidate) => fitLayoff(candidate, [card]));
		if (meld) {
			return { meldId: meld.id, cards: [card] };
		}
	}
	return null;
}

export function botGinMove(
	rules: GinRules,
	state: GinState,
	bots: readonly number[],
): BotMove<GinAction> | null {
	if (state.phase === "handOver") {
		// Humans deal the next hand, unless all of them are on autopilot.
		return bots.length === state.hands.length
			? { seat: bots[0], action: { type: "nextRound" }, pace: "reaction" }
			: null;
	}
	if (state.phase === "finished" || !bots.includes(state.turn)) {
		return null;
	}
	const seat = state.turn;
	const hand = state.hands[seat];
	if (state.phase === "layoff") {
		const layOff = botLayoff(rules, state, seat);
		return {
			seat,
			action: layOff ? { type: "layOff", ...layOff } : { type: "finishLayoff" },
			pace: "followUp",
		};
	}
	if (state.phase === "draw") {
		const top = state.discard[state.discard.length - 1];
		const now = arrangeHand(hand, rules).points;
		const taking = top ? bestDiscard([...hand, top], rules, top) : null;
		return {
			seat,
			action:
				taking && taking.points < now
					? { type: "takeDiscard" }
					: { type: "drawStock" },
			pace: "turn",
		};
	}
	const choice = bestDiscard(hand, rules, state.takenDiscard) as {
		card: CardId;
		points: number;
	};
	return {
		seat,
		action:
			choice.points <= rules.knockLimit
				? { type: "knock", card: choice.card }
				: { type: "discard", card: choice.card },
		pace: "followUp",
	};
}
